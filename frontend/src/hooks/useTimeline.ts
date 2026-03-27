'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import useSWRImmutable from 'swr/immutable';
import { getFolders } from '@/lib/api/folders';
import { getFeeds } from '@/lib/api/feeds';
import { markItemsRead, markItemRead as apiMarkItemRead } from '@/lib/api/items';
import { fetchUnreadItemsForSync } from '@/lib/api/itemsSync';
import { reconcileTimelineCache } from '@/lib/storage/timelineCache';
import {
  deriveFolderProgress,
  moveFolderToEnd,
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
import { buildFolderMap, findNextActiveId } from '@/lib/timeline/envelope';
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

  const feedFolderMap = useMemo(() => {
    return new Map<number, number>(
      feeds.map((feed) => [feed.id, feed.folderId ?? UNCATEGORIZED_FOLDER_ID]),
    );
  }, [feeds]);
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
                resolveFolderId(article, feedFolderMap),
                now,
                feedNameMap.get(article.feedId) ?? 'Unknown source',
              ),
            )
            .filter((preview): preview is ArticlePreview => preview !== null);

          const merged = mergeItemsIntoCache(reconciled, previews, now);
          const nextEnvelope = applyFeedNames(applyFolderNames(merged, foldersData), feedNameMap);

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
    [feedFolderMap, feedNameMap, foldersData],
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
      if (!(folderId in current.folders)) {
        return current;
      }

      const target = current.folders[folderId];
      const updatedFolders = { ...current.folders };
      if (target.status === 'skipped') {
        updatedFolders[folderId] = {
          ...target,
          status: 'queued',
        };
      }

      const nextEnvelope: TimelineCacheEnvelope = {
        ...current,
        folders: updatedFolders,
        activeFolderId: folderId,
      };

      storeTimelineCache(nextEnvelope);
      return nextEnvelope;
    });
  }, []);

  const markFolderRead = useCallback(
    async (folderId: number) => {
      if (!(folderId in envelope.folders)) {
        return;
      }

      const folder = envelope.folders[folderId];

      const itemIds = folder.articles.map((article) => article.id);

      setEnvelope((current) => {
        const { [folderId]: _removed, ...updatedFolders } = current.folders;
        void _removed;

        const remainingQueue = sortFolderQueueEntries(Object.values(updatedFolders));
        const nextActiveId = findNextActiveId(remainingQueue);

        const nextEnvelope: TimelineCacheEnvelope = {
          ...current,
          folders: buildFolderMap(remainingQueue),
          activeFolderId: nextActiveId,
          pendingReadIds: [...current.pendingReadIds, ...itemIds],
        };

        storeTimelineCache(nextEnvelope);
        return nextEnvelope;
      });

      try {
        await markItemsRead(itemIds);

        setEnvelope((current) => {
          const nextEnvelope: TimelineCacheEnvelope = {
            ...current,
            pendingReadIds: current.pendingReadIds.filter((id) => !itemIds.includes(id)),
          };
          storeTimelineCache(nextEnvelope);
          return nextEnvelope;
        });
        await refresh();
      } catch (error: unknown) {
        console.error('Failed to mark items as read:', error);
        throw error;
      }
    },
    [envelope.folders, refresh],
  );

  const skipFolder = useCallback((folderId: number) => {
    return new Promise<void>((resolve) => {
      setEnvelope((current) => {
        const updatedEntries = moveFolderToEnd(Object.values(current.folders), folderId);
        const remainingQueue = sortFolderQueueEntries(updatedEntries);
        const nextActiveId = findNextActiveId(remainingQueue);

        const nextEnvelope: TimelineCacheEnvelope = {
          ...current,
          folders: buildFolderMap(remainingQueue),
          activeFolderId: nextActiveId,
          pendingSkipFolderIds: [...current.pendingSkipFolderIds, folderId],
        };

        storeTimelineCache(nextEnvelope);
        return nextEnvelope;
      });
      resolve();
    });
  }, []);

  const restart = useCallback(() => {
    return new Promise<void>((resolve) => {
      setEnvelope((current) => {
        const updatedFolders = { ...current.folders };

        Object.values(updatedFolders).forEach((folder) => {
          if (folder.status === 'skipped') {
            updatedFolders[folder.id] = {
              ...folder,
              status: 'queued',
            };
          }
        });

        const remainingQueue = sortFolderQueueEntries(Object.values(updatedFolders));
        const nextActiveId = findNextActiveId(remainingQueue);

        const nextEnvelope: TimelineCacheEnvelope = {
          ...current,
          folders: buildFolderMap(remainingQueue),
          activeFolderId: nextActiveId,
          pendingSkipFolderIds: [],
        };

        storeTimelineCache(nextEnvelope);
        return nextEnvelope;
      });
      resolve();
    });
  }, []);

  const markItemRead = useCallback(async (itemId: number) => {
    setEnvelope((current) => {
      const updatedFolders = { ...current.folders };

      let targetFolderId: number | null = null;
      for (const folderIdStr in updatedFolders) {
        const fid = Number(folderIdStr);
        const folder = updatedFolders[fid];
        if (folder.articles.some((a) => a.id === itemId)) {
          targetFolderId = fid;
          break;
        }
      }

      if (targetFolderId === null) return current;

      const folder = updatedFolders[targetFolderId];
      const updatedArticles = folder.articles.map((article) =>
        article.id === itemId ? { ...article, unread: false } : article,
      );

      const unreadCount = updatedArticles.filter((a) => a.unread).length;

      updatedFolders[targetFolderId] = {
        ...folder,
        articles: updatedArticles,
        unreadCount,
      };

      const remainingQueue = sortFolderQueueEntries(Object.values(updatedFolders));
      const nextActiveId =
        current.activeFolderId === targetFolderId && targetFolderId in updatedFolders
          ? targetFolderId
          : findNextActiveId(remainingQueue);

      const nextEnvelope: TimelineCacheEnvelope = {
        ...current,
        folders: buildFolderMap(remainingQueue),
        activeFolderId: nextActiveId,
        pendingReadIds: [...current.pendingReadIds, itemId],
      };

      storeTimelineCache(nextEnvelope);
      return nextEnvelope;
    });

    try {
      await apiMarkItemRead(itemId);

      setEnvelope((current) => {
        const nextEnvelope: TimelineCacheEnvelope = {
          ...current,
          pendingReadIds: current.pendingReadIds.filter((id) => id !== itemId),
        };
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
