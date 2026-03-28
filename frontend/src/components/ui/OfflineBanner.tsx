'use client';

/**
 * Offline status banner component.
 * Displays when the user is offline to provide feedback.
 */

import { useEffect, useState, useSyncExternalStore } from 'react';

/**
 * Props for the OfflineBanner component.
 */
export interface OfflineBannerProps {
  /** Custom message to display when offline */
  message?: string;
}

/**
 * Tracks browser online/offline state.
 */
export function useOnlineStatus(): boolean {
  const subscribe = (callback: () => void) => {
    if (typeof window === 'undefined') {
      return () => undefined;
    }
    window.addEventListener('online', callback);
    window.addEventListener('offline', callback);
    return () => {
      window.removeEventListener('online', callback);
      window.removeEventListener('offline', callback);
    };
  };

  const getSnapshot = () => (typeof navigator !== 'undefined' ? navigator.onLine : true);

  return useSyncExternalStore(subscribe, getSnapshot, () => true);
}

/**
 * Shows an offline status banner.
 */
export function OfflineBanner({
  message = 'You are currently offline. Some features may be unavailable.',
}: OfflineBannerProps) {
  const isOnline = useOnlineStatus();
  const [dismissed, setDismissed] = useState(false);

  // Reset dismissed state when coming back online then going offline again
  useEffect(() => {
    if (isOnline) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setDismissed(false);
    }
  }, [isOnline]);

  // Don't render if online or dismissed
  if (isOnline || dismissed) {
    return null;
  }

  return (
    <div
      role="alert"
      aria-live="polite"
      className="fixed bottom-0 left-0 right-0 z-50 flex items-center justify-between bg-yellow-50 px-4 py-3 shadow-lg sm:px-6"
    >
      <div className="flex items-center gap-3">
        <svg
          className="h-5 w-5 flex-shrink-0 text-yellow-600"
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
          aria-hidden="true"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M18.364 5.636a9 9 0 010 12.728m0 0l-2.829-2.829m2.829 2.829L21 21M15.536 8.464a5 5 0 010 7.072m0 0l-2.829-2.829m-4.243 2.829a4.978 4.978 0 01-1.414-2.83m-1.414 5.658a9 9 0 01-2.167-9.238m7.824 2.167a1 1 0 111.414 1.414m-1.414-1.414L3 3m8.293 8.293l1.414 1.414"
          />
        </svg>
        <span className="text-sm font-medium text-yellow-800">{message}</span>
      </div>
      <button
        onClick={() => {
          setDismissed(true);
        }}
        className="ml-4 rounded-md p-1.5 text-yellow-600 hover:bg-yellow-100 hover:text-yellow-800 focus:outline-none focus:ring-2 focus:ring-yellow-600 focus:ring-offset-2 focus:ring-offset-yellow-50"
        aria-label="Dismiss offline notification"
      >
        <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M6 18L18 6M6 6l12 12"
          />
        </svg>
      </button>
    </div>
  );
}

export default OfflineBanner;
