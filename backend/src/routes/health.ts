import { createJsonResponse } from '../utils/response';

export class HealthRouter {
  async route(request: Request, ctx?: ExecutionContext): Promise<Response | null> {
    const url = new URL(request.url);
    const method = request.method;
    const pathname = url.pathname;

    // Health check
    if (pathname === '/health' && method === 'GET') {
      return createJsonResponse({ status: 'healthy', timestamp: new Date().toISOString() });
    }

    return null; // Route not handled by this router
  }
} 