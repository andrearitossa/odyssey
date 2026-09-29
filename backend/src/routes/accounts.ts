import { UserDbService } from '../database';
import { User } from '../database/db-types';
import { AuthService } from '../utils/authService';
import { createErrorResponse, createJsonResponse } from '../utils/response';
import { equalHash, passwordHash, tokenHash } from '../utils/password';
import { extractBearerToken } from '../utils/auth';
import { withinRateLimit } from '../utils/rateLimit';

export class AccountsRouter {
  constructor(private db: D1Database, private auth: AuthService, private users: UserDbService) {}
  private async publicUser(user: User) {
    const account = await this.db.prepare('SELECT username FROM app_accounts WHERE user_id = ?').bind(user.id).first<{username:string}>();
    return { id: user.id, name: user.name, language: user.language, username: account?.username ?? null, isGuest: !account };
  }
  private async session(user: User) {
    const token = crypto.randomUUID() + crypto.randomUUID();
    await this.db.prepare('INSERT INTO app_sessions (token_hash, user_id, expires_at) VALUES (?, ?, ?)').bind(await tokenHash(token), user.id, new Date(Date.now() + 30 * 86400000).toISOString()).run();
    return createJsonResponse({ token, user: await this.publicUser(user) });
  }
  async route(request: Request): Promise<Response> {
    const path = new URL(request.url).pathname;
    if (path === '/auth/guest' && request.method === 'POST') {
      const ip = request.headers.get('CF-Connecting-IP') || 'local';
      if (!(await withinRateLimit(this.db, `guest:${ip}`, 30, 86400000))) return createErrorResponse('Too many guest profiles today. Try again tomorrow.', 429);
      const id = crypto.randomUUID();
      const user = await this.users.createUser({ google_id: `guest:${id}`, email: `${id}@guest.invalid`, name: 'Adventurer' });
      return this.session(user);
    }
    if (path === '/auth/me' && request.method === 'GET') {
      const result = await this.auth.authenticateAndAuthorize(request);
      return result instanceof Response ? result : createJsonResponse({ user: await this.publicUser(result.user) });
    }
    if (path === '/auth/logout' && request.method === 'POST') {
      const token = extractBearerToken(request.headers.get('Authorization'));
      if (token) await this.db.prepare('DELETE FROM app_sessions WHERE token_hash = ?').bind(await tokenHash(token)).run();
      return createJsonResponse({ success: true });
    }
    if ((path === '/auth/register' || path === '/auth/login') && request.method === 'POST') {
      let body: {username?: unknown; password?: unknown} | null;
      try { const input = await request.json(); body = input && typeof input === 'object' && !Array.isArray(input) ? input : null; } catch { body = null; }
      if (!body) return createErrorResponse('Enter a username and password.', 400);
      const username = typeof body.username === 'string' ? body.username.trim().toLowerCase() : '';
      const password = typeof body.password === 'string' ? body.password : '';
      if (!/^[a-z0-9_]{3,30}$/.test(username) || password.length < 10 || password.length > 128) return createErrorResponse('Use a username of 3–30 letters, numbers or underscores and a password of 10–128 characters.', 400);
      if (path === '/auth/register') {
        const result = await this.auth.authenticateAndAuthorize(request);
        if (result instanceof Response) return result;
        if (!(await this.publicUser(result.user)).isGuest) return createErrorResponse('This profile already has an account.', 409);
        const salt = crypto.randomUUID();
        const hash = await passwordHash(password, salt);
        const inserted = await this.db.prepare('INSERT OR IGNORE INTO app_accounts (user_id, username, password_hash, password_salt) VALUES (?, ?, ?, ?)').bind(result.user.id, username, hash, salt).run();
        if (!inserted.meta.changes) return createErrorResponse('That username is already taken.', 409);
        return createJsonResponse({ user: await this.publicUser(result.user) });
      }
      const now = Date.now();
      const ip = request.headers.get('CF-Connecting-IP') || 'local';
      if (!(await withinRateLimit(this.db, `login-ip:${ip}`, 30, 900000))) return createErrorResponse('Too many attempts. Try again in 15 minutes.', 429);
      const key = await tokenHash(`${ip}:${username}`);
      const attempts = await this.db.prepare('INSERT INTO login_attempts (key, attempts, reset_at) VALUES (?, 1, ?) ON CONFLICT(key) DO UPDATE SET attempts = CASE WHEN reset_at < ? THEN 1 ELSE attempts + 1 END, reset_at = CASE WHEN reset_at < ? THEN ? ELSE reset_at END RETURNING attempts').bind(key, now + 900000, now, now, now + 900000).first<{attempts:number}>();
      if ((attempts?.attempts ?? 6) > 5) return createErrorResponse('Too many attempts. Try again in 15 minutes.', 429);
      const account = await this.db.prepare('SELECT * FROM app_accounts WHERE username = ?').bind(username).first<{user_id:number; password_hash:string; password_salt:string}>();
      const hash = await passwordHash(password, account?.password_salt ?? 'missing-account');
      if (!account || !equalHash(hash, account.password_hash)) return createErrorResponse('Username or password is incorrect.', 401);
      const user = await this.users.getUserById(account.user_id);
      if (!user) return createErrorResponse('Username or password is incorrect.', 401);
      // Signing in from a guest profile keeps the stories created on this device.
      const guestToken = extractBearerToken(request.headers.get('Authorization'));
      if (guestToken) {
        const guest = await this.auth.authenticateUser(request).catch(() => null);
        if (guest && guest.id !== user.id) {
          const guestAccount = await this.db.prepare('SELECT 1 FROM app_accounts WHERE user_id = ?').bind(guest.id).first();
          if (!guestAccount) {
            const token = crypto.randomUUID() + crypto.randomUUID();
            await this.db.batch([
              this.db.prepare('UPDATE sessions SET user_id = ?, updated_at = CURRENT_TIMESTAMP WHERE user_id = ?').bind(user.id, guest.id),
              this.db.prepare('UPDATE world_owners SET user_id = ? WHERE user_id = ?').bind(user.id, guest.id),
              this.db.prepare('DELETE FROM app_sessions WHERE user_id = ?').bind(guest.id),
              this.db.prepare('INSERT INTO app_sessions (token_hash, user_id, expires_at) VALUES (?, ?, ?)').bind(await tokenHash(token), user.id, new Date(Date.now() + 30 * 86400000).toISOString()),
            ]);
            await this.db.prepare('DELETE FROM login_attempts WHERE key = ?').bind(key).run();
            return createJsonResponse({ token, user: await this.publicUser(user) });
          }
        }
      }
      await this.db.prepare('DELETE FROM login_attempts WHERE key = ?').bind(key).run();
      return this.session(user);
    }
    return createErrorResponse('Route not found', 404);
  }
}
