/**
 * Authenticated fetch client with Basic auth, exponential backoff, and error mapping.
 */

import { CONFIG, ERROR_MESSAGES } from '@/lib/config/env';
import { loadSession, clearSession } from '@/lib/storage';

/**
 * Custom error class for API errors with status code and parsed body.
 */
export class ApiError extends Error {
  constructor(
    public readonly status: number,
    public readonly statusText: string,
    public readonly body?: unknown,
  ) {
    super(`API Error ${String(status)}: ${statusText}`);
    this.name = 'ApiError';
  }

  get statusCode(): number {
    return this.status;
  }
}

/**
 * Custom error class for authentication failures.
 */
export class AuthenticationError extends Error {
  constructor(message: string = ERROR_MESSAGES.INVALID_CREDENTIALS) {
    super(message);
    this.name = 'AuthenticationError';
  }
}

/**
 * Custom error class for network/connection failures.
 */
export class NetworkError extends Error {
  constructor(message: string = ERROR_MESSAGES.NETWORK_ERROR) {
    super(message);
    this.name = 'NetworkError';
  }
}

/**
 * Request options extending standard RequestInit with retry configuration.
 */
export interface ApiRequestOptions extends Omit<RequestInit, 'headers'> {
  headers?: Record<string, string>;
  /** Controls how successful responses are parsed (default: json). */
  responseType?: 'json' | 'text';
  /** Skip authentication header */
  skipAuth?: boolean;
  /** Override auth credentials for this request */
  overrideCredentials?: string;
  /** Number of retry attempts (default: CONFIG.MAX_RETRIES) */
  maxRetries?: number;
  /** Disable retry logic */
  noRetry?: boolean;
}

/**
 * Calculates delay for exponential backoff with jitter.
 */
function getBackoffDelay(attempt: number): number {
  const baseDelay = CONFIG.RETRY_BASE_DELAY;
  const exponentialDelay = baseDelay * Math.pow(2, attempt);
  // Add jitter: ±25%
  const jitter = exponentialDelay * 0.25 * (Math.random() * 2 - 1);
  return Math.min(exponentialDelay + jitter, 30000); // cap at 30s
}

/**
 * Determines if an error/status code is retryable.
 */
function isRetryable(status: number): boolean {
  // Retry on server errors and rate limiting
  return status >= 500 || status === 429 || status === 408;
}

/**
 * Sleep for a given number of milliseconds.
 */
function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Makes an authenticated API request with retry logic.
 */
