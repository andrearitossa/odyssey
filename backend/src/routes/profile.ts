import { createJsonResponse, createErrorResponse, parseJsonBody } from '../utils/response';
import { validateProfileUpdateRequest } from '../utils/validation';
import { logRequest } from '../utils/requestLogger';
import { handleAuthError, handleServerError, isAuthError } from '../utils/errorHandling';
import { UserDbService } from '../database';
import { Env } from '../routes';
import { User } from '../database/db-types';
import { AuthService } from '../utils/authService';

export interface ProfileUpdateRequest {
  name?: string;
  language?: string;
}

export interface ProfileResponse {
  user: User;
  userWorlds: Array<{
    session_id: string;
    world_id: string;
    world_title: string;
    world_description: string | null;
    created_at: string;
    updated_at: string;
  }>;
}

export class ProfileRouter {
  private userDB: UserDbService;
  private authService: AuthService;

  constructor(authService: AuthService, userDB: UserDbService) {
    this.authService = authService;
    this.userDB = userDB;
  }

  async route(request: Request, user: User, ctx?: ExecutionContext): Promise<Response | null> {
    logRequest(request);

    const url = new URL(request.url);
    const method = request.method;
    const pathname = url.pathname;

    // Profile routes
    if (pathname === '/profile' && method === 'GET') {
      return await this.getProfile(request, user);
    }

    if (pathname === '/profile' && method === 'PUT') {
      return await this.updateProfile(request, user);
    }

    return null; // Route not handled by this router
  }

  /**
   * Get user profile with their worlds
   */
  private async getProfile(request: Request, user: User): Promise<Response> {
    try {
      // Get user's worlds/sessions
      const userWorlds = await this.userDB.getUserSessionsWithWorlds(user.id);

      const response: ProfileResponse = {
        user,
        userWorlds
      };

      return createJsonResponse(response);
    } catch (error) {
      return handleServerError(error, 'fetch profile', { component: 'ProfileRouter', operation: 'GET_PROFILE' });
    }
  }

  /**
   * Update user profile (name and/or language)
   */
  private async updateProfile(request: Request, user: User): Promise<Response> {
    try {
      const body = await parseJsonBody<ProfileUpdateRequest>(request);

      // Validate input using utils
      const validationError = validateProfileUpdateRequest(body);
      if (validationError) {
        return createErrorResponse(validationError, 400);
      }

      // Prepare updates
      const updates: { name?: string; language?: string } = {};
      if (body.name) {
        updates.name = body.name.trim();
      }
      if (body.language) {
        updates.language = body.language;
      }

      // Update user
      const updatedUser = await this.userDB.updateUser(user.id, updates);

      // Get updated user's worlds
      const userWorlds = await this.userDB.getUserSessionsWithWorlds(user.id);

      const response: ProfileResponse = {
        user: updatedUser,
        userWorlds
      };

      return createJsonResponse(response);
    } catch (error) {
      return handleServerError(error, 'update profile', { component: 'ProfileRouter', operation: 'UPDATE_PROFILE' });
    }
  }
}


