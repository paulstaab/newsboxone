import { localStore } from '@/lib/storage/browserStorage';
import { CONFIG } from '@/lib/config/env';
import type { ArticlePreview, FolderQueueEntry, TimelineCacheEnvelope } from '@/types';
import { UNCATEGORIZED_FOLDER_ID } from '@/types';
import {
  pruneArticlePreviews,
  sortArticlePreviews,
  sortFolderQueueEntries,
} from '@/lib/utils/unreadAggregator';

const DAY_IN_MS = 24 * 60 * 60 * 1000;
const MAX_AGE_MS = CONFIG.TIMELINE_MAX_ITEM_AGE_DAYS * DAY_IN_MS;

function ensureArrayOfNumbers(value: number[] | undefined): number[] {
  if (!Array.isArray(value)) return [];
  return Array.from(new Set(value.filter((id) => Number.isFinite(id))));
}

function ensureArticlesArray(value: ArticlePreview[] | undefined): ArticlePreview[] {
  if (!Array.isArray(value)) return [];
  return value.map((article) => {
    const preview = article as Partial<ArticlePreview>;
    const hasFullText =
      typeof preview.hasFullText === 'boolean' ? preview.hasFullText : Boolean(preview.body);
    return {
      ...article,
      feedName: article.feedName || '',
      feedType: preview.feedType ?? 'rss',
      author: article.author || '',
      body: article.body || '',
      hasFullText,
    };
  });
}

function rebuildFolderMap(entries: FolderQueueEntry[]): Record<number, FolderQueueEntry> {
  return entries.reduce<Record<number, FolderQueueEntry>>((acc, entry) => {
    acc[entry.id] = entry;
    return acc;
  }, {});
}

/**
 * Returns the default timeline cache envelope.
 */
export function createEmptyTimelineCache(): TimelineCacheEnvelope {
  return {
    version: CONFIG.TIMELINE_CACHE_VERSION,
    lastSynced: 0,
    activeFolderId: null,
    folders: {},
    pendingReadIds: [],
    pendingSkipFolderIds: [],
  };
}

function normalizeEnvelope(
  envelope: Partial<TimelineCacheEnvelope> | null | undefined,
): TimelineCacheEnvelope {
  if (envelope?.version !== CONFIG.TIMELINE_CACHE_VERSION) {
    return createEmptyTimelineCache();
  }

  return {
    version: CONFIG.TIMELINE_CACHE_VERSION,
    lastSynced: envelope.lastSynced ?? 0,
    activeFolderId: envelope.activeFolderId ?? null,
    folders: envelope.folders ?? {},
    pendingReadArticles: envelope.pendingReadArticles ?? [],
    pendingReadIds: ensureArrayOfNumbers(envelope.pendingReadIds),
    pendingSkipFolderIds: ensureArrayOfNumbers(envelope.pendingSkipFolderIds),
  };
}

/** Validates persisted data before exposing it to rendering and reconciliation. */
function isValidCache(value: unknown): value is TimelineCacheEnvelope {
  if (
    !value ||
    typeof value !== 'object' ||
    !('version' in value) ||
    value.version !== CONFIG.TIMELINE_CACHE_VERSION ||
    !('folders' in value) ||
    !value.folders ||
    typeof value.folders !== 'object' ||
    Array.isArray(value.folders)
  )
    return false;
  const validArticle = (article: unknown): boolean => {
    if (!article || typeof article !== 'object') return false;
    const fields = article as Record<string, unknown>;
    return (
      ['id', 'feedId', 'folderId', 'pubDate'].every(
        (key) => typeof fields[key] === 'number' && Number.isFinite(fields[key]),
      ) &&
      ['title', 'summary', 'url'].every((key) => typeof fields[key] === 'string') &&
      typeof fields.unread === 'boolean'
    );
  };
  if (
    'pendingReadArticles' in value &&
    (!Array.isArray(value.pendingReadArticles) || !value.pendingReadArticles.every(validArticle))
  )
    return false;
  return Object.values(value.folders).every((folder: unknown) => {
    if (!folder || typeof folder !== 'object') return false;
    const fields = folder as Record<string, unknown>;
    return (
      typeof fields.id === 'number' &&
      Number.isFinite(fields.id) &&
      typeof fields.name === 'string' &&
      Array.isArray(fields.articles) &&
      fields.articles.every(validArticle)
    );
  });
}

/**
 * Loads the cached timeline envelope from localStore.
 * Falls back to an empty envelope if storage is unavailable or corrupted.
 */
