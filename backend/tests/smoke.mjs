#!/usr/bin/env node
/**
 * Local API smoke test. It creates private fixture users/worlds in the local D1
 * database and deliberately never logs credentials or bearer tokens.
 *
 *   node tests/smoke.mjs
 *   BASE_URL=http://127.0.0.1:8787 node tests/smoke.mjs
 *   LIVE_AI=1 node tests/smoke.mjs
 */
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';

const configuredBase = process.env.BASE_URL || 'http://127.0.0.1:8787';
const base = new URL(configuredBase);
const localHosts = new Set(['localhost', '127.0.0.1', '[::1]']);

if (!localHosts.has(base.hostname)) {
  throw new Error('BASE_URL must use localhost, 127.0.0.1, or ::1. Refusing non-local requests.');
}
if (!['http:', 'https:'].includes(base.protocol)) {
  throw new Error('BASE_URL must use HTTP or HTTPS.');
}
base.pathname = base.pathname.replace(/\/$/, '');
base.search = '';
base.hash = '';

const fixtureIp = '127.0.0.2';
const runId = randomUUID().replace(/-/g, '').slice(0, 16);
const accountUsername = `smoke_${runId}`;
const accountPassword = `smoke-password-${randomUUID()}`;
const privateTitle = `Smoke private ${runId}`;

function check(condition, message) {
  assert.ok(condition, message);
}

async function request(path, { method = 'GET', token, body, headers = {} } = {}) {
  const requestHeaders = { 'CF-Connecting-IP': fixtureIp, ...headers };
  if (token) requestHeaders.Authorization = `Bearer ${token}`;
  let payload;
  if (body !== undefined) {
    payload = typeof body === 'string' ? body : JSON.stringify(body);
    requestHeaders['Content-Type'] = requestHeaders['Content-Type'] || 'application/json';
  }
  const response = await fetch(new URL(path, base), {
    method,
    headers: requestHeaders,
    body: payload,
    signal: AbortSignal.timeout(40000),
  });
  const text = await response.text();
  let json = null;
  if (text) {
    try { json = JSON.parse(text); } catch { /* Some failure responses need no JSON assertion. */ }
  }
  return { status: response.status, json };
}

function expectStatus(result, status, label) {
  check(result.status === status, `${label}: expected HTTP ${status}, received ${result.status}`);
  return result.json;
}

function tokenFrom(payload, label) {
  check(typeof payload?.token === 'string' && payload.token.length > 20, `${label}: missing session token`);
  return payload.token;
}

async function createGuest(label) {
  const payload = expectStatus(await request('/auth/guest', { method: 'POST' }), 200, `${label} guest`);
  const token = tokenFrom(payload, `${label} guest`);
  check(payload.user?.isGuest === true, `${label} should be a guest`);
  return { token, userId: payload.user.id };
}

