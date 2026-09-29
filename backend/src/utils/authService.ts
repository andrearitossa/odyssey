import { UserDbService } from '../database';
import { createErrorResponse } from './response';
import { extractBearerToken } from './auth';
import { User } from '../database/db-types';
import { tokenHash } from './password';
export class AuthService {
  constructor(private db: D1Database, private userDB: UserDbService) {}
  async authenticateUser(request: Request): Promise<User> {
    const token = extractBearerToken(request.headers.get('Authorization'));
    if (!token) throw new Error('Missing authorization header');
    const session = await this.db.prepare('SELECT user_id FROM app_sessions WHERE token_hash = ? AND expires_at > ?').bind(await tokenHash(token), new Date().toISOString()).first<{user_id: number}>();
    if (!session) throw new Error('Session expired');
    const user = await this.userDB.getUserById(session.user_id);
    if (!user) throw new Error('User not found');
    return user;
  }
  async authenticateAndAuthorize(request: Request, _context?: unknown): Promise<{user: User} | Response> {
    try { return { user: await this.authenticateUser(request) }; }
    catch { return createErrorResponse('Your session has expired. Please sign in again or continue as a guest.', 401, 'Unauthorized'); }
  }
}
