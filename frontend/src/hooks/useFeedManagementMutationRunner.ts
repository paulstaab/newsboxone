'use client';

import { useLiveState } from '@/hooks/useLiveState';

import { useOnlineStatus } from '@/components/ui/OfflineBanner';
import { useCallback, useRef, useEffect } from 'react';

/**
 * Wraps feed-management mutations with busy, status, refresh, and error state handling.
 */
interface FeedManagementMutationOptions {
  onError?: (message: string) => void;
  suppressGlobalError?: boolean;
}

export function useFeedManagementMutationRunner(
  refreshPageData: (initialLoad?: boolean) => Promise<void>,
  handleRequestError: (error: unknown, fallbackMessage: string) => string,
) {
  const online = useOnlineStatus();
  const pendingRef = useRef(false);
  const mountedRef = useRef(true);
  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
    };
  }, []);
  const [busyLabel, setBusyLabel] = useLiveState<string | null>(null);
  const [mutationError, setMutationError] = useLiveState<string | null>(null);
  const [statusMessage, setStatusMessage] = useLiveState<string | null>(null);

  const runMutation = useCallback(
    async (
      label: string,
      action: () => Promise<void>,
      options: FeedManagementMutationOptions = {},
    ) => {
      if (pendingRef.current) return false;
      if (!navigator.onLine) {
        setMutationError('Feed changes are unavailable while offline.');
        return false;
      }
      pendingRef.current = true;
      setBusyLabel(label);
      setMutationError(null);
      setStatusMessage(null);

      try {
        await action();
        if (mountedRef.current) await refreshPageData(false);
        return true;
      } catch (error) {
        if (!mountedRef.current) return false;
        const message = handleRequestError(error, `${label} failed.`);
        options.onError?.(message);
        if (!options.suppressGlobalError) {
          setMutationError(message);
        }
        return false;
      } finally {
        pendingRef.current = false;
        if (mountedRef.current) setBusyLabel(null);
      }
    },
    [handleRequestError, refreshPageData, setMutationError, setStatusMessage, setBusyLabel],
  );

  return {
    busyLabel: online ? busyLabel : 'Offline',
    mutationError,
    statusMessage,
    setMutationError,
    setStatusMessage,
    runMutation,
  };
}
