import { DatabaseSync } from 'node:sqlite';
import { readFileSync } from 'node:fs';
import { afterEach, beforeEach, expect, test, vi } from 'vitest';
import { StoryInteractionRouter } from '../src/routes/storyInteraction';
import { AIServiceManager } from '../src/ai';
import { initialStoryState, renderTurn } from '../src/story/state';

let sqlite: DatabaseSync;
let router: StoryInteractionRouter;
const user = { id: 1, language: 'English' } as any;
const session = 'session_11111111-1111-1111-1111-111111111111';
const reply = 'The scarf remains tied below.\n\n1. Call — attract attention\n2. Wait — lose time\n3. Climb — risk slipping';

beforeEach(() => {
  sqlite = new DatabaseSync(':memory:');
  sqlite.exec(readFileSync(new URL('../schema.sql', import.meta.url), 'utf8'));
  sqlite.exec(`INSERT INTO users (id, google_id, email, name) VALUES (1, 'guest', 'guest@test', 'Reader');
    INSERT INTO worlds (id, title) VALUES ('titanic', 'The Titanic');
    INSERT INTO sessions (id, user_id, world_id) VALUES ('${session}', 1, 'titanic');
    INSERT INTO messages (session_id, type, content) VALUES ('${session}', 'narrator', 'Legacy opening');`);
  const db = {
    prepare(sql: string) {
      let values: any[] = [];
      const statement = {
        bind(...args: any[]) { values = args; return statement; },
        async first() { return sqlite.prepare(sql).get(...values) ?? null; },
        async all() { return { results: sqlite.prepare(sql).all(...values) }; },
        async run() { return { meta: { changes: Number(sqlite.prepare(sql).run(...values).changes) } }; },
      };
      return statement;
    },
    async batch(statements: any[]) {
      sqlite.exec('BEGIN');
      try { const result = []; for (const statement of statements) result.push(await statement.run()); sqlite.exec('COMMIT'); return result; }
      catch (error) { sqlite.exec('ROLLBACK'); throw error; }
    },
  };
  router = new StoryInteractionRouter({ DB: db, AI: {} } as any);
  vi.spyOn(AIServiceManager.prototype, 'generateText').mockResolvedValue({ content: reply });
  vi.spyOn(AIServiceManager.prototype, 'canStream').mockReturnValue(false);
});
afterEach(() => { vi.restoreAllMocks(); sqlite.close(); });
function turn(id = crypto.randomUUID(), accept = 'application/json', message = 'Call for help', sessionId = session) {
  return router.route(new Request(`http://localhost/sessions/${sessionId}/interact`, {
    method: 'POST', headers: { 'Content-Type': 'application/json', Accept: accept }, body: JSON.stringify({ message, requestId: id }),
  }), user) as Promise<Response>;
}
function count() { return sqlite.prepare("SELECT COUNT(*) AS n FROM messages WHERE content != 'Legacy opening'").get()!.n; }

test('saved turns replay in SSE and JSON without generating or saving twice', async () => {
  const id = crypto.randomUUID();
  expect((await turn(id)).status).toBe(200);
  const sse = await turn(id, 'text/event-stream');
  expect(sse.headers.get('Content-Type')).toContain('text/event-stream');
  expect(await sse.text()).toBe(`data: ${JSON.stringify({ response: reply, done: true })}\n\n`);
  expect(await (await turn(id)).json()).toEqual({ response: reply });
  expect(count()).toBe(2);
  expect(AIServiceManager.prototype.generateText).toHaveBeenCalledTimes(1);
});

test('an active retry cannot generate twice; an abandoned lease recovers after expiry', async () => {
  const id = crypto.randomUUID();
  sqlite.prepare('INSERT INTO story_turn_locks VALUES (?, ?, ?)').run(session, id, Date.now() + 60000);
  expect((await turn(id)).status).toBe(409);
  expect(count()).toBe(0);
  sqlite.prepare('UPDATE story_turn_locks SET expires_at = ?').run(Date.now() - 1);
  expect((await turn(id)).status).toBe(200);
  expect(count()).toBe(2);
});

