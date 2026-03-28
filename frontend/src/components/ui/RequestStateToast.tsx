'use client';

import { useCallback, useLayoutEffect, useState } from 'react';

export type ToastType = 'error' | 'warning' | 'success' | 'info';

export interface ToastMessage {
  id: string;
  type: ToastType;
  title: string;
  message: string;
  action?: {
    label: string;
    onClick: () => void;
  };
  duration?: number; // Auto-dismiss after milliseconds, 0 = no auto-dismiss
}

interface RequestStateToastProps {
  message: ToastMessage | null;
  onDismiss?: (id: string) => void;
}

/**
 * Displays a single request state toast.
 */
export function RequestStateToast({ message, onDismiss }: RequestStateToastProps) {
  const [isVisible, setIsVisible] = useState(false);

  const handleDismiss = useCallback(() => {
    setIsVisible(false);
    if (message && onDismiss) {
      setTimeout(() => {
        onDismiss(message.id);
      }, 300); // Wait for animation
    }
  }, [message, onDismiss]);

  useLayoutEffect(() => {
    if (message) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setIsVisible(true);

      // Auto-dismiss after duration
      if (message.duration && message.duration > 0) {
        const timer = setTimeout(() => {
          handleDismiss();
        }, message.duration);

        return () => {
          clearTimeout(timer);
        };
      }
    } else {
      setIsVisible(false);
    }

    return undefined;
  }, [message, handleDismiss]);

  if (!message) return null;

  const typeStyles = {
    error: 'bg-red-50 border-red-200 text-red-900',
    warning: 'bg-yellow-50 border-yellow-200 text-yellow-900',
    success: 'bg-green-50 border-green-200 text-green-900',
    info: 'bg-blue-50 border-blue-200 text-blue-900',
  };

  const iconStyles = {
    error: 'text-red-600',
    warning: 'text-yellow-600',
    success: 'text-green-600',
    info: 'text-blue-600',
  };

  const getIcon = () => {
    switch (message.type) {
      case 'error':
        return (
          <svg
            className="w-5 h-5"
            fill="none"
            strokeWidth="2"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path d="M10 14l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2m7-2a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
        );
      case 'warning':
        return (
          <svg
            className="w-5 h-5"
            fill="none"
            strokeWidth="2"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
          </svg>
        );
      case 'success':
        return (
          <svg
            className="w-5 h-5"
            fill="none"
            strokeWidth="2"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
        );
      case 'info':
        return (
          <svg
            className="w-5 h-5"
            fill="none"
            strokeWidth="2"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
        );
    }
  };

  if (!isVisible) return null;

  return (
    <div
      className="fixed bottom-4 right-4 max-w-md w-full transition-all duration-300 opacity-100 translate-y-0"
      role="alert"
      aria-live="assertive"
    >
      <div className={`border rounded-lg shadow-lg p-4 ${typeStyles[message.type]}`}>
        <div className="flex items-start gap-3">
          <div className={`flex-shrink-0 ${iconStyles[message.type]}`}>{getIcon()}</div>

          <div className="flex-1 min-w-0">
            <h4 className="font-semibold mb-1">{message.title}</h4>
            <p className="text-sm">{message.message}</p>

            {message.action && (
              <button
                onClick={message.action.onClick}
                className="mt-3 text-sm font-medium underline hover:no-underline focus:outline-none"
              >
                {message.action.label}
              </button>
            )}
          </div>

          <button
            onClick={handleDismiss}
            className="flex-shrink-0 p-1 rounded hover:bg-black/5 transition-colors"
            aria-label="Dismiss"
          >
            <svg
              className="w-5 h-5"
              fill="none"
              strokeWidth="2"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
      </div>
    </div>
  );
}

/**
 * Manages toast queue state for requests.
 */
export function useToast() {
  const [toasts, setToasts] = useState<ToastMessage[]>([]);

  const showToast = useCallback((toast: Omit<ToastMessage, 'id'>) => {
    const id = `toast-${String(Date.now())}-${String(Math.random())}`;
    setToasts((prev) => [...prev, { ...toast, id }]);
  }, []);

  const dismissToast = useCallback((id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  const showError = useCallback(
    (title: string, message: string, action?: ToastMessage['action']) => {
      showToast({ type: 'error', title, message, action, duration: 0 });
    },
    [showToast],
  );

  const showRetryError = useCallback(
    (message: string, onRetry: () => void) => {
      showToast({
        type: 'error',
        title: 'Request Failed',
        message,
        action: {
          label: 'Retry',
          onClick: onRetry,
        },
        duration: 0,
      });
    },
    [showToast],
  );

  const showRateLimitWarning = useCallback(
    (retryAfter?: number) => {
      const message = retryAfter
        ? `Too many requests. Please wait ${String(Math.ceil(retryAfter / 1000))} seconds before trying again.`
        : 'Too many requests. Please wait before trying again.';

      showToast({
        type: 'warning',
        title: 'Rate Limited',
        message,
        duration: retryAfter ?? 5000,
      });
    },
    [showToast],
  );

  const showBackoffWarning = useCallback(
    (attempt: number, delay: number) => {
      showToast({
        type: 'warning',
        title: 'Connection Issue',
        message: `Retrying request (attempt ${String(attempt)})... Waiting ${String(Math.ceil(delay / 1000))} seconds.`,
        duration: delay,
      });
    },
    [showToast],
  );

  return {
    toasts,
    showToast,
    dismissToast,
    showError,
    showRetryError,
    showRateLimitWarning,
    showBackoffWarning,
  };
}

/**
 * Renders the toast container with transitions.
 */
export function ToastContainer() {
  const { toasts, dismissToast } = useToast();

  return (
    <div className="fixed bottom-4 right-4 space-y-2 z-50 pointer-events-none">
      {toasts.map((toast) => (
        <div key={toast.id} className="pointer-events-auto">
          <RequestStateToast message={toast} onDismiss={dismissToast} />
        </div>
      ))}
    </div>
  );
}
