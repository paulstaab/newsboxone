/**
 * Error formatting utilities for user-friendly error display.
 * Aligned with FR-012: actionable copy and determinate UI states.
 */

import { ERROR_MESSAGES } from '@/lib/config/env';
import { ApiError, AuthenticationError, NetworkError } from '@/lib/api/client';

/**
 * Categorized error type for UI decisions.
 */
export type ErrorCategory =
  | 'authentication'
  | 'network'
  | 'not_found'
  | 'rate_limit'
  | 'server'
  | 'validation'
  | 'unknown';

/**
 * Formatted error with user-friendly message and metadata.
 */
export interface FormattedError {
  /** User-friendly error message */
  message: string;
  /** Error category for UI decisions */
  category: ErrorCategory;
  /** HTTP status code if available */
  statusCode?: number;
  /** Whether retry is likely to succeed */
  retryable: boolean;
  /** Suggested action for the user */
  action?: string;
  /** Original error for debugging */
  originalError?: Error;
}

/**
 * Determines error category from HTTP status code.
 */
function categorizeStatusCode(status: number): ErrorCategory {
  if (status === 401 || status === 403) return 'authentication';
  if (status === 404) return 'not_found';
  if (status === 429) return 'rate_limit';
  if (status >= 500) return 'server';
  if (status >= 400) return 'validation';
  return 'unknown';
}

/**
 * Determines if an error is retryable.
 */
function isRetryable(category: ErrorCategory): boolean {
  // Network errors and server errors are typically transient
  return ['network', 'server', 'rate_limit'].includes(category);
}

/**
 * Gets suggested action for an error category.
 */
function getActionForCategory(category: ErrorCategory): string | undefined {
  switch (category) {
    case 'authentication':
      return 'Please check your credentials and try logging in again.';
    case 'network':
      return 'Check your internet connection and try again.';
    case 'rate_limit':
      return 'Please wait a moment before trying again.';
    case 'server':
      return 'The server is experiencing issues. Try again in a few minutes.';
    case 'not_found':
      return 'The requested resource may have been moved or deleted.';
    case 'validation':
      return 'Please check your input and try again.';
    default:
      return undefined;
  }
}

/**
 * Formats an error into a user-friendly structure.
 */
export function formatError(error: unknown): FormattedError {
  // Handle AuthenticationError
  if (error instanceof AuthenticationError) {
    return {
      message: ERROR_MESSAGES.INVALID_CREDENTIALS,
      category: 'authentication',
      statusCode: 401,
      retryable: false,
      action: getActionForCategory('authentication'),
      originalError: error,
    };
  }

  // Handle NetworkError
  if (error instanceof NetworkError) {
    return {
      message: ERROR_MESSAGES.NETWORK_ERROR,
      category: 'network',
      retryable: true,
      action: getActionForCategory('network'),
      originalError: error,
    };
  }

  // Handle ApiError
  if (error instanceof ApiError) {
    const category = categorizeStatusCode(error.statusCode);
    let message: string;

    switch (category) {
      case 'not_found':
        message = ERROR_MESSAGES.NOT_FOUND;
        break;
      case 'rate_limit':
        message = ERROR_MESSAGES.RATE_LIMITED;
        break;
      case 'server':
        message = ERROR_MESSAGES.SERVER_ERROR;
        break;
      default:
        message = error.message || ERROR_MESSAGES.UNKNOWN;
    }

    return {
      message,
      category,
      statusCode: error.statusCode,
      retryable: isRetryable(category),
      action: getActionForCategory(category),
      originalError: error,
    };
  }

  // Handle generic Error
  if (error instanceof Error) {
    // Check for common error patterns
    if (error.message.toLowerCase().includes('network')) {
      return {
        message: ERROR_MESSAGES.NETWORK_ERROR,
        category: 'network',
        retryable: true,
        action: getActionForCategory('network'),
        originalError: error,
      };
    }

    if (error.message.toLowerCase().includes('cors')) {
      return {
        message: ERROR_MESSAGES.NETWORK_ERROR,
        category: 'network',
        retryable: false,
        action: 'Retry the request or check that the NewsBoxOne API is reachable.',
        originalError: error,
      };
    }

    return {
      message: error.message || ERROR_MESSAGES.UNKNOWN,
      category: 'unknown',
      retryable: false,
      originalError: error,
    };
  }

  // Handle unknown error types
  return {
    message: ERROR_MESSAGES.UNKNOWN,
    category: 'unknown',
    retryable: false,
  };
}

/**
 * Extracts a simple message string from any error.
 */
export function getErrorMessage(error: unknown): string {
  return formatError(error).message;
}

/**
 * Checks if an error indicates offline status.
 */
export function isOfflineError(error: unknown): boolean {
  if (error instanceof NetworkError) return true;
  if (error instanceof Error && !navigator.onLine) return true;
  return false;
}

/**
 * Creates a formatted error for offline state.
 */
export function createOfflineError(): FormattedError {
  return {
    message: ERROR_MESSAGES.OFFLINE,
    category: 'network',
    retryable: true,
    action: 'Connect to the internet to sync your feeds.',
  };
}

/**
 * Creates a formatted error for session expiration.
 */
export function createSessionExpiredError(): FormattedError {
  return {
    message: ERROR_MESSAGES.SESSION_EXPIRED,
    category: 'authentication',
    retryable: false,
    action: getActionForCategory('authentication'),
  };
}