test('late generation cannot save or unlock a replacement attempt', async () => {
  let resolve!: (value: { content: string }) => void;
  vi.mocked(AIServiceManager.prototype.generateText).mockImplementationOnce(() => new Promise(r => { resolve = r; }));
  const pending = turn();
  await vi.waitFor(() => expect(resolve).toBeTypeOf('function'));
  const lock = sqlite.prepare('SELECT * FROM story_turn_locks').get()!;
  expect(Number(lock.expires_at) - Date.now()).toBeLessThanOrEqual(60000);
  sqlite.prepare('UPDATE story_turn_locks SET request_id = ?').run('replacement-attempt');
  resolve({ content: reply });
  expect((await pending).status).toBe(500);
  expect(count()).toBe(0);
  expect(sqlite.prepare('SELECT request_id FROM story_turn_locks').get()!.request_id).toBe('replacement-attempt');
});

test('provider failure releases the lease for immediate retry', async () => {
  vi.mocked(AIServiceManager.prototype.generateText).mockRejectedValueOnce(new Error('provider unavailable'));
  const id = crypto.randomUUID();
  expect((await turn(id)).status).toBe(502);
  expect((await turn(id)).status).toBe(200);
  expect(count()).toBe(2);
});

test('old-session activity cannot undo a restart, including same-second creation', async () => {
  const restarted = 'session_22222222-2222-2222-2222-222222222222';
  sqlite.prepare('INSERT INTO sessions (id, user_id, world_id) VALUES (?, 1, ?)').run(restarted, 'titanic');
  expect((await turn()).status).toBe(200);
  sqlite.prepare('UPDATE sessions SET updated_at = ? WHERE id = ?').run('2099-01-01', session);
  const resumed = await router.route(new Request('http://localhost/sessions/resume?worldId=titanic'), user);
  expect((await resumed!.json() as any).session.sessionId).toBe(restarted);
});

test('older memory preserves outcomes without promoting rejected actions or unchosen choices', async () => {
  for (let i = 0; i < 6; i++) {
    sqlite.prepare("INSERT INTO messages (session_id, type, content) VALUES (?, 'user', ?)").run(session, i === 0 ? 'I use invented gold coins' : 'I listen');
    sqlite.prepare("INSERT INTO messages (session_id, type, content) VALUES (?, 'narrator', ?)").run(session, i === 0 ? 'You have no coins. Your scarf stays on the rail.\n1 Wave the scarf\n2 Leave' : 'The steward waits.\n1. Listen\n2. Leave');
  }
  await turn();
  const prompt = vi.mocked(AIServiceManager.prototype.generateText).mock.calls[0][0].messages[0].content;
  expect(prompt).toContain('You have no coins. Your scarf stays on the rail.');
  expect(prompt).not.toContain('I use invented gold coins');
  expect(prompt).not.toContain('Wave the scarf');
});

const structuredReply = {
  scene: 'The gate is closed. You can hear voices beyond it.',
  choices: [
    { label: 'Call for help', action: 'I call for help', riskCue: 'attract attention', requires: ['player'] },
    { label: 'Inspect the gate', action: 'I inspect the gate', riskCue: 'costs time', requires: [] },
    { label: 'Wait', action: 'I wait', riskCue: 'delay', requires: [] },
  ], changes: [], elapsedMinutes: 1,
};
function freshStructured() {
  sqlite.exec('DELETE FROM messages');
  vi.mocked(AIServiceManager.prototype.generateText).mockResolvedValue({ content: JSON.stringify(structuredReply) });
}

