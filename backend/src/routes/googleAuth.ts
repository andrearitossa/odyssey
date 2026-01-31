import { createJsonResponse, createErrorResponse, parseJsonBody } from '../utils/response';
import { extractBearerToken, extractCookieValue } from '../utils/auth';
import { handleServerError } from '../utils/errorHandling';
import { OAuthService, UserDbService } from '../database';
import { Env } from '../routes';
import { OAuthUtils } from '../utils/oauthUtils';
import {
  exchangeCodeForTokens,
  exchangeCodeForTokensMobile,
  fetchGoogleUserInfo,
  refreshAccessToken,
  revokeGoogleToken,
} from '../utils/google';
import {
  createCallbackErrorPage,
  createCallbackSuccessPage,
} from '../utils/html';

export class GoogleAuthRouter {
  private oAuth: OAuthService;
  private userDB: UserDbService;
  private env: Env;
  private oauthUtils: OAuthUtils;

  constructor(env: Env, oAuth: OAuthService, userDB: UserDbService) {
    this.oAuth = oAuth;
    this.userDB = userDB;
    this.env = env;
    this.oauthUtils = new OAuthUtils(this.oAuth, this.userDB, this.env);
    this.oauthUtils.validateOAuthConfiguration();
  }

  async route(request: Request, ctx?: ExecutionContext): Promise<Response | null> {
    const url = new URL(request.url);
    const method = request.method;
    const pathname = url.pathname;

    // Google OAuth routes
    if (pathname === '/auth/google' && method === 'GET') {
      return await this.initiateGoogleAuth(request);
    }
    
    if (pathname === '/auth/google/callback' && method === 'GET') {
      return await this.handleGoogleCallback(request);
    }
    
    if (pathname === '/auth/google/mobile-callback' && method === 'POST') {
      return await this.handleMobileCallback(request);
    }
    
    if (pathname === '/auth/validate-google' && method === 'GET') {
      return await this.validateGoogleToken(request);
    }

    if (pathname === '/auth/logout' && method === 'POST') {
      return await this.logout(request);
    }

    if (pathname === '/auth/welcome' && method === 'GET') {
      return await this.getWelcomeInfo(request);
    }

    return null; // Route not handled by this router
  }

  /**
   * Initiate Google OAuth flow
   * Redirects user to Google's authorization server
   */
  private async initiateGoogleAuth(request: Request): Promise<Response> {
    try {
      const url = new URL(request.url);
      const redirectUri = `${url.protocol}//${url.host}/auth/google/callback`;
      const state = this.oauthUtils.generateOAuthState();
      
      const authUrl = this.oauthUtils.generateGoogleAuthUrl({
        clientId: this.env.GOOGLE_CLIENT_ID || '',
        redirectUri,
        state,
      });

      return this.oauthUtils.createOAuthStateResponse(authUrl, state);
    } catch (error) {
      return handleServerError(error, 'initiate Google authentication', { component: 'GoogleAuthRouter', operation: 'INITIATE_AUTH' });
    }
  }

  /**
   * Handle Google OAuth callback
   * Exchange authorization code for access token and create user session
   */
  private async handleGoogleCallback(request: Request): Promise<Response> {
    try {
      const url = new URL(request.url);
      const code = url.searchParams.get('code');
      const state = url.searchParams.get('state');
      const error = url.searchParams.get('error');

      // Check for OAuth errors
      if (error) {
        return createCallbackErrorPage(`Google OAuth error: ${error}`);
      }

      if (!code || !state) {
        return createCallbackErrorPage('Missing authorization code or state parameter');
      }

      // Validate state parameter
      const cookies = request.headers.get('Cookie') || '';
      const stateCookie = extractCookieValue(cookies, 'oauth_state');
      
      if (!stateCookie || stateCookie !== state) {
        return createCallbackErrorPage('Invalid state parameter - potential CSRF attack');
      }

      // Exchange code for tokens
      const tokenData = await exchangeCodeForTokens(code, url, this.env);
      
      // Get user info from Google
      const userInfo = await fetchGoogleUserInfo(tokenData.access_token);
      
      // Create or update user in our database
      const user = await this.oauthUtils.createOrUpdateUserFromGoogleInfo(userInfo);
      
      // Create OAuth session
      const oauthSession = await this.oauthUtils.createOAuthSessionFromTokens(user.id.toString(), tokenData);
      
      // Create success response with user session token
      return createCallbackSuccessPage(oauthSession.access_token, user);

    } catch (error) {
      console.error('Error handling Google callback:', error);
      return createCallbackErrorPage('Authentication failed. Please try again.');
    }
  }

  /**
   * Handle mobile OAuth callback
   * Exchange authorization code for tokens and return JSON response
   */
  private async handleMobileCallback(request: Request): Promise<Response> {
    try {
      const body = await parseJsonBody(request) as { code?: string; state?: string; redirectUri?: string; codeVerifier?: string };
      const { code, state, redirectUri, codeVerifier } = body;

      if (!code) {
        return createErrorResponse('Missing authorization code', 400);
      }

      // Exchange code for tokens (using mobile redirect URI and PKCE)
      const tokenData = await exchangeCodeForTokensMobile(code, redirectUri || '', this.env, codeVerifier);
      
      // Get user info from Google
      const userInfo = await fetchGoogleUserInfo(tokenData.access_token);
      
      // Create or update user in our database
      const user = await this.oauthUtils.createOrUpdateUserFromGoogleInfo(userInfo);
      
      // Create OAuth session
      const oauthSession = await this.oauthUtils.createOAuthSessionFromTokens(user.id.toString(), tokenData);
      
      // Return JSON response for mobile
      return createJsonResponse({
        success: true,
        token: oauthSession.access_token,
        user: {
          id: user.id,
          email: user.email,
          name: user.name,
          picture_url: user.picture_url
        }
      });

    } catch (error) {
      return handleServerError(error, 'handle mobile authentication callback', { component: 'GoogleAuthRouter', operation: 'MOBILE_CALLBACK' });
    }
  }