async function runDefaultSmoke() {
  const health = expectStatus(await request('/health'), 200, 'health');
  check(health?.status === 'healthy', 'health response should be healthy');

  const tooLarge = await request('/auth/guest', {
    method: 'POST',
    body: JSON.stringify({ padding: 'x'.repeat(16_384) }),
  });
  expectStatus(tooLarge, 413, 'body limit');

  const first = await createGuest('first');
  const updatedFirst = expectStatus(await request('/profile', {
    method: 'PUT', token: first.token, body: { name: 'Smoke First' },
  }), 200, 'first profile update');
  check(updatedFirst.user?.name === 'Smoke First', 'first profile update should persist');

  const privateWorld = expectStatus(await request('/worlds', {
    method: 'POST', token: first.token,
    body: { title: privateTitle, description: 'Private smoke-test fixture.' },
  }), 200, 'private world creation');
  check(typeof privateWorld?.id === 'string', 'private world should have an ID');

  const second = await createGuest('second');
  check(second.userId !== first.userId, 'guests must have different users');
  const secondProfile = expectStatus(await request('/profile', { token: second.token }), 200, 'second profile');
  check(secondProfile.user?.name !== 'Smoke First', 'one guest profile must not expose another guest profile');
  check(!secondProfile.userWorlds?.some((world) => world.world_id === privateWorld.id), 'second guest profile must not list first guest stories');

  const secondWorlds = expectStatus(await request('/worlds', { token: second.token }), 200, 'second world list');
  check(!secondWorlds.some((world) => world.id === privateWorld.id), 'private world must not appear for another guest');
  expectStatus(await request(`/worlds/${encodeURIComponent(privateWorld.id)}`, { token: second.token }), 404, 'private world direct access');

  const registered = expectStatus(await request('/auth/register', {
    method: 'POST', token: second.token,
    body: { username: accountUsername, password: accountPassword },
  }), 200, 'optional account registration');
  check(registered.user?.isGuest === false && registered.user?.username === accountUsername, 'registration should upgrade the second guest');

  expectStatus(await request('/auth/logout', { method: 'POST', token: second.token }), 200, 'second guest logout');
  const transferred = expectStatus(await request('/auth/login', {
    method: 'POST', token: first.token,
    body: { username: accountUsername, password: accountPassword },
  }), 200, 'guest sign-in transfer');
  const accountToken = tokenFrom(transferred, 'guest sign-in transfer');
  check(transferred.user?.isGuest === false, 'sign-in transfer should return the account');

  const transferredWorlds = expectStatus(await request('/worlds', { token: accountToken }), 200, 'transferred account worlds');
  check(transferredWorlds.some((world) => world.id === privateWorld.id), 'sign-in should transfer the guest private world to the account');
  expectStatus(await request('/worlds', { token: first.token }), 401, 'original guest session after transfer');

  expectStatus(await request('/auth/logout', { method: 'POST', token: accountToken }), 200, 'account logout');
  expectStatus(await request('/auth/me', { token: accountToken }), 401, 'logged-out token');
  const signedInAgain = expectStatus(await request('/auth/login', {
    method: 'POST', body: { username: accountUsername, password: accountPassword },
  }), 200, 'account sign-in');
  const signedInToken = tokenFrom(signedInAgain, 'account sign-in');
  const returnedWorlds = expectStatus(await request('/worlds', { token: signedInToken }), 200, 'account worlds after sign-in');
  check(returnedWorlds.some((world) => world.id === privateWorld.id), 'account should retain the transferred private world after logout/sign-in');

  return { token: signedInToken, worldId: privateWorld.id };
}

async function runLiveAiSmoke({ token, worldId }) {
  const session = expectStatus(await request('/sessions/new', {
    method: 'POST', token, body: { worldId },
  }), 201, 'live AI session');
  check(typeof session?.sessionId === 'string', 'live AI session should have an ID');

  const openingRequestId = randomUUID();
  const opening = expectStatus(await request(`/sessions/${session.sessionId}/interact`, {
    method: 'POST', token, body: { message: '-', requestId: openingRequestId },
  }), 200, 'live AI opening');
  check(typeof opening?.response === 'string' && opening.response.length > 0, 'live AI opening should contain narration');

  const turnRequestId = randomUUID();
  const turnBody = { message: 'Inspect the most useful route.', requestId: turnRequestId };
  const turn = expectStatus(await request(`/sessions/${session.sessionId}/interact`, {
    method: 'POST', token, body: turnBody,
  }), 200, 'live AI turn');
  check(typeof turn?.response === 'string' && turn.response.length > 0, 'live AI turn should contain narration');
  const replay = expectStatus(await request(`/sessions/${session.sessionId}/interact`, {
    method: 'POST', token, body: turnBody,
  }), 200, 'live AI replay');
  check(replay?.response === turn.response, 'same request ID should replay the saved response');

  const concurrent = await Promise.all([
    request(`/sessions/${session.sessionId}/interact`, { method: 'POST', token, body: { message: 'Take the safer route.', requestId: randomUUID() } }),
    request(`/sessions/${session.sessionId}/interact`, { method: 'POST', token, body: { message: 'Take the faster route.', requestId: randomUUID() } }),
  ]);
  const statuses = concurrent.map((result) => result.status).sort((a, b) => a - b);
  check(statuses[0] === 200 && statuses[1] === 409, `live AI concurrency: expected [200, 409], received [${statuses.join(', ')}]`);
}

async function main() {
  const fixture = await runDefaultSmoke();
  if (process.env.LIVE_AI === '1') await runLiveAiSmoke(fixture);
  console.log(`Local smoke passed${process.env.LIVE_AI === '1' ? ' (including LIVE_AI)' : ''}.`);
}

main().catch((error) => {
  console.error(`Local smoke failed: ${error instanceof Error ? error.message : 'unknown error'}`);
  process.exitCode = 1;
});
