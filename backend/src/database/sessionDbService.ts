import { Session } from './db-types';
import { Logger } from '../utils/logger';
// type D1Database should be provided by your environment (e.g., Cloudflare D1)

export class SessionDbService {
  constructor(private db: D1Database) {
    Logger.info('SessionDbService initialized', {
      component: 'SessionDbService',
      operation: 'INIT'
    });
  }
  async createSession(sessionId: string, userId: number, worldId: string): Promise<Session> {
    const result = await this.db
      .prepare('INSERT INTO sessions (id, user_id, world_id) VALUES (?, ?, ?) RETURNING *')
      .bind(sessionId, userId, worldId)
      .first<Session>();
    if (!result) {
      throw new Error('Failed to create session');
    }
    return result;
  }

  async getSessionById(sessionId: string): Promise<Session | null> {
    return await this.db
      .prepare('SELECT * FROM sessions WHERE id = ?')
      .bind(sessionId)
      .first<Session>();
  }

  async getSessionWithUser(sessionId: string, userId: number): Promise<Session | null> {
    return await this.db
      .prepare('SELECT * FROM sessions WHERE id = ? AND user_id = ?')
      .bind(sessionId, userId)
      .first<Session>();
  }

  async touchSession(sessionId: string): Promise<void> {
    await this.db
      .prepare('UPDATE sessions SET updated_at = CURRENT_TIMESTAMP WHERE id = ?')
      .bind(sessionId)
      .run();
  }
}