  /**
   * Validate Google authentication token
   */
  private async validateGoogleToken(request: Request): Promise<Response> {
    try {
      const authHeader = request.headers.get('Authorization');
      const token = extractBearerToken(authHeader);

      if (!token) {
        return createErrorResponse('Missing or invalid authorization header', 401, 'Unauthorized');
      }

      // Find OAuth session by access token
      const oauthSession = await this.oAuth.getOAuthSessionByToken(token);

      if (!oauthSession) {
        return createErrorResponse('Invalid or expired token', 401, 'Unauthorized');
      }

      // Check if token is expired
      if (new Date(oauthSession.expires_at) <= new Date()) {
        // Try to refresh token if available
        if (oauthSession.refresh_token) {
          try {
            const refreshedTokens = await refreshAccessToken(oauthSession.refresh_token, this.env);
            await this.oauthUtils.updateOAuthSessionFromTokens(oauthSession.id.toString(), refreshedTokens);
            
            // Return success with updated user info
            const user = await this.userDB.getUserById(oauthSession.user_id);
            if (!user) {
              throw new Error('User not found');
            }
            return createJsonResponse({ 
              valid: true, 
              user: {
                id: user.id,
                email: user.email,
                name: user.name,
                picture_url: user.picture_url
              }
            });
          } catch (refreshError) {
            console.error('Token refresh failed:', refreshError);
            await this.oAuth.deleteOAuthSession(oauthSession.id);
            return createErrorResponse('Token expired and refresh failed', 401, 'Unauthorized');
          }
        } else {
          await this.oAuth.deleteOAuthSession(oauthSession.id);
          return createErrorResponse('Token expired', 401, 'Unauthorized');
        }
      }

      // Token is valid, return user info
      const user = await this.userDB.getUserById(oauthSession.user_id);
      if (!user) {
        throw new Error('User not found');
      }
      return createJsonResponse({ 
        valid: true, 
        user: {
          id: user.id,
          email: user.email,
          name: user.name,
          picture_url: user.picture_url
        }
      });

    } catch (error) {
      return handleServerError(error, 'validate Google token', { component: 'GoogleAuthRouter', operation: 'VALIDATE_TOKEN' });
    }
  }

  /**
   * Logout user - revoke tokens and clean up
   */
  private async logout(request: Request): Promise<Response> {
    try {
      const authHeader = request.headers.get('Authorization');
      const token = extractBearerToken(authHeader);

      if (token) {
        const oauthSession = await this.oAuth.getOAuthSessionByToken(token);
        if (oauthSession) {
          // Revoke token with Google
          try {
            await revokeGoogleToken(oauthSession.access_token);
          } catch (error) {
            console.warn('Failed to revoke Google token:', error);
          }
          
          // Delete from our database
          await this.oAuth.deleteOAuthSession(oauthSession.id);
        }
      }

      return createJsonResponse({ success: true, message: 'Logged out successfully' });
    } catch (error) {
      return handleServerError(error, 'logout user', { component: 'GoogleAuthRouter', operation: 'LOGOUT' });
    }
  }

  /**
   * Get welcome information for authenticated user
   */
  private async getWelcomeInfo(request: Request): Promise<Response> {
    try {
      const authHeader = request.headers.get('Authorization');
      const token = extractBearerToken(authHeader);

      if (!token) {
        return createErrorResponse('Missing or invalid authorization header', 401, 'Unauthorized');
      }

      // Find OAuth session by access token
      const oauthSession = await this.oAuth.getOAuthSessionByToken(token);

      if (!oauthSession) {
        return createErrorResponse('Invalid or expired token', 401, 'Unauthorized');
      }

      // Check if token is expired
      if (new Date(oauthSession.expires_at) <= new Date()) {
        await this.oAuth.deleteOAuthSession(oauthSession.id);
        return createErrorResponse('Token expired', 401, 'Unauthorized');
      }

      // Get user info
      const user = await this.userDB.getUserById(oauthSession.user_id);
      if (!user) {
        return createErrorResponse('User not found', 401, 'Unauthorized');
      }

      // Create welcome response with POC disclaimer
      const welcomeResponse = {
        user: {
          id: user.id,
          email: user.email,
          name: user.name,
          picture_url: user.picture_url
        },
        welcome: {
          title: `Welcome back, ${user.name}!`,
          message: "Ready to dive into your next AI-powered adventure? Have you ever wanted to be a wizard in the Harry Potter world? Odyssey lets you become the first character in your favorite stories!",
          features: [
            "🎭 Become the main character in famous stories",
            "🤖 AI-powered dynamic storytelling",
            "📚 Multiple world adventures",
            "💾 Persistent story sessions"
          ]
        },
        timestamp: new Date().toISOString()
      };

      return createJsonResponse(welcomeResponse);

    } catch (error) {
      return handleServerError(error, 'fetch welcome information', { component: 'GoogleAuthRouter', operation: 'GET_WELCOME' });
    }
  }
}  