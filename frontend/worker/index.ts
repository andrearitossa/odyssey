/**
 * Frontend Worker for Odissey Expo App
 * Serves the Expo web app with proper SPA routing and comprehensive logging
 */

// Type definitions for Cloudflare Workers
interface ExecutionContext {
  waitUntil(promise: Promise<any>): void;
  passThroughOnException(): void;
}

interface Env {
  ASSETS: {
    fetch(request: Request): Promise<Response>;
  };
  BACKEND: {
    fetch(request: Request): Promise<Response>;
  };
}

interface ExportedHandler {
  fetch(request: Request, env: Env, ctx?: ExecutionContext): Promise<Response>;
}

interface LogContext {
  requestId?: string;
  operation?: string;
  component?: string;
  duration?: number;
  metadata?: Record<string, any>;
}

class FrontendLogger {
  private static formatTimestamp(): string {
    return new Date().toISOString();
  }

  private static formatMessage(level: string, message: string, context?: LogContext): string {
    const timestamp = this.formatTimestamp();
    const requestId = context?.requestId ? `[${context.requestId}]` : '';
    const component = context?.component ? `[${context.component}]` : '';
    const operation = context?.operation ? `[${context.operation}]` : '';
    const duration = context?.duration ? `(${context.duration}ms)` : '';
    
    let logLine = `${timestamp} ${level} ${component}${operation}${requestId} ${message} ${duration}`;
    
    if (context?.metadata && Object.keys(context.metadata).length > 0) {
      logLine += ` | ${JSON.stringify(context.metadata)}`;
    }
    
    return logLine.trim();
  }

  static info(message: string, context?: LogContext): void {
    const formatted = this.formatMessage('INFO', message, context);
    console.log(formatted);
    
    if (context) {
      console.log('[STRUCTURED]', JSON.stringify({
        timestamp: this.formatTimestamp(),
        level: 'INFO',
        message,
        ...context
      }));
    }
  }

  static error(message: string, error?: any, context?: LogContext): void {
    const errorDetails = error ? ` - ${error.message || error}` : '';
    const formatted = this.formatMessage('ERROR', message + errorDetails, context);
    console.error(formatted);
    
    console.error('[STRUCTURED]', JSON.stringify({
      timestamp: this.formatTimestamp(),
      level: 'ERROR',
      message: message + errorDetails,
      ...context
    }));
    
    if (error?.stack) {
      console.error('[STACK]', error.stack);
    }
  }

  static warn(message: string, context?: LogContext): void {
    const formatted = this.formatMessage('WARN', message, context);
    console.warn(formatted);
    
    console.warn('[STRUCTURED]', JSON.stringify({
      timestamp: this.formatTimestamp(),
      level: 'WARN',
      message,
      ...context
    }));
  }

  static performance(metric: string, value: number, unit: string = 'ms', context?: LogContext): void {
    this.info(`PERF: ${metric} = ${value}${unit}`, {
      ...context,
      component: 'PERFORMANCE',
      metadata: { metric, value, unit, ...(context?.metadata || {}) }
    });
  }

  static logRequest(request: Request, response?: Response, context?: LogContext): void {
    const url = new URL(request.url);
    const requestData = {
      method: request.method,
      url: url.pathname,
      userAgent: request.headers.get('User-Agent'),
      ip: request.headers.get('CF-Connecting-IP'),
      country: request.headers.get('CF-IPCountry'),
      ray: request.headers.get('CF-Ray'),
      status: response?.status,
      contentType: response?.headers.get('Content-Type')
    };

    this.info(`${request.method} ${url.pathname}`, {
      ...context,
      component: 'REQUEST',
      metadata: requestData
    });
  }
}

function createTimer(): number {
  return Date.now();
}

