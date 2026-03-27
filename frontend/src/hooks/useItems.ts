'use client';

import { useCallback, useMemo } from 'react';
import useSWRImmutable from 'swr/immutable';
import { getItems } from '@/lib/api/items';
import { useAuth } from '@/hooks/useAuth';
import type { Article } from '@/types';
import { UNCATEGORIZED_FOLDER_ID } from '@/types';

export interface UseItemsOptions {
  activeFolderId?: number | null;
}

export interface UseItemsResult {
  items: Article[];
  allItems: Article[];
  isLoading: boolean;
  isValidating: boolean;
  error: Error | null;
  refresh: () => Promise<Article[] | undefined>;
}

/**
 * Fetches items and exposes filtered and full lists for the timeline.
 */
export function useItems(options: UseItemsOptions = {}): UseItemsResult {
  const { activeFolderId } = options;
  const { isAuthenticated, isInitializing, session } = useAuth();

  // Scope SWR key by session identity to prevent data leakage across accounts
  const swrKey =
    isAuthenticated && !isInitializing && session ? ['items', session.username] : null;
  const { data, error, isLoading, isValidating, mutate } = useSWRImmutable<Article[], Error>(
    swrKey,
    getItems,
  );

  const allItems = useMemo(() => data ?? [], [data]);
  const items = useMemo(() => {
    if (typeof activeFolderId !== 'number') {
      return allItems;
    }
    return allItems.filter((item) => {
      const itemFolderId = item.folderId ?? UNCATEGORIZED_FOLDER_ID;
      return itemFolderId === activeFolderId;
    });
  }, [activeFolderId, allItems]);

  const refresh = useCallback(() => mutate(), [mutate]);

  return {
    items,
    allItems,
    isLoading,
    isValidating,
    error: error ?? null,
    refresh,
  };
}
