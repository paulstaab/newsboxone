'use client';

/**
 * Async boundary component for error handling and loading states.
 * Provides retry controls and user-friendly error display.
 * Aligned with FR-012: graceful error handling with actionable copy.
 */

import { Component, type ErrorInfo, type ReactNode, Suspense } from 'react';
import { formatError, type FormattedError } from '@/lib/utils/errorFormatter';

/**
 * Props for the fallback loading component.
 */
export interface LoadingFallbackProps {
  /** Optional message to display */
  message?: string;
}

/**
 * Default loading UI for async boundaries.
 */
export function LoadingFallback({ message = 'Loading...' }: LoadingFallbackProps) {
  return (
    <div role="status" aria-live="polite" className="flex items-center justify-center p-4">
      <div className="flex flex-col items-center gap-2">
        <div
          className="h-6 w-6 animate-spin rounded-full border-2 border-gray-300 border-t-blue-600"
          aria-hidden="true"
        />
        <span className="text-sm text-gray-600">{message}</span>
      </div>
    </div>
  );
}

/**
 * Props for the error fallback component.
 */
export interface ErrorFallbackProps {
  /** Formatted error information */
  error: FormattedError;
  /** Callback to retry the failed operation */
  onRetry?: () => void;
  /** Callback to reset the error state */
  onReset?: () => void;
}

/**
 * Default error UI for async boundaries.
 */
export function ErrorFallback({ error, onRetry, onReset }: ErrorFallbackProps) {
  return (
    <div
      role="alert"
      aria-live="assertive"
      className="flex flex-col items-center justify-center gap-4 p-6 text-center"
    >
      <div className="rounded-full bg-red-100 p-3">
        <svg
          className="h-6 w-6 text-red-600"
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
          aria-hidden="true"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
          />
        </svg>
      </div>

      <div className="space-y-2">
        <h2 className="text-lg font-semibold text-gray-900">Something went wrong</h2>
        <p className="text-sm text-gray-600">{error.message}</p>
        {error.action && <p className="text-sm text-gray-500">{error.action}</p>}
      </div>

      <div className="flex gap-3">
        {error.retryable && onRetry && (
          <button
            onClick={onRetry}
            className="rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2"
          >
            Try Again
          </button>
        )}
        {onReset && (
          <button
            onClick={onReset}
            className="rounded-md border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2"
          >
            Go Back
          </button>
        )}
      </div>
    </div>
  );
}

/**
 * Props for the error boundary component.
 */
interface ErrorBoundaryProps {
  children: ReactNode;
  /** Custom fallback render function */
  fallback?: (props: ErrorFallbackProps) => ReactNode;
  /** Callback when an error is caught */
  onError?: (error: Error, errorInfo: ErrorInfo) => void;
  /** Callback to retry after error */
  onRetry?: () => void;
  /** Callback to reset the boundary */
  onReset?: () => void;
}

/**
 * State for the error boundary.
 */
interface ErrorBoundaryState {
  hasError: boolean;
  error: FormattedError | null;
}

/**
 * Class-based error boundary component.
 * React requires class components for error boundaries.
 */
class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  constructor(props: ErrorBoundaryProps) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return {
      hasError: true,
      error: formatError(error),
    };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo): void {
    // Log to console in development
    if (process.env.NODE_ENV === 'development') {
      console.error('ErrorBoundary caught error:', error, errorInfo);
    }

    // Call optional onError callback
    this.props.onError?.(error, errorInfo);
  }

  handleRetry = (): void => {
    this.setState({ hasError: false, error: null });
    this.props.onRetry?.();
  };

  handleReset = (): void => {
    this.setState({ hasError: false, error: null });
    this.props.onReset?.();
  };

  render(): ReactNode {
    if (this.state.hasError && this.state.error) {
      const { fallback } = this.props;

      if (fallback) {
        return fallback({
          error: this.state.error,
          onRetry: this.handleRetry,
          onReset: this.handleReset,
        });
      }

      return (
        <ErrorFallback
          error={this.state.error}
          onRetry={this.handleRetry}
          onReset={this.handleReset}
        />
      );
    }

    return this.props.children;
  }
}

/**
 * Props for the AsyncBoundary component.
 */
export interface AsyncBoundaryProps {
  children: ReactNode;
  /** Loading fallback component */
  loadingFallback?: ReactNode;
  /** Custom error fallback render function */
  errorFallback?: (props: ErrorFallbackProps) => ReactNode;
  /** Callback when an error is caught */
  onError?: (error: Error, errorInfo: ErrorInfo) => void;
  /** Callback to retry after error */
  onRetry?: () => void;
  /** Callback to reset the boundary */
  onReset?: () => void;
}

/**
 * Wraps children with suspense and error boundary behavior.
 */
export function AsyncBoundary({
  children,
  loadingFallback = <LoadingFallback />,
  errorFallback,
  onError,
  onRetry,
  onReset,
}: AsyncBoundaryProps) {
  return (
    <ErrorBoundary fallback={errorFallback} onError={onError} onRetry={onRetry} onReset={onReset}>
      <Suspense fallback={loadingFallback}>{children}</Suspense>
    </ErrorBoundary>
  );
}

export { ErrorBoundary };
export default AsyncBoundary;