export async function apiRequest<T>(endpoint: string, options: ApiRequestOptions = {}): Promise<T> {
  const {
    skipAuth = false,
    overrideCredentials,
    maxRetries = CONFIG.MAX_RETRIES,
    noRetry = false,
    responseType = 'json',
    headers: customHeaders = {},
    ...fetchOptions
  } = options;

  // Get session for auth data.
  const session = loadSession();

  // Build full URL
  const url = `${CONFIG.API_PATH}${endpoint}`;

  // Build headers
  const headers: Record<string, string> = {
    Accept: 'application/json',
    'User-Agent': CONFIG.USER_AGENT,
    ...customHeaders,
  };

  // Add auth header if not skipped
  if (!skipAuth) {
    const credentials = overrideCredentials ?? session?.credentials;
    if (!credentials) {
      throw new AuthenticationError(ERROR_MESSAGES.SESSION_EXPIRED);
    }
    headers.Authorization = `Basic ${credentials}`;
  }

  // Add Content-Type for requests with body
  if (fetchOptions.body && !headers['Content-Type']) {
    headers['Content-Type'] = 'application/json';
  }

  // Retry loop
  let lastError: Error | null = null;
  const attempts = noRetry ? 1 : maxRetries + 1;

  for (let attempt = 0; attempt < attempts; attempt++) {
    try {
      const response = await fetch(url, {
        ...fetchOptions,
        headers,
      });

      // Handle authentication errors
      if (response.status === 401) {
        clearSession();
        throw new AuthenticationError(ERROR_MESSAGES.SESSION_EXPIRED);
      }

      // Handle rate limiting with Retry-After header
      if (response.status === 429) {
        const retryAfter = response.headers.get('Retry-After');
        const delay = retryAfter ? parseInt(retryAfter, 10) * 1000 : getBackoffDelay(attempt);

        if (attempt < attempts - 1) {
          await sleep(delay);
          continue;
        }
        throw new ApiError(429, ERROR_MESSAGES.RATE_LIMITED);
      }

      // Handle retryable errors
      if (!response.ok && isRetryable(response.status) && attempt < attempts - 1) {
        await sleep(getBackoffDelay(attempt));
        continue;
      }

      // Handle other errors
      if (!response.ok) {
        let body: unknown;
        try {
          body = await response.json();
        } catch {
          body = await response.text();
        }

        throw new ApiError(response.status, response.statusText, body);
      }

      // Parse successful response
      if (responseType === 'text') {
        return (await response.text()) as T;
      }

      const contentType = response.headers.get('Content-Type');
      if (contentType?.includes('application/json')) {
        return (await response.json()) as T;
      }

      // Return empty object for 204 No Content or non-JSON responses
      return {} as T;
    } catch (error) {
      // Handle network errors (TypeError from fetch)
      if (error instanceof TypeError) {
        lastError = new NetworkError(ERROR_MESSAGES.NETWORK_ERROR);

        if (attempt < attempts - 1) {
          await sleep(getBackoffDelay(attempt));
          continue;
        }
        throw lastError;
      }

      // Re-throw API/Auth errors
      if (error instanceof ApiError || error instanceof AuthenticationError) {
        throw error;
      }

      // Handle unknown errors
      lastError = error instanceof Error ? error : new Error(String(error));

      if (attempt < attempts - 1) {
        await sleep(getBackoffDelay(attempt));
        continue;
      }
      throw lastError;
    }
  }

  // Should not reach here, but TypeScript needs this
  throw lastError ?? new Error(ERROR_MESSAGES.UNKNOWN);
}

/**
 * Convenience method for GET requests.
 */
export async function apiGet<T>(endpoint: string, options?: ApiRequestOptions): Promise<T> {
  return apiRequest<T>(endpoint, { ...options, method: 'GET' });
}

/**
 * Convenience method for POST requests.
 */
export async function apiPost<T>(
  endpoint: string,
  body?: unknown,
  options?: ApiRequestOptions,
): Promise<T> {
  return apiRequest<T>(endpoint, {
    ...options,
    method: 'POST',
    body: body ? JSON.stringify(body) : undefined,
  });
}

/**
 * Convenience method for PUT requests.
 */
export async function apiPut<T>(
  endpoint: string,
  body?: unknown,
  options?: ApiRequestOptions,
): Promise<T> {
  return apiRequest<T>(endpoint, {
    ...options,
    method: 'PUT',
    body: body ? JSON.stringify(body) : undefined,
  });
}

/**
 * Convenience method for DELETE requests.
 */
export async function apiDelete<T>(endpoint: string, options?: ApiRequestOptions): Promise<T> {
  return apiRequest<T>(endpoint, { ...options, method: 'DELETE' });
}

/**
 * Validates credentials by attempting to fetch feeds.
 * Returns success/error result without throwing.
 */
export async function validateCredentials(
  authCredentials: string,
): Promise<{ valid: boolean; error?: string }> {
  try {
    await apiGet('/feeds', {
      overrideCredentials: authCredentials,
      skipAuth: false,
      noRetry: true,
    });
    return { valid: true };
  } catch (error) {
    if (error instanceof AuthenticationError) {
      return { valid: false, error: ERROR_MESSAGES.INVALID_CREDENTIALS };
    }
    if (error instanceof NetworkError) {
      return { valid: false, error: ERROR_MESSAGES.NETWORK_ERROR };
    }
    if (error instanceof ApiError) {
      if (error.status === 404) {
        return { valid: false, error: ERROR_MESSAGES.NOT_FOUND };
      }
      return { valid: false, error: ERROR_MESSAGES.SERVER_ERROR };
    }
    return { valid: false, error: ERROR_MESSAGES.UNKNOWN };
  }
}
