

import { createErrorResponse } from './utils/response';
import { Logger } from './utils/logger';

// === ENVIRONMENT BINDINGS ===
export interface Env {
  DB: D1Database;
  // AI services
  HUGGINGFACE_API_KEY?: string;
  OPENAI_API_KEY?: string;
  GEMINI_API_KEY?: string;
  CLOUDFLARE_API_TOKEN?: string;
  CLOUDFLARE_ACCOUNT_ID?: string;
  // Google OAuth configuration
  GOOGLE_CLIENT_ID?: string;
  GOOGLE_CLIENT_SECRET?: string;
  // Logging configuration
  LOG_LEVEL?: string;
  LOG_SAMPLING_RATE?: string;
  LOG_REQUEST_DETAILS?: string;
}

// Import all route modules
import { GoogleAuthRouter } from './routes/googleAuth';
import { StoryInteractionRouter } from './routes/storyInteraction';
import { WorldsRouter } from './routes/worlds';
import { WorldGenerationRouter } from './routes/worldGeneration';
import { ProfileRouter } from './routes/profile';
import { HealthRouter } from './routes/health';

// Import database and auth services
import { OAuthService, UserDbService } from './database';
import { AuthService } from './utils/authService';
import { User } from './database/db-types';

export class ApiRouter {
  private googleAuthRouter: GoogleAuthRouter;
  private storyInteractionRouter: StoryInteractionRouter;
  private worldsRouter: WorldsRouter;
  private worldGenerationRouter: WorldGenerationRouter;
  private profileRouter: ProfileRouter;
  private healthRouter: HealthRouter;
  private authService: AuthService;

  constructor(env: Env) {
    // Initialize core services once
    const oAuthService = new OAuthService(env.DB);
    const userDbService = new UserDbService(env.DB);
    this.authService = new AuthService(oAuthService, userDbService);

    this.googleAuthRouter = new GoogleAuthRouter(env, oAuthService, userDbService);
    this.storyInteractionRouter = new StoryInteractionRouter(env);
    this.worldsRouter = new WorldsRouter(env);
    this.worldGenerationRouter = new WorldGenerationRouter(env);
    this.profileRouter = new ProfileRouter(userDbService);
    this.healthRouter = new HealthRouter();
  }

  private notFound(): Response {
    return createErrorResponse('Route not found', 404, 'Not Found');
  }

  private async handleAuthenticatedRoute(
    request: Request,
    ctx: ExecutionContext,
    handler: (request: Request, user: User, ctx: ExecutionContext) => Promise<Response>
  ): Promise<Response> {
    const authContext = { component: 'ApiRouter', operation: 'AUTHENTICATE_ROUTE' };
    const authResult = await this.authService.authenticateAndAuthorize(request, authContext);

    if (authResult instanceof Response) {
      return authResult; // Authentication failed, return error response
    }
    const { user } = authResult;
    return handler(request, user, ctx);
  }

  async route(request: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
    try {
      const url = new URL(request.url);
      const pathname = url.pathname;

      // Health check (no auth required)
      if (pathname === '/health') {
        return (await this.healthRouter.route(request, ctx)) ?? this.notFound();
      }

      // Google OAuth routes (handled by GoogleAuthRouter, which manages its own auth flow)
      if (pathname.startsWith('/auth/google') || pathname.startsWith('/auth/validate-google') || pathname.startsWith('/auth/logout') || pathname.startsWith('/auth/welcome')) {
        return (await this.googleAuthRouter.route(request, ctx)) ?? this.notFound();
      }

      // Authenticated routes
      if (pathname.startsWith('/profile')) {
        return this.handleAuthenticatedRoute(request, ctx, async (req, user, context) => {
          const result = await this.profileRouter.route(req, user, context);
          return result ?? this.notFound();
        });
      }

      if (pathname.startsWith('/worlds')) {
        return this.handleAuthenticatedRoute(request, ctx, async (req, user, context) => {
          const result = await this.worldsRouter.route(req, user, context);
          return result ?? this.notFound();
        });
      }

      if (pathname.startsWith('/world-generation')) {
        return this.handleAuthenticatedRoute(request, ctx, async (req, user, context) => {
          const result = await this.worldGenerationRouter.route(req, user, context);
          return result ?? this.notFound();
        });
      }

      if (pathname.startsWith('/sessions')) {
        return this.handleAuthenticatedRoute(request, ctx, async (req, user, context) => {
          const result = await this.storyInteractionRouter.route(req, user, context);
          return result ?? this.notFound();
        });
      }

      // If no router handled the request
      return this.notFound();

    } catch (error) {
      Logger.error('Route handler error', error, {
        component: 'ApiRouter',
        operation: 'ROUTE'
      });
      return createErrorResponse('Internal server error', 500, 'Internal Server Error');
    }
  }
} 