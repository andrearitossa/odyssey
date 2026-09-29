/**
 * Odissey Backend - Cloudflare Worker with D1 Database
 *
 * This worker provides the backend API for the Odissey interactive storytelling app.
 * It handles anonymous authentication, session management, and AI-powered story interactions.
 *
 * - Run `npm run dev` in your terminal to start a development server
 * - Open a browser tab at http://localhost:8787/ to see your worker in action
 * - Run `npm run deploy` to publish your worker
 *
 * Bind resources to your worker in `wrangler.jsonc`. After adding bindings, a type definition for the
 * `Env` object can be regenerated with `npm run cf-typegen`.
 *
 * Learn more at https://developers.cloudflare.com/workers/
 */

import { ApiRouter } from './routes';
import { Logger } from './utils/logger';

import { Env } from './routes';

// Global router cache to avoid recreating for every request
let cachedRouter: ApiRouter | null = null;
let cacheKey: string | null = null;
let isLoggerInitialized = false;

function getCachedRouter(env: Env): ApiRouter {
	// Initialize logger once per worker instance
	if (!isLoggerInitialized) {
		Logger.initialize(env);
		isLoggerInitialized = true;
		Logger.info('Worker instance initialized', {
			component: 'WORKER',
			operation: 'INIT',
			metadata: {
				logLevel: env.LOG_LEVEL || 'INFO',
				samplingRate: env.LOG_SAMPLING_RATE || '1.0',
				requestDetails: env.LOG_REQUEST_DETAILS || 'true'
			}
		});
	}

	// Create a cache key based on environment variables that matter
	const currentCacheKey = `${env.GEMINI_API_KEY || ''}_${env.GEMINI_MODEL || ''}_${env.HUGGINGFACE_API_KEY || env.HUGGING_FACE_API_KEY || ''}_${env.AI_MODEL || ''}_${Boolean(env.AI)}`;
	
	// Return cached router if env hasn't changed
	if (cachedRouter && cacheKey === currentCacheKey) {
		return cachedRouter;
	}
	
	// Create new router and cache it
	Logger.info('Initializing ApiRouter (environment changed or first load)', {
		component: 'WORKER',
		operation: 'ROUTER_INIT'
	});
	cachedRouter = new ApiRouter(env);
	cacheKey = currentCacheKey;
	
	return cachedRouter;
}

export default {
	async fetch(request: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
		const requestTimer = Date.now();
		const requestId = crypto.randomUUID().substring(0, 8);
		
		// Initialize logger if not already done
		const router = getCachedRouter(env);

		// Handle CORS preflight requests first
		if (request.method === 'OPTIONS') {
			Logger.debug('CORS preflight request', {
				component: 'WORKER',
				operation: 'CORS_PREFLIGHT',
				metadata: { requestId }
			});

			return new Response(null, {
				status: 200,
				headers: {
					'Access-Control-Allow-Origin': '*',
					'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
					'Access-Control-Allow-Headers': 'Content-Type, Authorization',
					'Access-Control-Max-Age': '86400', // 24 hours
				},
			});
		}

		// Log incoming request with Cloudflare-specific headers
		Logger.logRequest(request, undefined, {
			component: 'WORKER',
			operation: 'INCOMING_REQUEST',
			metadata: { requestId }
		});

		try {
			// Route the request
			const response = await router.route(request, ctx);
			
			// Log response
			const duration = Date.now() - requestTimer;
			Logger.logRequest(request, response, {
				component: 'WORKER',
				operation: 'RESPONSE_SENT',
				duration,
				metadata: { 
					requestId,
					status: response.status,
					statusText: response.statusText
				}
			});

			// Log performance metrics
			Logger.performance('request_duration', duration, 'ms', {
				component: 'WORKER',
				metadata: {
					requestId,
					method: request.method,
					url: new URL(request.url).pathname,
					status: response.status
				}
			});
			
			// Ensure all responses have CORS headers
			const headers = new Headers(response.headers);
			headers.set('Access-Control-Allow-Origin', '*');
			headers.set('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
			headers.set('Access-Control-Allow-Headers', 'Content-Type, Authorization');
			headers.set('X-Request-ID', requestId); // Add request ID for tracking
			headers.set('Cache-Control', 'no-store');
			
			return new Response(response.body, {
				status: response.status,
				statusText: response.statusText,
				headers: headers,
			});
			
		} catch (error) {
			const duration = Date.now() - requestTimer;
			
			Logger.error('Worker error', error, {
				component: 'WORKER',
				operation: 'ERROR_HANDLER',
				duration,
				metadata: {
					requestId,
					method: request.method,
					url: new URL(request.url).pathname,
					userAgent: request.headers.get('User-Agent'),
					ray: request.headers.get('CF-Ray')
				}
			});
			
			// Return a generic error response with CORS headers
			return new Response(
				JSON.stringify({
					error: 'Internal Server Error',
					message: 'An unexpected error occurred',
					status: 500,
					requestId: requestId
				}),
				{
					status: 500,
					headers: {
						'Content-Type': 'application/json',
						'Access-Control-Allow-Origin': '*',
						'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
						'Access-Control-Allow-Headers': 'Content-Type, Authorization',
						'X-Request-ID': requestId,
						'Cache-Control': 'no-store',
					},
				}
			);
		}
	},
} satisfies ExportedHandler<Env>;
