'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import useSWRImmutable from 'swr/immutable';
import { getFolders } from '@/lib/api/folders';
import { getFeeds } from '@/lib/api/feeds';
import { markItemsRead, markItemRead as apiMarkItemRead } from '@/lib/api/items';
import { fetchUnreadItemsForSync } from '@/lib/api/itemsSync';
import { reconcileTimelineCache } from '@/lib/storage/timelineCache';
import {
  deriveFolderProgress,
  pinActiveFolder,
  sortFolderQueueEntries,
} from '@/lib/utils/unreadAggregator';
import {
  type ArticlePreview,
  type Folder,
  type FolderProgressState,
  type FolderQueueEntry,
  type TimelineCacheEnvelope,
  UNCATEGORIZED_FOLDER_ID,
  type SelectionActions,
} from '@/types';
import {
  createEmptyTimelineCache,
  loadTimelineCache,
  mergeItemsIntoCache,
  storeTimelineCache,
} from '@/lib/storage';
import {
  applyFeedNames,
  applyFolderNames,
  resolveFolderId,
  toArticlePreview,
} from '@/lib/timeline/articlePreview';
import {
  activateTimelineFolder,
  clearPendingReadIds,
  markTimelineFolderRead,
  markTimelineItemRead,
  restartTimelineQueue,
  skipTimelineFolder,
} from '@/lib/timeline/envelopeTransitions';
import { useTimelineSelection } from '@/hooks/useTimelineSelection';
import { useAutoMarkRead } from '@/hooks/useAutoMarkRead';

type FeedsSummary = Awaited<ReturnType<typeof getFeeds>>;

export interface UseTimelineOptions {
  root?: Element | null;
  topOffset?: number;
  debounceMs?: number;
}

export interface UseTimelineResult extends SelectionActions {
  queue: FolderQueueEntry[];
  activeFolder: FolderQueueEntry | null;
  activeArticles: ArticlePreview[];
  progress: FolderProgressState;
  totalUnread: number;
  isHydrated: boolean;
  isUpdating: boolean;
  isRefreshing: boolean;
  error: Error | null;
  refresh: (options?: RefreshOptions) => Promise<void>;
  setActiveFolder: (folderId: number) => void;
  markFolderRead: (folderId: number) => Promise<void>;
  markItemRead: (itemId: number) => Promise<void>;
  skipFolder: (folderId: number) => Promise<void>;
  restart: () => Promise<void>;
  lastUpdateError: string | null;
  selectedArticleId: number | null;
  setSelectedArticleId: (id: number | null) => void;
  selectedArticleElement: HTMLElement | null;
  setSelectedArticleElement: (element: HTMLElement | null) => void;
  registerArticle: (id: number) => (node: HTMLElement | null) => void;
  disableObserverTemporarily: () => void;
}

interface RefreshOptions {
  forceSync?: boolean;
}

const SYNC_TIMEOUT_MS = 8000;
const MIN_SYNC_INDICATOR_MS = 350;

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function withTimeout<T>(promise: Promise<T>, timeoutMs: number): Promise<T> {
  let timeoutId: ReturnType<typeof setTimeout> | undefined;
  const timeoutPromise = new Promise<never>((_resolve, reject) => {
    timeoutId = setTimeout(() => {
      reject(new Error('Sync timed out'));
    }, timeoutMs);
  });

  try {
    return await Promise.race([promise, timeoutPromise]);
  } finally {
    if (timeoutId) {
      clearTimeout(timeoutId);
    }
  }
}

/**
 * Manages timeline state, cache reconciliation, and read actions.
 */