function getElapsed(start: number): number {
  return Date.now() - start;
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const requestTimer = createTimer();
    const requestId = crypto.randomUUID().substring(0, 8);
    const url = new URL(request.url);
    
    // Log all incoming requests
    FrontendLogger.logRequest(request, undefined, {
      requestId,
      component: 'FRONTEND_WORKER',
      operation: 'INCOMING_REQUEST'
    });

    try {
      let response: Response;
      
      // Handle API requests - proxy to backend using service binding
      if (url.pathname.startsWith("/api/")) {
        FrontendLogger.info(`Routing API request to backend service`, {
          requestId,
          component: 'FRONTEND_WORKER',
          operation: 'SERVICE_BINDING',
          metadata: {
            originalUrl: url.pathname,
            method: request.method,
            useServiceBinding: !!env.BACKEND
          }
        });

        const serviceTimer = createTimer();
        
        try {
          // Use service binding for direct worker-to-worker communication
          const serviceUrl = new URL(request.url);
          serviceUrl.pathname = serviceUrl.pathname.slice(4);
          const serviceRequest = new Request(serviceUrl, request);
          if (env.BACKEND) {
            response = await env.BACKEND.fetch(serviceRequest);
          } else {
            // Fallback to external URL if service binding is not available
            const backendUrl = "https://odissey-backend.andre-ritossa.workers.dev";
            const proxyUrl = new URL(serviceUrl.pathname + serviceUrl.search, backendUrl);
            
            FrontendLogger.warn(`Service binding not available, falling back to external URL`, {
              requestId,
              component: 'FRONTEND_WORKER',
              operation: 'FALLBACK_FETCH',
              metadata: { proxyUrl: proxyUrl.toString() }
            });
            
            response = await fetch(proxyUrl, {
              method: request.method,
              headers: request.headers,
              body: request.body,
            });
          }

          const serviceDuration = getElapsed(serviceTimer);
          
          FrontendLogger.info(`Backend service response received`, {
            requestId,
            component: 'FRONTEND_WORKER',
            operation: 'SERVICE_RESPONSE',
            duration: serviceDuration,
            metadata: {
              status: response.status,
              statusText: response.statusText,
              contentType: response.headers.get('Content-Type'),
              usedServiceBinding: !!env.BACKEND
            }
          });

          FrontendLogger.performance('service_request_duration', serviceDuration, 'ms', {
            requestId,
            metadata: {
              method: request.method,
              endpoint: url.pathname,
              status: response.status,
              usedServiceBinding: !!env.BACKEND
            }
          });

        } catch (serviceError) {
          const serviceDuration = getElapsed(serviceTimer);
          
          FrontendLogger.error(`Backend service call failed`, serviceError, {
            requestId,
            component: 'FRONTEND_WORKER',
            operation: 'SERVICE_ERROR',
            duration: serviceDuration,
            metadata: {
              originalUrl: url.pathname,
              method: request.method,
              usedServiceBinding: !!env.BACKEND
            }
          });
          
          // Return a proper error response
          response = new Response(
            JSON.stringify({
              error: 'Backend Unavailable',
              message: 'Unable to reach backend service',
              status: 502,
              requestId: requestId
            }),
            {
              status: 502,
              headers: {
                'Content-Type': 'application/json',
                'X-Request-ID': requestId
              }
            }
          );
        }
      } else {
        // For all other requests, serve static assets
        FrontendLogger.info(`Serving static asset`, {
          requestId,
          component: 'FRONTEND_WORKER',
          operation: 'STATIC_ASSET',
          metadata: {
            path: url.pathname,
            method: request.method
          }
        });

        const assetTimer = createTimer();
        
        try {
          // The assets binding will handle SPA routing automatically
          // due to the "single-page-application" not_found_handling setting
          response = await env.ASSETS.fetch(request);
          
          const assetDuration = getElapsed(assetTimer);
          
          FrontendLogger.performance('asset_serve_duration', assetDuration, 'ms', {
            requestId,
            metadata: {
              path: url.pathname,
              status: response.status
            }
          });

        } catch (assetError) {
          const assetDuration = getElapsed(assetTimer);
          
          FrontendLogger.error(`Asset serving failed`, assetError, {
            requestId,
            component: 'FRONTEND_WORKER',
            operation: 'STATIC_ASSET_ERROR',
            duration: assetDuration,
            metadata: {
              path: url.pathname,
              method: request.method
            }
          });
          
          // Return a fallback response
          response = new Response('Asset not found', {
            status: 404,
            headers: {
              'Content-Type': 'text/plain',
              'X-Request-ID': requestId
            }
          });
        }
      }

      // Log successful response
      const totalDuration = getElapsed(requestTimer);
      
      FrontendLogger.logRequest(request, response, {
        requestId,
        component: 'FRONTEND_WORKER',
        operation: 'RESPONSE_SENT',
        duration: totalDuration
      });

      FrontendLogger.performance('total_request_duration', totalDuration, 'ms', {
        requestId,
        metadata: {
          method: request.method,
          path: url.pathname,
          status: response.status,
          isApiRequest: url.pathname.startsWith("/api/"),
          usedServiceBinding: url.pathname.startsWith("/api/") && !!env.BACKEND
        }
      });

      // Add request ID to response headers for tracking
      const responseHeaders = new Headers(response.headers);
      responseHeaders.set('X-Request-ID', requestId);
      
      return new Response(response.body, {
        status: response.status,
        statusText: response.statusText,
        headers: responseHeaders
      });

    } catch (error) {
      const totalDuration = getElapsed(requestTimer);
      
      FrontendLogger.error('Frontend worker error', error, {
        requestId,
        component: 'FRONTEND_WORKER',
        operation: 'ERROR_HANDLER',
        duration: totalDuration,
        metadata: {
          method: request.method,
          url: url.pathname,
          userAgent: request.headers.get('User-Agent'),
          ray: request.headers.get('CF-Ray')
        }
      });

      return new Response(
        JSON.stringify({
          error: 'Frontend Worker Error',
          message: 'An unexpected error occurred in the frontend worker',
          status: 500,
          requestId: requestId
        }),
        {
          status: 500,
          headers: {
            'Content-Type': 'application/json',
            'X-Request-ID': requestId
          }
        }
      );
    }
  },
} satisfies ExportedHandler; 