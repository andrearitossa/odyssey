

import { createErrorResponse } from './utils/response';
import { logRequest } from './utils/requestLogger';
import { Logger } from './utils/logger';
import { handleAuthError } from './utils/errorHandling';

// === ENVIRONMENT BINDINGS ===
export interface Env {
  DB: D1Database;
  AI?: Ai;
  AI_MODEL?: string;
  GEMINI_MODEL?: string;
  HUGGINGFACE_API_KEY?: string;
  HUGGING_FACE_API_KEY?: string;
  OPENAI_API_KEY?: string;
  GEMINI_API_KEY?: string;
  // Logging configuration
  LOG_LEVEL?: string;
  LOG_SAMPLING_RATE?: string;
  LOG_REQUEST_DETAILS?: string;
}

// Import all route modules
import { AccountsRouter } from './routes/accounts';
import { StoryInteractionRouter } from './routes/storyInteraction';
import { WorldsRouter } from './routes/worlds';
import { ProfileRouter } from './routes/profile';
import { HealthRouter } from './routes/health';

// Import database and auth services
import { UserDbService } from './database';
import { AuthService } from './utils/authService';
import { User } from './database/db-types';

export class ApiRouter {
  private accountsRouter: AccountsRouter;
  private storyInteractionRouter: StoryInteractionRouter;
  private worldsRouter: WorldsRouter;
  private profileRouter: ProfileRouter;
  private healthRouter: HealthRouter;
  private authService: AuthService; // Add authService as a member

  constructor(env: Env) {
    // Initialize core services once
    const userDbService = new UserDbService(env.DB);
    this.authService = new AuthService(env.DB, userDbService); // Assign to member

    this.accountsRouter = new AccountsRouter(env.DB, this.authService, userDbService);
    this.storyInteractionRouter = new StoryInteractionRouter(env);
    this.worldsRouter = new WorldsRouter(env, this.authService, userDbService);
    this.profileRouter = new ProfileRouter(this.authService, userDbService); // ProfileRouter no longer needs env directly
    this.healthRouter = new HealthRouter(env);
  }

  // New helper method for authenticated routes
  private async handleAuthenticatedRoute(request: Request, ctx: ExecutionContext | undefined, handler: (request: Request, user: User, ctx?: ExecutionContext) => Promise<Response>): Promise<Response> {
    const authContext = { component: 'ApiRouter', operation: 'AUTHENTICATE_ROUTE' };
    const authResult = await this.authService.authenticateAndAuthorize(request, authContext);

    if (authResult instanceof Response) {
      return authResult; // Authentication failed, return error response
    }
    const { user } = authResult;
    return handler(request, user, ctx);
  }

  async route(request: Request, ctx?: ExecutionContext): Promise<Response> {
    logRequest(request);

    try {
      if (request.method === 'POST' || request.method === 'PUT') {
        const reader = request.body?.getReader();
        if (reader) {
          const chunks: Uint8Array[] = [];
          let total = 0;
          while (true) {
            const { done, value } = await reader.read();
            if (done) break;
            total += value.byteLength;
            if (total > 16384) { await reader.cancel(); return createErrorResponse('Request is too large.', 413); }
            chunks.push(value);
          }
          const body = new Uint8Array(total);
          let offset = 0;
          for (const chunk of chunks) { body.set(chunk, offset); offset += chunk.byteLength; }
          request = new Request(request, { body });
        }
      }
      const url = new URL(request.url);
      const pathname = url.pathname;
      const method = request.method;

      // Health check (no auth required)
      if (pathname === '/health') {
        const healthResponse = await this.healthRouter.route(request, ctx);
        if (healthResponse === null) {
          return createErrorResponse('Route not found', 404, 'Not Found');
        }
        return healthResponse;
      }

      if (pathname.startsWith('/auth/')) return await this.accountsRouter.route(request);

      // Authenticated routes
      if (pathname.startsWith('/profile')) {
        return await this.handleAuthenticatedRoute(request, ctx, async (req, user, context) => {
          const profileResponse = await this.profileRouter.route(req, user, context);
          if (profileResponse === null) {
            return createErrorResponse('Route not found', 404, 'Not Found');
          }
          return profileResponse;
        });
      }

      if (pathname.startsWith('/worlds')) {
        return await this.handleAuthenticatedRoute(request, ctx, async (req, user, context) => {
          const worldsResponse = await this.worldsRouter.route(req, user, context);
          if (worldsResponse === null) {
            return createErrorResponse('Route not found', 404, 'Not Found');
          }
          return worldsResponse;
        });
      }

      if (pathname.startsWith('/sessions')) {
        return await this.handleAuthenticatedRoute(request, ctx, async (req, user, context) => {
          const storyResponse = await this.storyInteractionRouter.route(req, user, context);
          if (storyResponse === null) {
            return createErrorResponse('Route not found', 404, 'Not Found');
          }
          return storyResponse;
        });
      }

      // If no router handled the request
      return createErrorResponse('Route not found', 404, 'Not Found');

    } catch (error) {
      Logger.error('Route handler error', error, {
        component: 'ApiRouter',
        operation: 'ROUTE'
      });
      return createErrorResponse('Internal server error', 500, 'Internal Server Error');
    }
  }
}
