import { User } from './db-types';
import { Logger } from '../utils/logger';
// type D1Database should be provided by your environment (e.g., Cloudflare D1)

export class UserDbService {
  constructor(private db: D1Database) {
    Logger.info('UserDbService initialized', {
      component: 'UserDbService',
      operation: 'INIT'
    });
  }
  async getUserById(userId: number): Promise<User | null> {
    return await this.db
      .prepare('SELECT * FROM users WHERE id = ?')
      .bind(userId)
      .first<User>();
  }

  async getUserByEmail(email: string): Promise<User | null> {
    return await this.db
      .prepare('SELECT * FROM users WHERE email = ?')
      .bind(email)
      .first<User>();
  }

  async createUser(userData: {
    google_id: string;
    email: string;
    name: string;
    picture_url?: string;
    language?: string;
  }): Promise<User> {
    const result = await this.db
      .prepare(`
        INSERT INTO users (google_id, email, name, picture_url, language, last_login_at) 
        VALUES (?, ?, ?, ?, ?, CURRENT_TIMESTAMP) 
        RETURNING *
      `)
      .bind(
        userData.google_id, 
        userData.email, 
        userData.name, 
        userData.picture_url || null,
        userData.language || 'English'
      )
      .first<User>();
    if (!result) {
      throw new Error('Failed to create user');
    }
    return result;
  }

  async updateUser(userId: number, updates: {
    email?: string;
    name?: string;
    picture_url?: string;
    language?: string;
    last_login_at?: string;
  }): Promise<User> {
    const setClause = Object.keys(updates).map(key => `${key} = ?`).join(', ');
    const values = Object.values(updates);
    const result = await this.db
      .prepare(`
        UPDATE users 
        SET ${setClause}, updated_at = CURRENT_TIMESTAMP 
        WHERE id = ? 
        RETURNING *
      `)
      .bind(...values, userId)
      .first<User>();
    if (!result) {
      throw new Error('Failed to update user or user not found');
    }
    return result;
  }

  async updateUserLastSeen(userId: number): Promise<void> {
    await this.db
      .prepare('UPDATE users SET last_seen_at = CURRENT_TIMESTAMP WHERE id = ?')
      .bind(userId)
      .run();
  }

  async cleanupExpiredUsers(): Promise<number> {
    const result = await this.db
      .prepare('DELETE FROM users WHERE expires_at <= CURRENT_TIMESTAMP')
      .run();
    return result.meta.changes || 0;
  }

  async getUserSessionsWithWorlds(userId: number): Promise<Array<{
    session_id: string;
    world_id: string;
    world_title: string;
    world_description: string | null;
    created_at: string;
    updated_at: string;
  }>> {
    const result = await this.db
      .prepare(`
        SELECT 
          s.id as session_id,
          w.id as world_id,
          w.title as world_title,
          w.description as world_description,
          s.created_at,
          s.updated_at
        FROM sessions s
        JOIN worlds w ON s.world_id = w.id
        WHERE s.user_id = ?
        ORDER BY s.updated_at DESC
      `)
      .bind(userId)
      .all();
    return result.results as Array<{
      session_id: string;
      world_id: string;
      world_title: string;
      world_description: string | null;
      created_at: string;
      updated_at: string;
    }>;
  }
}
