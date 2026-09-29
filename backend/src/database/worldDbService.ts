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
  async getWorldById(worldId: string, userId: number): Promise<World | null> {
    return await this.db
      .prepare('SELECT w.* FROM worlds w LEFT JOIN world_owners o ON o.world_id = w.id WHERE w.id = ? AND (o.user_id IS NULL OR o.user_id = ? OR EXISTS (SELECT 1 FROM sessions s WHERE s.world_id = w.id AND s.user_id = ?))')
      .bind(worldId, userId, userId)
      .first<World>();
  }

  async getAllWorlds(userId: number): Promise<World[]> {
    const result = await this.db
      .prepare('SELECT w.* FROM worlds w LEFT JOIN world_owners o ON o.world_id = w.id WHERE o.user_id IS NULL OR o.user_id = ? OR EXISTS (SELECT 1 FROM sessions s WHERE s.world_id = w.id AND s.user_id = ?) ORDER BY w.id ASC')
      .bind(userId, userId)
      .all<World>();
    return result.results || [];
  }

  async createWorld(id: string, title: string, description: string | undefined, userId: number): Promise<World> {
    await this.db.batch([
      this.db.prepare('INSERT INTO worlds (id, title, description) VALUES (?, ?, ?)').bind(id, title, description || null),
      this.db.prepare('INSERT INTO world_owners (world_id, user_id) VALUES (?, ?)').bind(id, userId),
    ]);
    return { id, title, description: description || null };
  }
}
