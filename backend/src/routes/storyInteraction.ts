import { AIServiceManager, GeminiProvider, HuggingFaceProvider, WorkersAiProvider } from '../ai';
import { WorldDbService, SessionDbService } from '../database';
import { User } from '../database/db-types';
import { Env } from '../routes';
import { createErrorResponse, createJsonResponse } from '../utils/response';
import { generateSessionId, isValidSessionId, isValidWorldId } from '../utils/validation';
import { sanitizeInput } from '../utils/sanitization';
import { Logger } from '../utils/logger';
import { withinRateLimit } from '../utils/rateLimit';

import { initialStoryState, structuredStoryPrompt, validateStoryTurn, readStoredTurn, renderTurn, StoryState, InvalidStoryTurn } from '../story/state';

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

  private completedResponse(request: Request, stored: string) {
    const turn = readStoredTurn(stored);
    const payload = turn ? { response: renderTurn(turn), turn } : { response: stored };
    if (request.headers.get('Accept')?.includes('text/event-stream')) {
      return new Response(`data: ${JSON.stringify({ ...payload, done: true })}\n\n`, {
        headers: { 'Content-Type': 'text/event-stream', 'Cache-Control': 'no-store', 'Access-Control-Allow-Origin': '*' },
      });
    }
    return createJsonResponse(payload);
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
      const savedState = await this.db.prepare('SELECT version, state_json FROM session_story_state WHERE session_id = ?').bind(sessionId).first<{version:number;state_json:string}>();
      const sceneState: StoryState | null = savedState ? JSON.parse(savedState.state_json) : recent.results.length === 0 ? initialStoryState(world.id) : null;
      if (sceneState && savedState && sceneState.version !== savedState.version) throw new Error('Invalid saved state version');
      const modelMessage = recent.results.length === 0 && message === '-' ? 'Begin the story with an immediate situation and a choice.' : message;
      const history = [...recent.results].reverse().filter(item => !(item.type === 'user' && item.content === '-')).map(item => ({ role: item.type === 'narrator' ? 'assistant' as const : 'user' as const, content: (readStoredTurn(item.content) ? renderTurn(readStoredTurn(item.content)!) : item.content).slice(0, 1600) }));
      // Keep confirmed outcomes, never an action-only summary: rejected premises
      // in user input are not facts. Include the opening plus recent older scenes.
      const earlier = !sceneState && recent.results.length >= 8
        ? await this.db.prepare("SELECT content FROM messages WHERE session_id = ? AND type = 'narrator' ORDER BY id DESC LIMIT 8 OFFSET 4").bind(sessionId).all<{content:string}>()
        : null;
      const opening = !sceneState && recent.results.length >= 8
        ? await this.db.prepare("SELECT content FROM messages WHERE session_id = ? AND type = 'narrator' ORDER BY id ASC LIMIT 1").bind(sessionId).first<{content:string}>()
        : null;
      const narrativeOnly = (text: string) => text.split(/\n\s*1(?:[.):]\s+|\s+[-–—]\s+|\s+)/)[0].trim();
      const priorOutcomes = earlier?.results.slice().reverse().map(item => narrativeOnly(item.content).slice(0, 180)).join('\n') ?? '';
      const system = sceneState ? [
        'Narrate a compact, player-led interactive story.',
        'World: ' + world.title + '. ' + (world.description?.slice(0, 2400) ?? ''),
        'Language: ' + (user.language || 'English') + '.',
        structuredStoryPrompt(sceneState, world.id),
      ].join('\n') : [
        'Narrate a fast, player-led interactive story. The player is the protagonist.',
        'World: ' + world.title + '. ' + (world.description?.slice(0, 2400) ?? ''),
        'Language: ' + (user.language || 'English') + '.',
        history.length === 0 ? 'Opening: start with a concrete disruption, personal stake, and reachable goal.' : '',
        opening ? 'Opening objective and established facts: ' + narrativeOnly(opening.content) : '',
        priorOutcomes ? 'Earlier confirmed scenes, oldest first (later outcomes override earlier ones):\n' + priorOutcomes : '',
        'Write 35-65 words in two short paragraphs. Begin later turns with the consequence of the player action; advance the goal.',
        'Player messages are attempts, not established facts. Keep people, possessions, locations, losses, promises and elapsed time consistent with confirmed narration. If an action relies on something absent, show the failed attempt briefly and continue with established means. Suggested choices have not happened.',
        'Keep the central dilemma alive. Make successes and costs matter. Do not repeat completed actions, invent convenient tools, or contradict earlier outcomes. Match the world’s genre.',
        'End with exactly three distinct numbered choices on separate lines: "1. Action — risk or cost cue". Actions use at most six words; cues at most four. No Markdown, outcome spoilers, question, or "Now you can" prose.'
      ].filter(Boolean).join('\n');
      const aiRequest = { messages: [{ role: 'system' as const, content: system }, ...history, { role: 'user' as const, content: modelMessage }], temperature: 0.8, maxTokens: sceneState ? 1800 : 1400, structured: Boolean(sceneState) };
      const saveTurn = async (reply: string, nextState?: StoryState) => {
        // Every write is fenced by attempt ownership. D1 executes the batch
        // atomically, so an expired worker cannot append after a retry takes over.
        // State version and lease ownership are tested inside the atomic batch.
        // The version is a server-validated integer, never model-provided SQL.
        const expectedVersion = savedState?.version;
        if (expectedVersion !== undefined && !Number.isSafeInteger(expectedVersion)) throw new Error('Invalid state version');
        const versionGuard = sceneState ? (expectedVersion === undefined
          ? ' AND NOT EXISTS (SELECT 1 FROM session_story_state WHERE session_id = story_turn_locks.session_id)'
          : ` AND EXISTS (SELECT 1 FROM session_story_state WHERE session_id = story_turn_locks.session_id AND version = ${expectedVersion})`) : '';
        const ownsLease = `EXISTS (SELECT 1 FROM story_turn_locks WHERE session_id = ? AND request_id = ?${versionGuard})`;
        const writes = [
          this.db.prepare(`INSERT INTO messages (session_id, type, content, chapter_number) SELECT ?, 'user', ?, 1 WHERE ${ownsLease}`).bind(sessionId, message, sessionId, lockId),
          this.db.prepare(`INSERT INTO messages (session_id, type, content, chapter_number) SELECT ?, 'narrator', ?, 1 WHERE ${ownsLease}`).bind(sessionId, reply, sessionId, lockId),
          this.db.prepare(`UPDATE sessions SET updated_at = CURRENT_TIMESTAMP WHERE id = ? AND ${ownsLease}`).bind(sessionId, sessionId, lockId),
        ];
        if (requestId) writes.push(this.db.prepare(`INSERT INTO interaction_requests (session_id, request_id, response) SELECT ?, ?, ? WHERE ${ownsLease}`).bind(sessionId, requestId, reply, sessionId, lockId));
        if (nextState) writes.push(this.db.prepare(`INSERT INTO session_story_state (session_id, version, state_json)
          SELECT ?, ?, ? WHERE ${ownsLease}
          ON CONFLICT(session_id) DO UPDATE SET version = excluded.version, state_json = excluded.state_json`)
          .bind(sessionId, nextState.version, JSON.stringify(nextState), sessionId, lockId));
        writes.push(this.db.prepare('DELETE FROM story_turn_locks WHERE session_id = ? AND request_id = ?').bind(sessionId, lockId));
        const results = await this.db.batch(writes);
        if (!results[0].meta.changes) throw new Error('Story turn lease was replaced');
      };
      if (!sceneState && request.headers.get('Accept')?.includes('text/event-stream') && this.ai.canStream()) {
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
      let nextState: StoryState | undefined;
      try {
        let timeout: ReturnType<typeof setTimeout> | undefined;
        try {
          response = (await Promise.race([
            this.ai.generateText(aiRequest),
            new Promise<never>((_, reject) => { timeout = setTimeout(() => reject(new Error('AI timeout')), 25000); }),
          ])).content.trim();
        } finally { if (timeout) clearTimeout(timeout); }
        if (!response) throw new Error('Empty story response');
        if (sceneState) {
          const validated = validateStoryTurn(response, sceneState);
          nextState = validated.state;
          response = JSON.stringify(validated.turn);
        }
      } catch (error) {
        await unlock();
        Logger.error('Story generation failed', undefined, { component: 'StoryInteractionRouter', operation: 'INTERACT', sessionId, metadata: { provider: this.ai.getProviderName(), invalidTurn: error instanceof InvalidStoryTurn, reason: error instanceof InvalidStoryTurn ? error.message : undefined } });
        return createErrorResponse('The story could not continue. Try your move again.', 502, 'Story Unavailable');
      }
      try {
        await saveTurn(response, nextState);
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