export function loadTimelineCache(): TimelineCacheEnvelope {
  if (typeof window === 'undefined') {
    return createEmptyTimelineCache();
  }

  const raw = localStore.getItem(CONFIG.TIMELINE_CACHE_KEY);
  if (!raw) {
    return createEmptyTimelineCache();
  }

  try {
    const parsed: unknown = JSON.parse(raw);
    if (!isValidCache(parsed)) {
      localStore.removeItem(CONFIG.TIMELINE_CACHE_KEY);
      return createEmptyTimelineCache();
    }
    const normalized = normalizeEnvelope(parsed);
    return pruneTimelineCache(normalized);
  } catch {
    localStore.removeItem(CONFIG.TIMELINE_CACHE_KEY);
    return createEmptyTimelineCache();
  }
}

/**
 * Persists the timeline cache envelope to localStorage (after pruning).
 */
export function storeTimelineCache(envelope: TimelineCacheEnvelope): void {
  if (typeof window === 'undefined') return;
  const pruned = pruneTimelineCache(envelope);
  localStore.setItem(CONFIG.TIMELINE_CACHE_KEY, JSON.stringify(pruned));
}

interface TimelineCachePruneOptions {
  resetSkipped?: boolean;
}

function pruneFolders(
  folders: Record<number, FolderQueueEntry>,
  now = Date.now(),
  options: TimelineCachePruneOptions = {},
): Record<number, FolderQueueEntry> {
  const validEntries = Object.values(folders).map((entry) => ({
    ...entry,
    status: options.resetSkipped && entry.status === 'skipped' ? 'queued' : entry.status,
    articles: ensureArticlesArray(entry.articles),
  }));

  const prunedEntries = validEntries
    .map((entry) => {
      const articles = pruneArticlePreviews(entry.articles, { now });
      const unreadCount = articles.filter((article) => article.unread).length;
      if (unreadCount === 0 && articles.length === 0) {
        return null;
      }
      return {
        ...entry,
        articles,
        unreadCount,
      };
    })
    .filter((entry): entry is FolderQueueEntry => entry !== null);

  const sortedEntries = sortFolderQueueEntries(prunedEntries, {
    respectSkip: !options.resetSkipped,
  });
  return rebuildFolderMap(sortedEntries);
}

function deriveActiveFolderId(
  currentActiveId: number | null,
  folders: Record<number, FolderQueueEntry>,
): number | null {
  if (typeof currentActiveId === 'number' && currentActiveId in folders) {
    return currentActiveId;
  }

  const ordered = Object.values(folders).sort((a, b) => a.sortOrder - b.sortOrder);
  const nextActive = ordered.find((entry) => entry.status !== 'skipped');
  return nextActive ? nextActive.id : null;
}

function prunePendingSkips(
  pendingSkipFolderIds: number[],
  folders: Record<number, FolderQueueEntry>,
): number[] {
  const validIds = new Set(Object.keys(folders).map((id) => Number(id)));
  return pendingSkipFolderIds.filter((id) => validIds.has(id));
}

/**
 * Applies retention caps (max age + max items) and removes empty folders.
 */
export function pruneTimelineCache(
  envelope: TimelineCacheEnvelope,
  now = Date.now(),
  options: TimelineCachePruneOptions = {},
): TimelineCacheEnvelope {
  const normalized = normalizeEnvelope(envelope);
  const folders = pruneFolders(normalized.folders, now, options);
  const pendingReadIds = ensureArrayOfNumbers(normalized.pendingReadIds);
  const pendingSkipFolderIds = options.resetSkipped
    ? []
    : prunePendingSkips(ensureArrayOfNumbers(normalized.pendingSkipFolderIds), folders);

  // Drop cache if it has grown beyond retention window to avoid stale payloads
  const lastSyncedWithinWindow = normalized.lastSynced > now - MAX_AGE_MS * 2;

  return {
    version: CONFIG.TIMELINE_CACHE_VERSION,
    lastSynced: lastSyncedWithinWindow ? normalized.lastSynced : 0,
    activeFolderId: deriveActiveFolderId(normalized.activeFolderId, folders),
    folders,
    pendingReadIds,
    pendingReadArticles: normalized.pendingReadArticles,
    pendingSkipFolderIds,
  };
}

interface ReconcileResult {
  envelope: TimelineCacheEnvelope;
  removedIds: number[];
}

/**
 * Reconciles cached unread items against the server unread ID set.
 * Evicts items missing on the server or tombstoned via pendingReadIds.
 */
