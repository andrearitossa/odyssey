import { AIServiceManager, GeminiProvider, HuggingFaceProvider, WorkersAiProvider } from '../ai';
import { WorldDbService, SessionDbService } from '../database';
import { User } from '../database/db-types';
import { Env } from '../routes';
import { createErrorResponse, createJsonResponse } from '../utils/response';
import { generateSessionId, isValidSessionId, isValidWorldId } from '../utils/validation';
import { sanitizeInput } from '../utils/sanitization';
import { Logger } from '../utils/logger';
import { withinRateLimit } from '../utils/rateLimit';

type StoryMessage = { type: 'user' | 'narrator'; content: string; created_at: string };

export class StoryInteractionRouter {
  private db: D1Database;
  private worlds: WorldDbService;
  private sessions: SessionDbService;
  private ai = new AIServiceManager();

  constructor(env: Env) {
    this.db = env.DB;
    this.worlds = new WorldDbService(env.DB);
    this.sessions = new SessionDbService(env.DB);
    if (env.AI) this.ai.setProvider(new WorkersAiProvider(env.AI, env.AI_MODEL));
    else if (env.GEMINI_API_KEY) this.ai.setProvider(new GeminiProvider({ apiKey: env.GEMINI_API_KEY, model: env.GEMINI_MODEL }));
    else if ((env.HUGGINGFACE_API_KEY || env.HUGGING_FACE_API_KEY)?.startsWith('hf_')) this.ai.setProvider(new HuggingFaceProvider({ apiKey: (env.HUGGINGFACE_API_KEY || env.HUGGING_FACE_API_KEY)! }));
    Logger.info('Story provider', { component: 'StoryInteractionRouter', metadata: { provider: this.ai.getProviderName() } });
  }

  async route(request: Request, user: User, ctx?: ExecutionContext): Promise<Response | null> {
    const url = new URL(request.url);
    if (url.pathname === '/sessions/resume' && request.method === 'GET') {
      const worldId = url.searchParams.get('worldId');
      if (!worldId || !isValidWorldId(worldId)) return createErrorResponse('Choose a valid world.', 400);
      const session = await this.db.prepare('SELECT id, world_id, created_at FROM sessions WHERE user_id = ? AND world_id = ? ORDER BY rowid DESC LIMIT 1').bind(user.id, worldId).first<{id:string;world_id:string;created_at:string}>();
      if (!session) return createJsonResponse({ session: null, messages: [] });
      const messages = await this.db.prepare('SELECT type, content, created_at FROM messages WHERE session_id = ? ORDER BY id ASC').bind(session.id).all<StoryMessage>();
      return createJsonResponse({ session: { sessionId: session.id, worldId: session.world_id, createdAt: session.created_at }, messages: messages.results });
    }
    if (url.pathname === '/sessions/new' && request.method === 'POST') {
      if (!this.ai.hasProvider()) return this.unavailable();
      if (!(await withinRateLimit(this.db, 'session-new:' + user.id, 30, 86400000))) return createErrorResponse('You have reached today’s story limit.', 429);
      const body = await this.json(request);
      const worldId = body && typeof body.worldId === 'string' ? body.worldId : '';
      if (!isValidWorldId(worldId)) return createErrorResponse('Choose a valid world.', 400);
      const world = await this.worlds.getWorldById(worldId, user.id);
      if (!world) return createErrorResponse('World not found.', 404);
      const session = await this.sessions.createSession(generateSessionId(), user.id, worldId);
      return createJsonResponse({ sessionId: session.id, worldId, createdAt: session.created_at }, 201);
    }
    const chapters = url.pathname.match(/^\/sessions\/([^/]+)\/chapters$/);
    if (chapters && request.method === 'GET') {
      if (!isValidSessionId(chapters[1])) return createErrorResponse('Invalid session ID.', 400);
      const session = await this.sessions.getSessionWithUser(chapters[1], user.id);
      if (!session) return createErrorResponse('Session not found.', 404);
      const result = await this.db.prepare('SELECT * FROM chapters WHERE session_id = ? ORDER BY chapter_number ASC').bind(session.id).all();
      const items = result.results as Array<{ status: string }>;
      return createJsonResponse({ history: items.filter(c => c.status === 'history'), current: items.find(c => c.status === 'current') ?? null, future: items.filter(c => c.status === 'future') });
    }
    const interaction = url.pathname.match(/^\/sessions\/([^/]+)\/interact$/);
    if (interaction && request.method === 'POST') return this.interact(request, user, interaction[1], ctx);
    return null;
  }

