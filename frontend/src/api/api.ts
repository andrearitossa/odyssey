import { API_URL } from "../config";
import { AccountSession } from "./accounts";
export { API_URL };
export class ApiError extends Error {
  constructor(
    message: string,
    public status?: number,
  ) {
    super(message);
    this.name = "ApiError";
  }
}
type AuthErrorHandler = (error: unknown) => Promise<void>;
let authErrorHandler: AuthErrorHandler | null = null;
const responseCredentials = new WeakMap<Response, string>();
export const setGlobalAuthErrorHandler = (handler: AuthErrorHandler | null) => {
  authErrorHandler = handler;
};

export async function handleResponse<T>(response: Response): Promise<T> {
  if (!response.ok) {
    let message = `Request failed (${response.status})`;
    try {
      const data = await response.json();
      message = data.message || data.error || message;
    } catch {
      /* Non-JSON error response. */
    }
    const error = new ApiError(message, response.status);
    if (response.status === 401) {
      const credential = responseCredentials.get(response);
      const currentToken = await AccountSession.token();
      // A request from the previous account must not sign out the current one.
      if (credential && credential === `Bearer ${currentToken}`)
        await authErrorHandler?.(error);
    }
    throw error;
  }
  try {
    return await response.json();
  } catch {
    throw new ApiError("Invalid JSON response from server");
  }
}

export async function authenticatedFetch(
  url: string,
  config: RequestInit = {},
): Promise<Response> {
  const headers = new Headers(config.headers);
  const requiresAuth = !headers.has("X-No-Auth");
  headers.delete("X-No-Auth");
  if (requiresAuth && !headers.has("Authorization")) {
    const token = await AccountSession.token();
    if (token) headers.set("Authorization", `Bearer ${token}`);
  }
  if (
    config.body &&
    !headers.has("Content-Type") &&
    typeof config.body === "string"
  )
    headers.set("Content-Type", "application/json");
  const controller = config.signal ? null : new AbortController();
  const timeout = controller
    ? setTimeout(() => controller.abort(), 30000)
    : null;
  try {
    const response = await fetch(url, {
      ...config,
      headers,
      signal: config.signal ?? controller?.signal,
    });
    const credential = headers.get("Authorization");
    if (credential) responseCredentials.set(response, credential);
    return response;
  } finally {
    if (timeout) clearTimeout(timeout);
  }
}

export interface RequestConfig {
  url: string;
  method?: "GET" | "POST" | "PUT" | "DELETE" | "PATCH";
  body?: unknown;
  headers?: Record<string, string>;
  requiresAuth?: boolean;
}
export class ApiClient {
  private static instance = new ApiClient();
  static getInstance() {
    return ApiClient.instance;
  }
  async request<T = unknown>({
    url,
    method = "GET",
    body,
    headers = {},
    requiresAuth = true,
  }: RequestConfig): Promise<T> {
    const response = await authenticatedFetch(`${API_URL}${url}`, {
      method,
      headers: {
        ...headers,
        ...(!requiresAuth ? { "X-No-Auth": "true" } : {}),
      },
      body:
        body === undefined
          ? undefined
          : typeof body === "string"
            ? body
            : JSON.stringify(body),
    });
    return handleResponse<T>(response);
  }
  get<T = unknown>(url: string, config?: Partial<RequestConfig>) {
    return this.request<T>({ ...config, url, method: "GET" });
  }
  post<T = unknown>(
    url: string,
    body?: unknown,
    config?: Partial<RequestConfig>,
  ) {
    return this.request<T>({ ...config, url, body, method: "POST" });
  }
  put<T = unknown>(
    url: string,
    body?: unknown,
    config?: Partial<RequestConfig>,
  ) {
    return this.request<T>({ ...config, url, body, method: "PUT" });
  }
  delete<T = unknown>(url: string, config?: Partial<RequestConfig>) {
    return this.request<T>({ ...config, url, method: "DELETE" });
  }
  patch<T = unknown>(
    url: string,
    body?: unknown,
    config?: Partial<RequestConfig>,
  ) {
    return this.request<T>({ ...config, url, body, method: "PATCH" });
  }
}
export const apiClient = ApiClient.getInstance();