export function reconcileTimelineCache(
  envelope: TimelineCacheEnvelope,
  serverUnreadIds: Set<number>,
  _now = Date.now(),
): ReconcileResult {
  const normalized = normalizeEnvelope(envelope);
  const pendingReadSet = new Set(normalized.pendingReadIds);
  const removedIdSet = new Set<number>();

  const reconciledEntries = Object.values(normalized.folders)
    .map((entry) => {
      const reconciledArticles = entry.articles.filter((article) => {
        const isTombstoned = pendingReadSet.has(article.id);
        const isUnreadOnServer = serverUnreadIds.has(article.id);
        if (!isUnreadOnServer || isTombstoned) {
          removedIdSet.add(article.id);
          return false;
        }
        return true;
      });

      const prunedArticles = sortArticlePreviews(reconciledArticles);
      const unreadCount = prunedArticles.filter((article) => article.unread).length;
      if (unreadCount === 0) {
        return null;
      }

      return {
        ...entry,
        articles: prunedArticles,
        unreadCount,
      };
    })
    .filter((entry): entry is FolderQueueEntry => entry !== null);

  const sortedEntries = sortFolderQueueEntries(reconciledEntries);
  const sortedFolders = rebuildFolderMap(sortedEntries);

  return {
    envelope: {
      ...normalized,
      folders: sortedFolders,
      activeFolderId: deriveActiveFolderId(normalized.activeFolderId, sortedFolders),
    },
    removedIds: Array.from(removedIdSet),
  };
}

/**
 * Merges new articles into the existing cache envelope.
 * Respects pendingReadIds as tombstones to prevent already-marked items from reappearing.
 * Deduplicates by article ID and updates unread counts accordingly.
 */
export function mergeItemsIntoCache(
  envelope: TimelineCacheEnvelope,
  newArticles: ArticlePreview[],
  now = Date.now(),
): TimelineCacheEnvelope {
  const normalized = normalizeEnvelope(envelope);
  const pendingReadSet = new Set(normalized.pendingReadIds);
  const folders = { ...normalized.folders };

  // Group new articles by folder
  const articlesByFolder = new Map<number, ArticlePreview[]>();
  for (const article of newArticles) {
    // Skip articles that are in pendingReadIds (tombstones)
    if (pendingReadSet.has(article.id)) {
      continue;
    }

    const existing = articlesByFolder.get(article.folderId) ?? [];
    existing.push(article);
    articlesByFolder.set(article.folderId, existing);
  }

  // Merge articles into each folder
  for (const [folderId, newFolderArticles] of articlesByFolder) {
    const existingFolder = folders[folderId];
    // oxlint-disable-next-line typescript/no-unnecessary-condition
    if (!existingFolder) {
      // Create new folder entry if it doesn't exist
      const unreadCount = newFolderArticles.filter((a) => a.unread).length;
      if (unreadCount > 0) {
        folders[folderId] = {
          id: folderId,
          name:
            folderId === UNCATEGORIZED_FOLDER_ID ? 'Uncategorized' : `Folder ${String(folderId)}`, // Will be updated by caller with actual metadata
          sortOrder: 0,
          status: 'queued',
          unreadCount,
          articles: sortArticlePreviews(newFolderArticles),
          lastUpdated: now,
        };
      }
      continue;
    }

    // Merge with existing folder
    const existingArticleIds = new Set(existingFolder.articles.map((a) => a.id));
    const articlesToAdd = newFolderArticles.filter((a) => !existingArticleIds.has(a.id));

    const mergedArticles = [...existingFolder.articles, ...articlesToAdd];
    const prunedArticles = sortArticlePreviews(mergedArticles);
    const unreadCount = prunedArticles.filter((a) => a.unread).length;

    if (unreadCount === 0 && prunedArticles.length === 0) {
      // oxlint-disable-next-line typescript/no-dynamic-delete
      delete folders[folderId];
    } else {
      folders[folderId] = {
        ...existingFolder,
        articles: prunedArticles,
        unreadCount,
        lastUpdated: now,
      };
    }
  }

  // Re-sort and derive active folder
  const sortedEntries = sortFolderQueueEntries(Object.values(folders));
  const sortedFolders = rebuildFolderMap(sortedEntries);

  return {
    ...normalized,
    folders: sortedFolders,
    activeFolderId: deriveActiveFolderId(normalized.activeFolderId, sortedFolders),
    lastSynced: now,
  };
}