test('new stories use exactly one non-streaming call and persist validated state with structured choices', async () => {
  freshStructured();
  const id = crypto.randomUUID();
  const response = await turn(id, 'text/event-stream', '-');
  expect(response.status).toBe(200);
  const payload = JSON.parse((await response.text()).slice(6).trim());
  expect(payload.turn.scene).toBe(structuredReply.scene);
  expect(payload.response).toBe(renderTurn(payload.turn));
  const saved = sqlite.prepare('SELECT * FROM session_story_state').get()!;
  expect(saved.version).toBe(1);
  expect(JSON.parse(String(saved.state_json)).minutes).toBe(1);
  const request = vi.mocked(AIServiceManager.prototype.generateText).mock.calls[0][0];
  expect(request.structured).toBe(true);
  expect(request.messages[0].content).toContain('AUTHORITATIVE STATE');
  expect(AIServiceManager.prototype.generateText).toHaveBeenCalledTimes(1);
  const replay = await (await turn(id)).json() as any;
  expect(replay.turn).toEqual(payload.turn);
  expect(AIServiceManager.prototype.generateText).toHaveBeenCalledTimes(1);
  const resumed = await router.route(new Request('http://localhost/sessions/resume?worldId=titanic'), user);
  const history = await resumed!.json() as any;
  expect(JSON.parse(history.messages[1].content)).toEqual(payload.turn);
  expect(count()).toBe(2);
});

test('invalid changes do not write messages, request receipts or state and retry uses the same ID', async () => {
  freshStructured();
  vi.mocked(AIServiceManager.prototype.generateText).mockResolvedValueOnce({ content: JSON.stringify({ ...structuredReply, changes: [{ op: 'move', id: 'invented_gold', from: 'player', to: 'scene' }] }) });
  const id = crypto.randomUUID();
  expect((await turn(id)).status).toBe(502);
  expect(count()).toBe(0);
  expect(sqlite.prepare('SELECT COUNT(*) AS n FROM session_story_state').get()!.n).toBe(0);
  expect(sqlite.prepare('SELECT COUNT(*) AS n FROM interaction_requests').get()!.n).toBe(0);
  expect(sqlite.prepare('SELECT COUNT(*) AS n FROM story_turn_locks').get()!.n).toBe(0);
  expect((await turn(id)).status).toBe(200);
  expect(count()).toBe(2);
});

test('state is supplied after the originating turn leaves the recent dialogue window', async () => {
  const state = initialStoryState('titanic');
  state.version = 8;
  state.entities.scarf = { id: 'scarf', kind: 'item', name: 'Scarf', at: 'scene', condition: 'inaccessible' };
  sqlite.prepare('INSERT INTO session_story_state VALUES (?, ?, ?)').run(session, 8, JSON.stringify(state));
  for (let i = 0; i < 10; i++) sqlite.prepare("INSERT INTO messages (session_id, type, content) VALUES (?, 'narrator', ?)").run(session, 'The boat moves.');
  vi.mocked(AIServiceManager.prototype.generateText).mockResolvedValue({ content: JSON.stringify(structuredReply) });
  expect((await turn()).status).toBe(200);
  const prompt = vi.mocked(AIServiceManager.prototype.generateText).mock.calls[0][0].messages[0].content;
  expect(prompt).toContain('"scarf"');
  expect(prompt).toContain('"condition":"inaccessible"');
  expect(sqlite.prepare('SELECT version FROM session_story_state').get()!.version).toBe(9);
});

test('failed persistence rolls back state together with messages and receipts', async () => {
  freshStructured();
  sqlite.exec("CREATE TRIGGER fail_state BEFORE INSERT ON session_story_state BEGIN SELECT RAISE(ABORT, 'injected state write failure'); END;");
  expect((await turn()).status).toBe(500);
  expect(count()).toBe(0);
  expect(sqlite.prepare('SELECT COUNT(*) AS n FROM interaction_requests').get()!.n).toBe(0);
});

test('a changed state version rejects a late generated turn without partial writes', async () => {
  freshStructured();
  let resolve!: (value: { content: string }) => void;
  vi.mocked(AIServiceManager.prototype.generateText).mockImplementationOnce(() => new Promise(r => { resolve = r; }));
  const pending = turn();
  await vi.waitFor(() => expect(resolve).toBeTypeOf('function'));
  const state = initialStoryState('titanic'); state.version = 1;
  sqlite.prepare('INSERT INTO session_story_state VALUES (?, ?, ?)').run(session, 1, JSON.stringify(state));
  resolve({ content: JSON.stringify(structuredReply) });
  expect((await pending).status).toBe(500);
  expect(count()).toBe(0);
  expect(sqlite.prepare('SELECT state_json FROM session_story_state').get()!.state_json).toBe(JSON.stringify(state));
});
