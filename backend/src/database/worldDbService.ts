import { World } from './db-types';
import { Logger } from '../utils/logger';
// type D1Database should be provided by your environment (e.g., Cloudflare D1)

export class WorldDbService {
  constructor(private db: D1Database) {
    Logger.info('WorldDbService initialized', {
      component: 'WorldDbService',
      operation: 'INIT'
    });
  }

  async getWorldById(worldId: string): Promise<World | null> {
    return await this.db
      .prepare('SELECT * FROM worlds WHERE id = ?')
      .bind(worldId)
      .first<World>();
  }

  async getWorldByIdForUser(worldId: string, userId: number): Promise<World | null> {
    return await this.db
      .prepare('SELECT * FROM worlds WHERE id = ? AND creator_id = ?')
      .bind(worldId, userId)
      .first<World>();
  }

  async getAllWorlds(): Promise<World[]> {
    const result = await this.db
      .prepare('SELECT * FROM worlds ORDER BY id ASC')
      .all<World>();
    return result.results || [];
  }

  async getWorldsForUser(userId: number): Promise<World[]> {
    const result = await this.db
      .prepare('SELECT * FROM worlds WHERE creator_id = ? ORDER BY updated_at DESC, created_at DESC')
      .bind(userId)
      .all<World>();
    return result.results || [];
  }

  async createWorld(id: string, creatorId: number | null, title: string, description?: string): Promise<World> {
    const result = await this.db
      .prepare(
        'INSERT INTO worlds (id, creator_id, title, description, created_at, updated_at) VALUES (?, ?, ?, ?, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP) RETURNING *'
      )
      .bind(id, creatorId, title, description || null)
      .first<World>();
    if (!result) {
      throw new Error('Failed to create world');
    }
    return result;
  }

  async updateWorldDescription(worldId: string, description: string | null): Promise<World | null> {
    const result = await this.db
      .prepare('UPDATE worlds SET description = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ? RETURNING *')
      .bind(description, worldId)
      .first<World>();
    return result || null;
  }

  async updateWorldDescriptionForUser(worldId: string, userId: number, description: string | null): Promise<World | null> {
    const result = await this.db
      .prepare(
        'UPDATE worlds SET description = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ? AND creator_id = ? RETURNING *'
      )
      .bind(description, worldId, userId)
      .first<World>();
    return result || null;
  }

  async updateWorldForUser(
    worldId: string,
    userId: number,
    updates: { title?: string; description?: string | null }
  ): Promise<World | null> {
    const setClauses: string[] = [];
    const bindings: unknown[] = [];

    if (typeof updates.title === 'string') {
      setClauses.push('title = ?');
      bindings.push(updates.title);
    }

    if ('description' in updates) {
      setClauses.push('description = ?');
      bindings.push(updates.description ?? null);
    }

    if (setClauses.length === 0) {
      return await this.getWorldByIdForUser(worldId, userId);
    }

    setClauses.push('updated_at = CURRENT_TIMESTAMP');
    bindings.push(worldId, userId);

    const result = await this.db
      .prepare(`UPDATE worlds SET ${setClauses.join(', ')} WHERE id = ? AND creator_id = ? RETURNING *`)
      .bind(...bindings)
      .first<World>();
    return result || null;
  }
}
