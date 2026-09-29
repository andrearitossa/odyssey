import { createJsonResponse } from '../utils/response';
import { logRequest } from '../utils/requestLogger';
import { Env } from '../routes';

export class HealthRouter {
  constructor(private env: Env) {}
  async route(request: Request, ctx?: ExecutionContext): Promise<Response | null> {
    logRequest(request);

    const url = new URL(request.url);
    const method = request.method;
    const pathname = url.pathname;

    // Health check
    if (pathname === '/health' && method === 'GET') {
      const provider = this.env.AI ? 'workers-ai' : this.env.GEMINI_API_KEY ? 'gemini' : (this.env.HUGGINGFACE_API_KEY || this.env.HUGGING_FACE_API_KEY) ? 'huggingface' : null;
      try {
        await this.env.DB.prepare('SELECT 1').first();
        return createJsonResponse({ status: 'healthy', database: 'available', aiConfigured: Boolean(provider), provider, timestamp: new Date().toISOString() });
      } catch {
        return createJsonResponse({ status: 'unavailable', database: 'unavailable', aiConfigured: Boolean(provider), provider }, 503);
      }
    }

    return null; // Route not handled by this router
  }
}
