'use client';

import { useLiveState } from '@/hooks/useLiveState';

import { useCallback, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuthGuard } from '@/hooks/useAuthGuard';
import { api, AuthenticationError } from '@/lib/api';
import { formatError } from '@/lib/utils/errorFormatter';
import type { Feed, Folder } from '@/types';

export interface FeedManagementData {
  folders: Folder[];
  feeds: Feed[];
}

/**
 * Loads feed-management data and centralizes auth-aware request error handling.
 */
export function useFeedManagementData() {
  const router = useRouter();
  const { isAuthenticated, isInitializing } = useAuthGuard();
  const [data, setData] = useLiveState<FeedManagementData>({ folders: [], feeds: [] });
  const [isLoading, setIsLoading] = useLiveState(true);
  const [isRefreshing, setIsRefreshing] = useLiveState(false);
  const [pageError, setPageError] = useLiveState<string | null>(null);

  const handleRequestError = useCallback(
    (error: unknown, fallbackMessage: string) => {
      if (error instanceof AuthenticationError) {
        router.push('/login');
        return fallbackMessage;
      }

      const formatted = formatError(error);
      return [formatted.message || fallbackMessage, formatted.action].filter(Boolean).join(' ');
    },
    [router],
  );

  const refreshPageData = useCallback(
    async (initialLoad = false) => {
      if (initialLoad) {
        setIsLoading(true);
      } else {
        setIsRefreshing(true);
      }

      try {
        const [folders, feedsResponse] = await Promise.all([
          api.folders.getAll(),
          api.feeds.getAll(),
        ]);
        setData({ folders, feeds: feedsResponse.feeds });
        setPageError(null);
      } catch (error) {
        const message = handleRequestError(error, 'Unable to load feed management data.');
        setPageError(message);
      } finally {
        if (initialLoad) {
          setIsLoading(false);
        } else {
          setIsRefreshing(false);
        }
      }
    },
    [handleRequestError, setIsLoading, setIsRefreshing, setData, setPageError],
  );

  useEffect(() => {
    let cancelled = false;

    if (isInitializing) {
      return undefined;
    }

    if (isAuthenticated) {
      queueMicrotask(() => {
        if (!cancelled) {
          void refreshPageData(true);
        }
      });
      return () => {
        cancelled = true;
      };
    }

    queueMicrotask(() => {
      if (!cancelled) {
        setIsLoading(false);
        setIsRefreshing(false);
      }
    });

    return () => {
      cancelled = true;
    };
  }, [isAuthenticated, isInitializing, refreshPageData, setIsLoading, setIsRefreshing]);

  return {
    isAuthenticated,
    isInitializing,
    isLoading,
    isRefreshing,
    data,
    setData,
    pageError,
    handleRequestError,
    refreshPageData,
  };
}