  private completedResponse(request: Request, response: string) {
    if (request.headers.get('Accept')?.includes('text/event-stream')) {
      return new Response(`data: ${JSON.stringify({ response, done: true })}\n\n`, {
        headers: { 'Content-Type': 'text/event-stream', 'Cache-Control': 'no-store', 'Access-Control-Allow-Origin': '*' },
      });
    }
    return createJsonResponse({ response });
  }
  private unavailable() {
    return createErrorResponse('Story generation is unavailable. Configure a Workers AI binding or GEMINI_API_KEY.', 503, 'Service Unavailable');
  }
  private async json(request: Request): Promise<Record<string, unknown> | null> {
    try {
      const body = await request.json();
      return body && typeof body === 'object' && !Array.isArray(body) ? body as Record<string, unknown> : null;
    } catch { return null; }
  }
  private async interact(request: Request, user: User, sessionId: string, ctx?: ExecutionContext): Promise<Response> {
    if (!isValidSessionId(sessionId)) return createErrorResponse('Invalid session ID.', 400);
    const body = await this.json(request);
    const message = sanitizeInput(typeof body?.message === 'string' ? body.message : '');
    if (!message) return createErrorResponse('Write a choice to continue.', 400);
    const requestId = body?.requestId;
    if (requestId !== undefined && (typeof requestId !== 'string' || !/^[a-f0-9-]{36}$/i.test(requestId))) return createErrorResponse('Invalid request ID.', 400);
    const session = await this.sessions.getSessionWithUser(sessionId, user.id);
    if (!session) return createErrorResponse('Session not found.', 404);
    if (requestId) {
      const saved = await this.db.prepare('SELECT response FROM interaction_requests WHERE session_id = ? AND request_id = ?').bind(sessionId, requestId).first<{response:string}>();
      if (saved) return this.completedResponse(request, saved.response);
    }
    if (!this.ai.hasProvider()) return this.unavailable();
    if (!(await withinRateLimit(this.db, 'story-user:' + user.id, 80, 3600000))) return createErrorResponse('You have reached the hourly story limit. Come back soon.', 429);
    // A lease belongs to this attempt, not the idempotency key. A late worker
    // must never save or unlock a newer retry's turn.
    const lockId = crypto.randomUUID();
    const now = Date.now();
    const lock = await this.db.prepare(`INSERT INTO story_turn_locks (session_id, request_id, expires_at) VALUES (?, ?, ?)
      ON CONFLICT(session_id) DO UPDATE SET request_id = excluded.request_id, expires_at = excluded.expires_at
      WHERE story_turn_locks.expires_at < ? RETURNING request_id`).bind(sessionId, lockId, now + 60000, now).first<{request_id:string}>();
    if (!lock) return createErrorResponse('A move is still unfolding. Try again in a moment.', 409, 'Conflict');
    const unlock = () => this.db.prepare('DELETE FROM story_turn_locks WHERE session_id = ? AND request_id = ?').bind(sessionId, lockId).run();
    try {
      if (requestId) {
        const saved = await this.db.prepare('SELECT response FROM interaction_requests WHERE session_id = ? AND request_id = ?').bind(sessionId, requestId).first<{response:string}>();
        if (saved) { await unlock(); return this.completedResponse(request, saved.response); }
      }
      const world = await this.worlds.getWorldById(session.world_id, user.id);
      if (!world) { await unlock(); return createErrorResponse('World not found.', 404); }
      const recent = await this.db.prepare('SELECT type, content, created_at FROM messages WHERE session_id = ? ORDER BY id DESC LIMIT 8').bind(sessionId).all<StoryMessage>();
      const modelMessage = recent.results.length === 0 && message === '-' ? 'Begin the story with an immediate situation and a choice.' : message;
      const history = [...recent.results].reverse().filter(item => !(item.type === 'user' && item.content === '-')).map(item => ({ role: item.type === 'narrator' ? 'assistant' as const : 'user' as const, content: item.content.slice(0, 1600) }));
      // Keep confirmed outcomes, never an action-only summary: rejected premises
      // in user input are not facts. Include the opening plus recent older scenes.
      const earlier = recent.results.length >= 8
        ? await this.db.prepare("SELECT content FROM messages WHERE session_id = ? AND type = 'narrator' ORDER BY id DESC LIMIT 20 OFFSET 4").bind(sessionId).all<{content:string}>()
        : null;
      const opening = recent.results.length >= 8
        ? await this.db.prepare("SELECT content FROM messages WHERE session_id = ? AND type = 'narrator' ORDER BY id ASC LIMIT 1").bind(sessionId).first<{content:string}>()
        : null;
      const narrativeOnly = (text: string) => text.split(/\n\s*1(?:[.):]\s+|\s+[-–—]\s+|\s+)/)[0].trim();
      const priorOutcomes = earlier?.results.slice().reverse().map(item => narrativeOnly(item.content)).join('\n') ?? '';
      const system = [
        'Narrate a fast, player-led interactive story. The player is the protagonist.',
        'World: ' + world.title + '. ' + (world.description?.slice(0, 2400) ?? ''),
        'Language: ' + (user.language || 'English') + '.',
        history.length === 0 ? 'Opening: start with a concrete disruption, personal stake, and reachable goal.' : '',
        opening ? 'Opening objective and established facts: ' + narrativeOnly(opening.content) : '',
        priorOutcomes ? 'Earlier confirmed scenes, oldest first (later outcomes override earlier ones):\n' + priorOutcomes : '',
        'Write 35-65 words of story in at most four sentences and two short paragraphs. On later turns, begin with the concrete consequence of the player action and advance the established goal.',
        'Treat player messages as attempted actions, not evidence that their premises are true. Ground people AND objects in confirmed narration. Suggested choices are possibilities, not completed events.',
        'Track who is present, possessions, where objects were left, injuries, promises, resolved questions, and elapsed time. Lost, spent, abandoned or destroyed objects remain unavailable until plausibly recovered. Never invent carried valuables, relatives, or convenient tools to make an action succeed. Introduce new scene details through an observable discovery, not a retroactive claim.',
        'When a premise is unsupported, briefly show the failed attempt in-world and continue using established means. Do not turn denial into a convenient replacement of the same item. Preserve character testimony; label uncertainty or a changed account explicitly. Advance time when actions take time.',
        'Keep the world’s central dilemma alive through meaningful consequences, without arbitrary delays or forced failure. Preserve costs and allies after a success; do not immediately resolve the whole arc. Never offer an already completed action or answered question unless the situation has changed. Vary dialogue, observation and action according to the genre; do not force a psychological story into a thriller.',
        'End with exactly three distinct choices on separate lines in the format "1. Action — risk or cost cue", then 2. and 3. Use at most six words for the action and four for its cue. Hints describe stakes, not guaranteed outcomes. Choices must use available people and objects. No Markdown, outcome spoilers, question, option list, or "Now you can" sentence in the story prose.'
      ].filter(Boolean).join('\n');
      const aiRequest = { messages: [{ role: 'system' as const, content: system }, ...history, { role: 'user' as const, content: modelMessage }], temperature: 0.8, maxTokens: 1400 };
      const saveTurn = async (reply: string) => {
        // Every write is fenced by attempt ownership. D1 executes the batch
        // atomically, so an expired worker cannot append after a retry takes over.
        const ownsLease = 'EXISTS (SELECT 1 FROM story_turn_locks WHERE session_id = ? AND request_id = ?)';
        const writes = [
          this.db.prepare(`INSERT INTO messages (session_id, type, content, chapter_number) SELECT ?, 'user', ?, 1 WHERE ${ownsLease}`).bind(sessionId, message, sessionId, lockId),
          this.db.prepare(`INSERT INTO messages (session_id, type, content, chapter_number) SELECT ?, 'narrator', ?, 1 WHERE ${ownsLease}`).bind(sessionId, reply, sessionId, lockId),
          this.db.prepare(`UPDATE sessions SET updated_at = CURRENT_TIMESTAMP WHERE id = ? AND ${ownsLease}`).bind(sessionId, sessionId, lockId),
        ];
        if (requestId) writes.push(this.db.prepare(`INSERT INTO interaction_requests (session_id, request_id, response) SELECT ?, ?, ? WHERE ${ownsLease}`).bind(sessionId, requestId, reply, sessionId, lockId));
        writes.push(this.db.prepare('DELETE FROM story_turn_locks WHERE session_id = ? AND request_id = ?').bind(sessionId, lockId));
        const results = await this.db.batch(writes);
        if (!results[0].meta.changes) throw new Error('Story turn lease was replaced');
      };
      if (request.headers.get('Accept')?.includes('text/event-stream') && this.ai.canStream()) {
        const encoder = new TextEncoder();
        const stream = new ReadableStream<Uint8Array>({
          start: controller => {
            const send = (value: object) => {
              try { controller.enqueue(encoder.encode(`data: ${JSON.stringify(value)}\n\n`)); }
              catch { /* The reader left; still finish and save the turn. */ }
            };
            const work = (async () => {
              try {
                const source = await this.ai.streamText(aiRequest);
                const reader = source.getReader();
                const decoder = new TextDecoder();
                let buffer = '';
                let reply = '';
                let timedOut = false;
                const timeout = setTimeout(() => { timedOut = true; void reader.cancel(); }, 35000);
                try {
                  while (true) {
                    const { done, value } = await reader.read();
                    if (done) break;
                    buffer += decoder.decode(value, { stream: true }).replace(/\r\n/g, '\n');
                    let boundary: number;
                    while ((boundary = buffer.indexOf('\n\n')) !== -1) {
                      const event = buffer.slice(0, boundary);
                      buffer = buffer.slice(boundary + 2);
                      for (const line of event.split('\n')) {
                        if (!line.startsWith('data:')) continue;
                        const raw = line.slice(5).trim();
                        if (raw === '[DONE]') continue;
                        let delta = '';
                        try { delta = JSON.parse(raw)?.choices?.[0]?.delta?.content ?? ''; } catch { /* Ignore malformed intermediary events. */ }
                        if (typeof delta === 'string' && delta) {
                          reply += delta;
                          send({ delta });
                        }
                      }
                    }
                  }
                } finally { clearTimeout(timeout); }
                if (timedOut || !reply.trim()) throw new Error('Incomplete story stream');
                await saveTurn(reply.trim());
                send({ response: reply.trim(), done: true });
              } catch {
                await unlock().catch(() => {});
                send({ error: 'The story could not continue. Try your move again.' });
              } finally {
                try { controller.close(); } catch { /* Reader already left. */ }
              }
            })();
            ctx?.waitUntil(work);
          },
        });
        return new Response(stream, { headers: { 'Content-Type': 'text/event-stream', 'Cache-Control': 'no-store', 'Access-Control-Allow-Origin': '*' } });
      }
      let response: string;
      try {
        let timeout: ReturnType<typeof setTimeout> | undefined;
        try {
          response = (await Promise.race([
            this.ai.generateText(aiRequest),
            new Promise<never>((_, reject) => { timeout = setTimeout(() => reject(new Error('AI timeout')), 25000); }),
          ])).content.trim();
        } finally { if (timeout) clearTimeout(timeout); }
        if (!response) throw new Error('Empty story response');
      } catch (error) {
        await unlock();
        Logger.error('Story generation failed', undefined, { component: 'StoryInteractionRouter', operation: 'INTERACT', sessionId, metadata: { provider: this.ai.getProviderName() } });
        return createErrorResponse('The story could not continue. Try your move again.', 502, 'Story Unavailable');
      }
      try {
        await saveTurn(response);
      } catch (error) {
        await unlock();
        if (requestId) {
          const saved = await this.db.prepare('SELECT response FROM interaction_requests WHERE session_id = ? AND request_id = ?').bind(sessionId, requestId).first<{response:string}>();
          if (saved) return this.completedResponse(request, saved.response);
        }
        Logger.error('Story save failed', error, { component: 'StoryInteractionRouter', operation: 'INTERACT', sessionId });
        return createErrorResponse('Could not save your move. Please try again.', 500);
      }
      return this.completedResponse(request, response);
    } catch (error) {
      await unlock().catch(() => {});
      Logger.error('Story preparation failed', error, { component: 'StoryInteractionRouter', sessionId });
      return createErrorResponse('Could not continue your story. Please try again.', 500);
    }
  }
}
