import { ApiError } from '../routes/api-types';

// CORS headers for cross-origin requests
export const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, PUT, PATCH, DELETE, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-Requested-With',
  'Access-Control-Max-Age': '86400', // 24 hours
};


/**
 * Create a standardized JSON response
 */
export function createJsonResponse(
  data: any,
  status: number = 200,
  additionalHeaders: Record<string, string> = {}
): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      'Content-Type': 'application/json',
      ...corsHeaders,
      ...additionalHeaders,
    },
  });
}

/**
 * Create an error response
 */
export function createErrorResponse(
  message: string,
  status: number = 400,
  error: string = 'Bad Request'
): Response {
  const errorData: ApiError = {
    error,
    message,
    status,
  };
  
  return createJsonResponse(errorData, status);
}

/**
 * Parse JSON request body safely
 */
export async function parseJsonBody<T>(request: Request): Promise<T> {
  try {
    const body = await request.text();
    if (!body) {
      throw new Error('Request body is empty');
    }
    return JSON.parse(body) as T;
  } catch (error) {
    throw new Error('Invalid JSON in request body');
  }
}
