'use client';

import { useCallback, useState } from 'react';

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
  const [busyLabel, setBusyLabel] = useState<string | null>(null);
  const [mutationError, setMutationError] = useState<string | null>(null);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);

  const runMutation = useCallback(
    async (
      label: string,
      action: () => Promise<void>,
      options: FeedManagementMutationOptions = {},
    ) => {
      setBusyLabel(label);
      setMutationError(null);
      setStatusMessage(null);

      try {
        await action();
        await refreshPageData(false);
        return true;
      } catch (error) {
        const message = handleRequestError(error, `${label} failed.`);
        options.onError?.(message);
        if (!options.suppressGlobalError) {
          setMutationError(message);
        }
        return false;
      } finally {
        setBusyLabel(null);
      }
    },
    [handleRequestError, refreshPageData],
  );

  return {
    busyLabel,
    mutationError,
    statusMessage,
    setMutationError,
    setStatusMessage,
    runMutation,
  };
}
