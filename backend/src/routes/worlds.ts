import { createJsonResponse, createErrorResponse } from '../utils/response';
import { isValidWorldId, validateWorldCreationRequest } from '../utils/validation';
import { handleServerError, handleNotFoundError } from '../utils/errorHandling';
import { WorldDbService } from '../database';
import { Env } from '../routes';
import { User } from '../database/db-types';

export class WorldsRouter {
  private worldDB: WorldDbService;

  constructor(env: Env) {
    this.worldDB = new WorldDbService(env.DB);
  }

  async route(request: Request, user: User, ctx?: ExecutionContext): Promise<Response | null> {
    const url = new URL(request.url);
    const method = request.method;
    const pathname = url.pathname;
    
    // Worlds routes
    if (pathname === '/worlds' && method === 'GET') {
      return await this.getWorlds(request, user);
    }

    if (pathname === '/worlds/all' && method === 'GET') {
      return await this.getAllWorlds(request, user);
    }

    if (pathname === '/worlds' && method === 'POST') {
      return await this.createWorld(request, user);
    }

    const worldMatch = pathname.match(/^\/worlds\/([^\/]+)$/);
    if (worldMatch && method === 'GET') {
      const worldId = worldMatch[1];
      return await this.getWorld(request, user, worldId);
    }

    if (worldMatch && method === 'PATCH') {
      const worldId = worldMatch[1];
      return await this.updateWorld(request, user, worldId);
    }

    return null; // Route not handled by this router
  }

  private async getWorlds(request: Request, user: User): Promise<Response> {
    try {
      const worlds = await this.worldDB.getWorldsForUser(user.id);
      return createJsonResponse(worlds);
    } catch (error) {
      return handleServerError(error, 'fetch worlds', { component: 'WorldsRouter', operation: 'GET_WORLDS' });
    }
  }

  private async getAllWorlds(request: Request, user: User): Promise<Response> {
    try {
      const worlds = await this.worldDB.getAllWorlds();
      return createJsonResponse(worlds);
    } catch (error) {
      return handleServerError(error, 'fetch all worlds', { component: 'WorldsRouter', operation: 'GET_ALL_WORLDS' });
    }
  }

  private async createWorld(request: Request, user: User): Promise<Response> {
    try {
      const body = await request.json() as { title?: unknown; description?: unknown };
      
      // Validate input using utils
      const validationResult = validateWorldCreationRequest(body);
      if (validationResult.error) {
        return createErrorResponse(validationResult.error, 400);
      }

      const { title, description } = validationResult.validatedData!;

      // Generate a unique ID based on the title
      const id = title.toLowerCase()
        .replace(/[^a-z0-9\s]/g, '')
        .replace(/\s+/g, '-')
        .substring(0, 50) + '-' + Date.now();

      const world = await this.worldDB.createWorld(id, user.id, title, description);
      return createJsonResponse(world);
    } catch (error) {
      return handleServerError(error, 'create world', { component: 'WorldsRouter', operation: 'CREATE_WORLD' });
    }
  }

  private async getWorld(request: Request, user: User, worldId: string): Promise<Response> {
    try {
      if (!isValidWorldId(worldId)) {
        return createErrorResponse('Invalid world ID format', 400);
      }

      const world = await this.worldDB.getWorldById(worldId);
      if (!world) {
        return handleNotFoundError('World', { component: 'WorldsRouter', operation: 'GET_WORLD', worldId });
      }

      return createJsonResponse(world);
    } catch (error) {
      return handleServerError(error, 'fetch world', { component: 'WorldsRouter', operation: 'GET_WORLD', worldId });
    }
  }

  private async updateWorld(request: Request, user: User, worldId: string): Promise<Response> {
    try {
      if (!isValidWorldId(worldId)) {
        return createErrorResponse('Invalid world ID format', 400);
      }

      const body = await request.json() as { title?: unknown; description?: unknown };
      const updates: { title?: string; description?: string | null } = {};

      if (typeof body.title !== 'undefined') {
        if (typeof body.title !== 'string' || body.title.trim().length === 0) {
          return createErrorResponse('Title must be a non-empty string', 400);
        }
        updates.title = body.title.trim();
      }

      if (typeof body.description !== 'undefined') {
        if (body.description === null) {
          updates.description = null;
        } else if (typeof body.description === 'string') {
          updates.description = body.description.trim();
        } else {
          return createErrorResponse('Description must be a string or null', 400);
        }
      }

      const updated = await this.worldDB.updateWorldForUser(worldId, user.id, updates);
      if (!updated) {
        return handleNotFoundError('World', { component: 'WorldsRouter', operation: 'UPDATE_WORLD', worldId });
      }

      return createJsonResponse(updated);
    } catch (error) {
      return handleServerError(error, 'update world', { component: 'WorldsRouter', operation: 'UPDATE_WORLD', worldId });
    }
  }
} 