export function useTimeline(options: UseTimelineOptions = {}): UseTimelineResult {
  const { root, topOffset = 0, debounceMs = 100 } = options;
  const [envelope, setEnvelope] = useState<TimelineCacheEnvelope>(createEmptyTimelineCache);
  const envelopeRef = useRef(envelope);
  envelopeRef.current = envelope;
  const [isHydrated, setIsHydrated] = useState(false);
  const [lastUpdateError, setLastUpdateError] = useState<string | null>(null);
  const [isSyncing, setIsSyncing] = useState(false);

  useEffect(() => {
    const cached = loadTimelineCache();
    // Hydrate client cache from localStorage after mount to avoid SSR mismatches.

    setEnvelope(cached);
    setIsHydrated(true);
  }, []);

  const {
    data: foldersData,
    error: foldersError,
    isLoading: isFoldersLoading,
  } = useSWRImmutable<Folder[], Error>('folders', getFolders);

  const { data: feedsResponse, error: feedsError } = useSWRImmutable<FeedsSummary, Error>(
    'feeds',
    getFeeds,
  );
  const feeds = useMemo(() => feedsResponse?.feeds ?? [], [feedsResponse]);

  const feedNameMap = useMemo(() => {
    return new Map<number, string>(feeds.map((feed) => [feed.id, feed.title]));
  }, [feeds]);

  // Refresh with error handling (retry logic handled at page level)
  const refresh = useCallback(
    async (_options?: RefreshOptions): Promise<void> => {
      void _options;
      const startedAt = Date.now();
      setIsSyncing(true);
      try {
        let fetchedFeedsResponse: FeedsSummary | null = null;
        if (feeds.length === 0) {
          try {
            fetchedFeedsResponse = await getFeeds();
          } catch {
            fetchedFeedsResponse = null;
          }
        }
        const effectiveFeeds = feeds.length > 0 ? feeds : (fetchedFeedsResponse?.feeds ?? []);
        const effectiveFeedFolderMap = new Map<number, number>(
          effectiveFeeds.map((feed) => [feed.id, feed.folderId ?? UNCATEGORIZED_FOLDER_ID]),
        );
        const effectiveFeedNameMap = new Map<number, string>(
          effectiveFeeds.map((feed) => [feed.id, feed.title]),
        );
        let effectiveFolders = foldersData ?? [];
        if (effectiveFolders.length === 0) {
          try {
            effectiveFolders = await getFolders();
          } catch {
            effectiveFolders = [];
          }
        }
        const { items, serverUnreadIds } = await withTimeout(
          fetchUnreadItemsForSync(),
          SYNC_TIMEOUT_MS,
        );
        const now = Date.now();

        setEnvelope((current) => {
          const { envelope: reconciled } = reconcileTimelineCache(current, serverUnreadIds, now);
          const previews = items
            .map((article) =>
              toArticlePreview(
                article,
                resolveFolderId(article, effectiveFeedFolderMap),
                now,
                effectiveFeedNameMap.get(article.feedId) ?? 'Unknown source',
              ),
            )
            .filter((preview): preview is ArticlePreview => preview !== null);

          const merged = mergeItemsIntoCache(reconciled, previews, now);
          const nextEnvelope = applyFeedNames(
            applyFolderNames(merged, effectiveFolders),
            effectiveFeedNameMap,
          );

          storeTimelineCache(nextEnvelope);
          return nextEnvelope;
        });

        setLastUpdateError(null);
      } catch (error: unknown) {
        const errorMessage = error instanceof Error ? error.message : 'Update failed';
        setLastUpdateError(errorMessage);

        if (process.env.NODE_ENV === 'development') {
          console.debug('❌ Timeline update failed:', errorMessage);
        }

        throw error;
      } finally {
        const elapsed = Date.now() - startedAt;
        if (elapsed < MIN_SYNC_INDICATOR_MS) {
          await delay(MIN_SYNC_INDICATOR_MS - elapsed);
        }
        setIsSyncing(false);
      }
    },
    [feeds, foldersData],
  );

  useEffect(() => {
    if (!isHydrated || feedNameMap.size === 0) return;

    setEnvelope((current) => {
      const nextEnvelope = applyFeedNames(current, feedNameMap);
      if (nextEnvelope === current) {
        return current;
      }
      storeTimelineCache(nextEnvelope);
      return nextEnvelope;
    });
  }, [feedNameMap, isHydrated]);

  useEffect(() => {
    if (!isHydrated || !foldersData || foldersData.length === 0) return;

    const folderNameMap = new Map<number, string>(
      foldersData.map((folder) => [folder.id, folder.name]),
    );

    setEnvelope((current) => {
      let hasUpdates = false;
      const updatedFolders: Record<number, FolderQueueEntry> = {};

      for (const [folderIdStr, folder] of Object.entries(current.folders)) {
        const id = Number(folderIdStr);
        const resolvedName =
          folderNameMap.get(id) ?? (id === UNCATEGORIZED_FOLDER_ID ? 'Uncategorized' : folder.name);
        if (folder.name !== resolvedName) {
          hasUpdates = true;
        }
        updatedFolders[id] =
          folder.name === resolvedName
            ? folder
            : {
                ...folder,
                name: resolvedName,
              };
      }

      if (!hasUpdates) {
        return current;
      }

      const nextEnvelope: TimelineCacheEnvelope = {
        ...current,
        folders: updatedFolders,
      };
      storeTimelineCache(nextEnvelope);
      return nextEnvelope;
    });
  }, [foldersData, isHydrated, envelope.folders]);

  const sortedQueue = useMemo(() => {
    return sortFolderQueueEntries(Object.values(envelope.folders));
  }, [envelope.folders]);

  const activeFolder = useMemo(() => {
    const activeId = envelope.activeFolderId;
    if (typeof activeId === 'number' && activeId in envelope.folders) {
      return envelope.folders[activeId];
    }

    return sortedQueue.find((f) => f.status !== 'skipped') ?? null;
  }, [envelope.activeFolderId, envelope.folders, sortedQueue]);

  const orderedQueue = useMemo(() => {
    return pinActiveFolder(sortedQueue, activeFolder ? activeFolder.id : null);
  }, [sortedQueue, activeFolder]);

  const progress = useMemo(() => {
    return deriveFolderProgress(orderedQueue, activeFolder ? activeFolder.id : null);
  }, [orderedQueue, activeFolder]);

  const activeArticles = useMemo(() => {
    return activeFolder ? activeFolder.articles : [];
  }, [activeFolder]);
  const totalUnread = useMemo(() => {
    return sortedQueue.reduce((sum, entry) => sum + entry.unreadCount, 0);
  }, [sortedQueue]);

  const error = foldersError ?? feedsError ?? null;
  const isUpdating = isSyncing || isFoldersLoading;

  const setActiveFolder = useCallback((folderId: number) => {
    setEnvelope((current) => {
      const nextEnvelope = activateTimelineFolder(current, folderId);
      storeTimelineCache(nextEnvelope);
      return nextEnvelope;
    });
  }, []);

  const markFolderRead = useCallback(
    async (folderId: number) => {
      const currentEnvelope = envelopeRef.current;
      if (!(folderId in currentEnvelope.folders)) {
        return;
      }

      const folder = currentEnvelope.folders[folderId];
      const itemIds = folder.articles.map((article) => article.id);
      if (itemIds.length === 0) {
        return;
      }

      setEnvelope((current) => {
        const result = markTimelineFolderRead(current, folderId);
        const nextEnvelope = result.envelope;

        storeTimelineCache(nextEnvelope);
        return nextEnvelope;
      });

      try {
        await markItemsRead(itemIds);

        setEnvelope((current) => {
          const nextEnvelope = clearPendingReadIds(current, itemIds);
          storeTimelineCache(nextEnvelope);
          return nextEnvelope;
        });
        await refresh();
      } catch (error: unknown) {
        console.error('Failed to mark items as read:', error);
        throw error;
      }
    },
    [refresh],
  );

  const skipFolder = useCallback((folderId: number) => {
    return new Promise<void>((resolve) => {
      setEnvelope((current) => {
        const nextEnvelope = skipTimelineFolder(current, folderId);
        storeTimelineCache(nextEnvelope);
        return nextEnvelope;
      });
      resolve();
    });
  }, []);

  const restart = useCallback(() => {
    return new Promise<void>((resolve) => {
      setEnvelope((current) => {
        const nextEnvelope = restartTimelineQueue(current);
        storeTimelineCache(nextEnvelope);
        return nextEnvelope;
      });
      resolve();
    });
  }, []);

  const markItemRead = useCallback(async (itemId: number) => {
    setEnvelope((current) => {
      const nextEnvelope = markTimelineItemRead(current, itemId);
      storeTimelineCache(nextEnvelope);
      return nextEnvelope;
    });

    try {
      await apiMarkItemRead(itemId);

      setEnvelope((current) => {
        const nextEnvelope = clearPendingReadIds(current, [itemId]);
        storeTimelineCache(nextEnvelope);
        return nextEnvelope;
      });
    } catch (error) {
      console.error('Failed to mark item as read:', error);
    }
  }, []);

  const {
    selectedArticleId,
    setSelectedArticleId,
    selectedArticleElement,
    setSelectedArticleElement,
    selectTopmost,
    selectNext,
    selectPrevious,
    deselect,
  } = useTimelineSelection(activeArticles);
  const { registerArticle, disableObserverTemporarily } = useAutoMarkRead({
    activeArticles,
    markItemRead,
    root,
    topOffset,
    debounceMs,
  });

  return {
    queue: orderedQueue,
    activeFolder,
    activeArticles,
    progress,
    totalUnread,
    isHydrated,
    isUpdating,
    isRefreshing: isSyncing,
    error,
    refresh,
    setActiveFolder,
    markFolderRead,
    markItemRead,
    skipFolder,
    restart,
    lastUpdateError,
    selectedArticleId,
    setSelectedArticleId,
    selectedArticleElement,
    setSelectedArticleElement,
    selectTopmost,
    selectNext,
    selectPrevious,
    deselect,
    registerArticle,
    disableObserverTemporarily,
  };
}
