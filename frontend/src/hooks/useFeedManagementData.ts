'use client';

import { useCallback, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuthGuard } from '@/hooks/useAuthGuard';
import { getFeeds } from '@/lib/api/feeds';
import { getFolders } from '@/lib/api/folders';
import { AuthenticationError } from '@/lib/api/client';
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
  const { isAuthenticated, isInitializing, logout } = useAuthGuard();
  const [data, setData] = useState<FeedManagementData>({ folders: [], feeds: [] });
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [pageError, setPageError] = useState<string | null>(null);

  const handleRequestError = useCallback(
    (error: unknown, fallbackMessage: string) => {
      if (error instanceof AuthenticationError) {
        void logout();
        router.push('/login');
        return fallbackMessage;
      }

      const formatted = formatError(error);
      return [formatted.message || fallbackMessage, formatted.action].filter(Boolean).join(' ');
    },
    [logout, router],
  );

  const refreshPageData = useCallback(
    async (initialLoad = false) => {
      if (initialLoad) {
        setIsLoading(true);
      } else {
        setIsRefreshing(true);
      }

      try {
        const [folders, feedsResponse] = await Promise.all([getFolders(), getFeeds()]);
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
    [handleRequestError],
  );

  useEffect(() => {
    if (!isInitializing && isAuthenticated) {
      void refreshPageData(true);
    }
  }, [isAuthenticated, isInitializing, refreshPageData]);

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
