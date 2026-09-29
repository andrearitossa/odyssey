import { createJsonResponse, createErrorResponse } from '../utils/response';
import { isValidWorldId, validateWorldCreationRequest } from '../utils/validation';
import { logRequest } from '../utils/requestLogger';
import { handleAuthError, handleServerError, handleNotFoundError, isAuthError } from '../utils/errorHandling';
import { WorldDbService, UserDbService } from '../database';
import { Env } from '../routes';
import { AuthService } from '../utils/authService';
import { User } from '../database/db-types';
import { withinRateLimit } from '../utils/rateLimit';

export class WorldsRouter {
  private worldDB: WorldDbService;
  private db: D1Database;
  private authService: AuthService;

  constructor(env: Env, authService: AuthService, userDB: UserDbService) {
    this.db = env.DB;
    this.worldDB = new WorldDbService(env.DB);
    this.authService = authService;
  }

  async route(request: Request, user: User, ctx?: ExecutionContext): Promise<Response | null> {
    logRequest(request);

    const url = new URL(request.url);
    const method = request.method;
    const pathname = url.pathname;

    // Worlds routes
    if (pathname === '/worlds' && method === 'GET') {
      return await this.getWorlds(request, user);
    }

    if (pathname === '/worlds' && method === 'POST') {
      return await this.createWorld(request, user);
    }

    const worldMatch = pathname.match(/^\/worlds\/([^\/]+)$/);
    if (worldMatch && method === 'GET') {
      const worldId = worldMatch[1];
      return await this.getWorld(request, user, worldId);
    }

    return null; // Route not handled by this router
  }

  private async getWorlds(request: Request, user: User): Promise<Response> {
    try {
      const worlds = await this.worldDB.getAllWorlds(user.id);
      return createJsonResponse(worlds);
    } catch (error) {
      return handleServerError(error, 'fetch worlds', { component: 'WorldsRouter', operation: 'GET_WORLDS' });
    }
  }

  private async createWorld(request: Request, user: User): Promise<Response> {
    try {
      if (!(await withinRateLimit(this.db, `world-create:${user.id}`, 20, 86400000))) return createErrorResponse('You have reached today’s world limit.', 429);
      const body = await request.json() as { title?: unknown; description?: unknown };

      // Validate input using utils
      const validationResult = validateWorldCreationRequest(body);
      if (validationResult.error) {
        return createErrorResponse(validationResult.error, 400);
      }

      const { title, description } = validationResult.validatedData!;

      // UUIDs stay within the 50-character ID limit, including for long or non-Latin titles.
      const id = crypto.randomUUID();

      const world = await this.worldDB.createWorld(id, title, description, user.id);
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

      const world = await this.worldDB.getWorldById(worldId, user.id);
      if (!world) {
        return handleNotFoundError('World', { component: 'WorldsRouter', operation: 'GET_WORLD', worldId });
      }

      return createJsonResponse(world);
    } catch (error) {
      return handleServerError(error, 'fetch world', { component: 'WorldsRouter', operation: 'GET_WORLD', worldId });
    }
  }
}
