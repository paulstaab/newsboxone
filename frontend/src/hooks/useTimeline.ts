'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ApiError } from '@/lib/api/client';
import { SESSION_ENDED_EVENT } from '@/lib/storage';
import { sortArticlePreviews } from '@/lib/utils/unreadAggregator';
import useSWRImmutable from 'swr/immutable';
import { api } from '@/lib/api';
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
  applyFeedMetadata,
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

type FeedsSummary = Awaited<ReturnType<typeof api.feeds.getAll>>;

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
  hasCompletedPass: boolean;
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

/** Only definitive server rejections roll back optimistic reads. */
function isDefinitiveReadFailure(error: unknown): boolean {
  return (
    error instanceof ApiError &&
    error.status >= 400 &&
    error.status < 500 &&
    ![408, 429].includes(error.status)
  );
}

const SYNC_TIMEOUT_MS = 8000;
const MIN_SYNC_INDICATOR_MS = 350;

function restoreUnreadPreviews(
  current: TimelineCacheEnvelope,
  previews: ArticlePreview[],
  fallbackFolders: FolderQueueEntry[] = [],
): TimelineCacheEnvelope {
  if (previews.length === 0) {
    return current;
  }

  const restoredIds = new Set(previews.map((article) => article.id));

  const fallbackById = new Map(fallbackFolders.map((folder) => [folder.id, folder]));
  const updatedFolders: Partial<Record<number, FolderQueueEntry>> = { ...current.folders };
  const now = Date.now();

  for (const preview of previews) {
    const folderId = preview.folderId;
    const fallbackFolder = fallbackById.get(folderId);
    const existingFolder = updatedFolders[folderId] ?? fallbackFolder;
    const article = { ...preview };

    if (!existingFolder) {
      updatedFolders[folderId] = {
        id: folderId,
        name: folderId === UNCATEGORIZED_FOLDER_ID ? 'Uncategorized' : `Folder ${String(folderId)}`,
        sortOrder: 0,
        status: 'queued',
        unreadCount: article.unread ? 1 : 0,
        articles: [article],
        lastUpdated: now,
      };
      continue;
    }

    const articles = sortArticlePreviews([
      ...existingFolder.articles.filter((entry) => entry.id !== article.id),
      article,
    ]);
    updatedFolders[folderId] = {
      ...existingFolder,
      articles,
      unreadCount: articles.filter((entry) => entry.unread).length,
      lastUpdated: now,
    };
  }

  const sortedFolders = sortFolderQueueEntries(
    Object.values(updatedFolders).filter((folder): folder is FolderQueueEntry => Boolean(folder)),
  );
  const folders = Object.fromEntries(sortedFolders.map((folder) => [folder.id, folder]));
  const activeFolderId =
    typeof current.activeFolderId === 'number' && current.activeFolderId in folders
      ? current.activeFolderId
      : (sortedFolders.find((folder) => folder.status !== 'skipped')?.id ?? null);

  return {
    ...current,
    folders,
    activeFolderId,
    pendingReadIds: current.pendingReadIds.filter((id) => !restoredIds.has(id)),
    pendingReadArticles: current.pendingReadArticles?.filter(
      (article) => !restoredIds.has(article.id),
    ),
  };
}

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
  const [envelope, setEnvelopeState] = useState<TimelineCacheEnvelope>(createEmptyTimelineCache);
  const envelopeRef = useRef(envelope);
  const aliveRef = useRef(true);
  const generationRef = useRef(0);
  const syncingRef = useRef(false);
  const readVersionRef = useRef(0);
  const readChangesRef = useRef(new Map<number, number>());
  const setEnvelope = useCallback(
    (
      update: TimelineCacheEnvelope | ((current: TimelineCacheEnvelope) => TimelineCacheEnvelope),
    ) => {
      if (!aliveRef.current) return;
      const next = typeof update === 'function' ? update(envelopeRef.current) : update;
      envelopeRef.current = next;
      setEnvelopeState(next);
    },
    [],
  );
  useEffect(() => {
    aliveRef.current = true;
    const reset = () => {
      generationRef.current += 1;
      aliveRef.current = false;
      setEnvelopeState(createEmptyTimelineCache());
    };
    window.addEventListener(SESSION_ENDED_EVENT, reset);
    return () => {
      aliveRef.current = false;
      generationRef.current += 1;
      window.removeEventListener(SESSION_ENDED_EVENT, reset);
    };
  }, []);
  const [hasCompletedPass, setHasCompletedPass] = useState(false);
  const [isHydrated, setIsHydrated] = useState(false);
  const [lastUpdateError, setLastUpdateError] = useState<string | null>(null);
  const [isSyncing, setIsSyncing] = useState(false);

  useEffect(() => {
    let cancelled = false;

    queueMicrotask(() => {
      if (cancelled) return;

      const cached = loadTimelineCache();
      // Hydrate client cache from localStorage after mount to avoid SSR mismatches.
      setEnvelope(cached);
      setIsHydrated(true);
    });

    return () => {
      cancelled = true;
    };
  }, [setEnvelope]);

  const {
    data: foldersData,
    error: foldersError,
    isLoading: isFoldersLoading,
    mutate: mutateFolders,
  } = useSWRImmutable<Folder[], Error>('folders', () => api.folders.getAll());

  const {
    data: feedsResponse,
    error: feedsError,
    mutate: mutateFeeds,
  } = useSWRImmutable<FeedsSummary, Error>('feeds', () => api.feeds.getAll());
  const feeds = useMemo(() => feedsResponse?.feeds ?? [], [feedsResponse]);

  const feedNameMap = useMemo(() => {
    return new Map<number, string>(feeds.map((feed) => [feed.id, feed.title]));
  }, [feeds]);

  const feedTypeMap = useMemo(() => {
    return new Map<number, ArticlePreview['feedType']>(feeds.map((feed) => [feed.id, feed.type]));
  }, [feeds]);

  // Refresh with error handling (retry logic handled at page level)
  const refresh = useCallback(
    async (options: RefreshOptions = {}): Promise<void> => {
      if (syncingRef.current || !aliveRef.current) return;
      syncingRef.current = true;
      const generation = generationRef.current;
      const readVersion = readVersionRef.current;
      const startedAt = Date.now();
      setIsSyncing(true);
      try {
        const [fetchedFeedsResponse, effectiveFolders] = await Promise.all([
          api.feeds.getAll(),
          api.folders.getAll(),
        ]);
        if (generation !== generationRef.current) return;
        await Promise.all([
          mutateFeeds(fetchedFeedsResponse, false),
          mutateFolders(effectiveFolders, false),
        ]);
        const effectiveFeeds = fetchedFeedsResponse.feeds;
        const effectiveFeedFolderMap = new Map<number, number>(
          effectiveFeeds.map((feed) => [feed.id, feed.folderId ?? UNCATEGORIZED_FOLDER_ID]),
        );
        const effectiveFeedNameMap = new Map<number, string>(
          effectiveFeeds.map((feed) => [feed.id, feed.title]),
        );
        const effectiveFeedTypeMap = new Map<number, ArticlePreview['feedType']>(
          effectiveFeeds.map((feed) => [feed.id, feed.type]),
        );
        const { items, serverUnreadIds } = await withTimeout(
          fetchUnreadItemsForSync(),
          SYNC_TIMEOUT_MS,
        );
        const now = Date.now();
        if (generation !== generationRef.current) return;

        setEnvelope((current) => {
          const { envelope: reconciled } = reconcileTimelineCache(current, serverUnreadIds, now);
          if (!options.forceSync) {
            for (const folder of Object.values(current.folders)) {
              const retained = folder.articles.filter((article) => !article.unread);
              if (!retained.length) continue;
              const existing = reconciled.folders[folder.id] as FolderQueueEntry | undefined;
              reconciled.folders[folder.id] = existing
                ? {
                    ...existing,
                    articles: sortArticlePreviews([...existing.articles, ...retained]),
                  }
                : { ...folder, articles: retained, unreadCount: 0 };
            }
            if (current.activeFolderId !== null && current.activeFolderId in reconciled.folders)
              reconciled.activeFolderId = current.activeFolderId;
          }
          const previews = items
            .map((article) =>
              toArticlePreview(
                article,
                resolveFolderId(article, effectiveFeedFolderMap),
                now,
                effectiveFeedNameMap.get(article.feedId) ?? 'Unknown source',
                effectiveFeedTypeMap.get(article.feedId) ?? 'rss',
              ),
            )
            .filter(
              (preview): preview is ArticlePreview =>
                preview !== null && (readChangesRef.current.get(preview.id) ?? 0) <= readVersion,
            );

          const merged = mergeItemsIntoCache(reconciled, previews, now);
          const nextEnvelope = applyFeedMetadata(
            applyFolderNames(merged, effectiveFolders),
            effectiveFeedNameMap,
            effectiveFeedTypeMap,
          );

          storeTimelineCache(nextEnvelope);
          return nextEnvelope;
        });

        setLastUpdateError(null);
        if (options.forceSync) setHasCompletedPass(false);
      } catch (error: unknown) {
        if (generation !== generationRef.current) return;
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
        syncingRef.current = false;
        if (generation === generationRef.current) setIsSyncing(false);
      }
    },
    [mutateFeeds, mutateFolders, setEnvelope],
  );

  useEffect(() => {
    if (!isHydrated || (feedNameMap.size === 0 && feedTypeMap.size === 0)) return;

    let cancelled = false;

    queueMicrotask(() => {
      if (cancelled) return;

      setEnvelope((current) => {
        const nextEnvelope = applyFeedMetadata(current, feedNameMap, feedTypeMap);
        if (nextEnvelope === current) {
          return current;
        }
        storeTimelineCache(nextEnvelope);
        return nextEnvelope;
      });
    });

    return () => {
      cancelled = true;
    };
  }, [feedNameMap, feedTypeMap, isHydrated, setEnvelope]);

  useEffect(() => {
    if (!isHydrated || !foldersData || foldersData.length === 0) return;

    const folderNameMap = new Map<number, string>(
      foldersData.map((folder) => [folder.id, folder.name]),
    );

    let cancelled = false;

    queueMicrotask(() => {
      if (cancelled) return;

      setEnvelope((current) => {
        let hasUpdates = false;
        const updatedFolders: Record<number, FolderQueueEntry> = {};

        for (const [folderIdStr, folder] of Object.entries(current.folders)) {
          const id = Number(folderIdStr);
          const resolvedName =
            folderNameMap.get(id) ??
            (id === UNCATEGORIZED_FOLDER_ID ? 'Uncategorized' : folder.name);
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
    });

    return () => {
      cancelled = true;
    };
  }, [foldersData, isHydrated, envelope.folders, setEnvelope]);

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

  const setActiveFolder = useCallback(
    (folderId: number) => {
      setEnvelope((current) => {
        const nextEnvelope = activateTimelineFolder(current, folderId);
        storeTimelineCache(nextEnvelope);
        return nextEnvelope;
      });
    },
    [setEnvelope],
  );

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
      readVersionRef.current += 1;
      itemIds.forEach((id) => readChangesRef.current.set(id, readVersionRef.current));
      setHasCompletedPass(true);
      const restoredArticles = folder.articles;
      const restoredFolder = folder;

      setEnvelope((current) => {
        const result = markTimelineFolderRead(current, folderId);
        const nextEnvelope = result.envelope;

        storeTimelineCache(nextEnvelope);
        return nextEnvelope;
      });

      if (!navigator.onLine) return;
      try {
        await api.items.markMultipleRead(itemIds);

        setEnvelope((current) => {
          const nextEnvelope = clearPendingReadIds(current, itemIds);
          storeTimelineCache(nextEnvelope);
          return nextEnvelope;
        });
      } catch (error: unknown) {
        if (!isDefinitiveReadFailure(error)) return;
        setEnvelope((current) => {
          const nextEnvelope = restoreUnreadPreviews(current, restoredArticles, [restoredFolder]);
          storeTimelineCache(nextEnvelope);
          return nextEnvelope;
        });
        setLastUpdateError('Unable to mark this folder read. Its articles have been restored.');
        console.error('Failed to mark items as read:', error);
        throw error;
      }
    },
    [setEnvelope],
  );

  const skipFolder = useCallback(
    (folderId: number) => {
      setHasCompletedPass(true);
      return new Promise<void>((resolve) => {
        setEnvelope((current) => {
          const nextEnvelope = skipTimelineFolder(current, folderId);
          storeTimelineCache(nextEnvelope);
          return nextEnvelope;
        });
        resolve();
      });
    },
    [setEnvelope],
  );

  const restart = useCallback(() => {
    setHasCompletedPass(false);
    return new Promise<void>((resolve) => {
      setEnvelope((current) => {
        const nextEnvelope = restartTimelineQueue(current);
        storeTimelineCache(nextEnvelope);
        return nextEnvelope;
      });
      resolve();
    });
  }, [setEnvelope]);

  const markItemRead = useCallback(
    async (itemId: number) => {
      const currentEnvelope = envelopeRef.current;
      if (currentEnvelope.pendingReadIds.includes(itemId)) return;
      readVersionRef.current += 1;
      readChangesRef.current.set(itemId, readVersionRef.current);
      const restoredArticle = Object.values(currentEnvelope.folders)
        .flatMap((folder) => folder.articles)
        .find((article) => article.id === itemId);
      const restoredFolder =
        restoredArticle === undefined
          ? undefined
          : currentEnvelope.folders[restoredArticle.folderId];

      setEnvelope((current) => {
        const nextEnvelope = markTimelineItemRead(current, itemId);
        storeTimelineCache(nextEnvelope);
        return nextEnvelope;
      });

      if (!navigator.onLine) return;
      try {
        await api.items.markRead(itemId);

        setEnvelope((current) => {
          const nextEnvelope = clearPendingReadIds(current, [itemId]);
          storeTimelineCache(nextEnvelope);
          return nextEnvelope;
        });
      } catch (error) {
        if (!isDefinitiveReadFailure(error)) return;
        if (restoredArticle) {
          setEnvelope((current) => {
            const nextEnvelope = restoreUnreadPreviews(
              current,
              [restoredArticle],
              restoredFolder ? [restoredFolder] : [],
            );
            storeTimelineCache(nextEnvelope);
            return nextEnvelope;
          });
        } else {
          setEnvelope((current) => {
            const nextEnvelope = clearPendingReadIds(current, [itemId]);
            storeTimelineCache(nextEnvelope);
            return nextEnvelope;
          });
        }
        console.error('Failed to mark item as read:', error);
      }
    },
    [setEnvelope],
  );

  useEffect(() => {
    let retrying = false;
    const retry = async () => {
      if (retrying || !navigator.onLine || !aliveRef.current) return;
      const current = envelopeRef.current;
      const ids = current.pendingReadIds;
      if (!ids.length) return;
      retrying = true;
      try {
        await api.items.markMultipleRead(ids);
        setEnvelope((latest) => {
          const next = clearPendingReadIds(latest, ids);
          storeTimelineCache(next);
          return next;
        });
      } catch (error) {
        if (isDefinitiveReadFailure(error)) {
          setEnvelope((latest) => {
            const next = restoreUnreadPreviews(latest, current.pendingReadArticles ?? []);
            storeTimelineCache(next);
            return next;
          });
        }
      } finally {
        retrying = false;
      }
    };
    const onOnline = () => {
      void retry();
    };
    window.addEventListener('online', onOnline);
    if (isHydrated) void retry();
    return () => {
      window.removeEventListener('online', onOnline);
    };
  }, [isHydrated, setEnvelope]);

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
    hasCompletedPass,
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
