/**
 * Client-side unread count aggregation utilities.
 * Computes unread counts for feeds and folders from article data.
 * Aligned with FR-005: Unread Management.
 */

import type {
  Article,
  Feed,
  Folder,
  ArticlePreview,
  FolderQueueEntry,
  FolderProgressState,
} from '@/types';
import { UNCATEGORIZED_FOLDER_ID } from '@/types';
import { CONFIG } from '@/lib/config/env';

const DAY_IN_MS = 24 * 60 * 60 * 1000;
const DEFAULT_MAX_ITEMS = CONFIG.TIMELINE_MAX_ITEMS_PER_FOLDER;
const DEFAULT_MAX_AGE_MS = CONFIG.TIMELINE_MAX_ITEM_AGE_DAYS * DAY_IN_MS;

/**
 * Counts unread articles per feed.
 * @returns Map of feedId to unread count
 */
export function countUnreadByFeed(articles: Article[]): Map<number, number> {
  const counts = new Map<number, number>();

  for (const article of articles) {
    if (article.unread) {
      const current = counts.get(article.feedId) ?? 0;
      counts.set(article.feedId, current + 1);
    }
  }

  return counts;
}

/**
 * Counts unread articles per folder.
 * Uses feed-to-folder mapping to aggregate counts.
 * @returns Map of folderId to unread count (uses UNCATEGORIZED_FOLDER_ID for root-level feeds)
 */
export function countUnreadByFolder(articles: Article[], feeds: Feed[]): Map<number, number> {
  // Build feedId -> folderId lookup
  const feedToFolder = new Map<number, number>();
  for (const feed of feeds) {
    feedToFolder.set(feed.id, feed.folderId ?? UNCATEGORIZED_FOLDER_ID);
  }

  // Aggregate by folder
  const counts = new Map<number, number>();
  for (const article of articles) {
    if (article.unread) {
      const folderId = feedToFolder.get(article.feedId) ?? UNCATEGORIZED_FOLDER_ID;
      const current = counts.get(folderId) ?? 0;
      counts.set(folderId, current + 1);
    }
  }

  return counts;
}

/**
 * Computes total unread count across all articles.
 */
export function countTotalUnread(articles: Article[]): number {
  return articles.filter((a) => a.unread).length;
}

/**
 * Updates feed objects with computed unread counts.
 * Returns new feed array with updated unreadCount values.
 */
export function applyUnreadCountsToFeeds(feeds: Feed[], unreadByFeed: Map<number, number>): Feed[] {
  return feeds.map((feed) => ({
    ...feed,
    unreadCount: unreadByFeed.get(feed.id) ?? 0,
  }));
}

/**
 * Updates folder objects with computed unread counts.
 * Returns new folder array with updated unreadCount values.
 */
export function applyUnreadCountsToFolders(
  folders: Folder[],
  unreadByFolder: Map<number, number>,
): Folder[] {
  return folders.map((folder) => ({
    ...folder,
    unreadCount: unreadByFolder.get(folder.id) ?? 0,
  }));
}

/**
 * Computes feedIds for each folder.
 * Returns new folder array with populated feedIds.
 */
export function computeFolderFeedIds(folders: Folder[], feeds: Feed[]): Folder[] {
  // Group feeds by folder
  const feedsByFolder = new Map<number, number[]>();
  for (const feed of feeds) {
    const folderId = feed.folderId ?? UNCATEGORIZED_FOLDER_ID;
    const existing = feedsByFolder.get(folderId) ?? [];
    existing.push(feed.id);
    feedsByFolder.set(folderId, existing);
  }

  return folders.map((folder) => ({
    ...folder,
    feedIds: feedsByFolder.get(folder.id) ?? [],
  }));
}

/**
 * Aggregation result containing enriched feeds and folders.
 */
export interface AggregationResult {
  feeds: Feed[];
  folders: Folder[];
  totalUnread: number;
  uncategorizedUnread: number;
}

/**
 * Full aggregation pipeline: computes all unread counts and enriches entities.
 * This is the main entry point for computing display-ready data.
 */
export function aggregateUnreadCounts(
  articles: Article[],
  feeds: Feed[],
  folders: Folder[],
): AggregationResult {
  const unreadByFeed = countUnreadByFeed(articles);
  const unreadByFolder = countUnreadByFolder(articles, feeds);

  const enrichedFeeds = applyUnreadCountsToFeeds(feeds, unreadByFeed);
  const foldersWithFeedIds = computeFolderFeedIds(folders, feeds);
  const enrichedFolders = applyUnreadCountsToFolders(foldersWithFeedIds, unreadByFolder);

  return {
    feeds: enrichedFeeds,
    folders: enrichedFolders,
    totalUnread: countTotalUnread(articles),
    uncategorizedUnread: unreadByFolder.get(UNCATEGORIZED_FOLDER_ID) ?? 0,
  };
}

/**
 * Filters articles by feed ID.
 */
export function filterArticlesByFeed(articles: Article[], feedId: number): Article[] {
  return articles.filter((a) => a.feedId === feedId);
}

/**
 * Filters articles by folder ID.
 */
export function filterArticlesByFolder(
  articles: Article[],
  feeds: Feed[],
  folderId: number,
): Article[] {
  const feedIdsInFolder = new Set(
    feeds.filter((f) => (f.folderId ?? UNCATEGORIZED_FOLDER_ID) === folderId).map((f) => f.id),
  );
  return articles.filter((a) => feedIdsInFolder.has(a.feedId));
}

/**
 * Gets unread articles only.
 */
export function filterUnreadArticles(articles: Article[]): Article[] {
  return articles.filter((a) => a.unread);
}

/**
 * Gets starred articles only.
 */
export function filterStarredArticles(articles: Article[]): Article[] {
  return articles.filter((a) => a.starred);
}

export interface ArticlePruneOptions {
  now?: number;
  maxItems?: number;
  maxAgeMs?: number;
}

function getPreviewTimestamp(article: ArticlePreview): number {
  const pubDateMs = article.pubDate ? article.pubDate * 1000 : 0;
  return article.storedAt ?? pubDateMs;
}

/**
 * Applies retention rules to cached article previews (max age + max count).
 */
export function pruneArticlePreviews(
  articles: ArticlePreview[],
  options: ArticlePruneOptions = {},
): ArticlePreview[] {
  if (articles.length === 0) return [];

  const now = options.now ?? Date.now();
  const maxItems = options.maxItems ?? DEFAULT_MAX_ITEMS;
  const maxAgeMs = options.maxAgeMs ?? DEFAULT_MAX_AGE_MS;
  const cutoff = now - maxAgeMs;

  const sorted = [...articles].sort((a, b) => getPreviewTimestamp(b) - getPreviewTimestamp(a));
  const filteredByAge = sorted.filter((article) => getPreviewTimestamp(article) >= cutoff);

  return filteredByAge.slice(0, maxItems).map((article) => ({
    ...article,
    feedName: article.feedName || '',
    author: article.author || '',
    storedAt: article.storedAt ?? now,
  }));
}

export function groupArticlesByFolder(articles: ArticlePreview[]): Map<number, ArticlePreview[]> {
  const grouped = new Map<number, ArticlePreview[]>();

  for (const article of articles) {
    const folderId = Number.isFinite(article.folderId) ? article.folderId : UNCATEGORIZED_FOLDER_ID;
    const bucket = grouped.get(folderId) ?? [];
    bucket.push(article);
    grouped.set(folderId, bucket);
  }

  return grouped;
}

export interface FolderQueueSortOptions {
  /** Whether skipped folders should be forced to the end of the queue. */
  respectSkip?: boolean;
}

export function sortFolderQueueEntries(
  entries: FolderQueueEntry[],
  options: FolderQueueSortOptions = {},
): FolderQueueEntry[] {
  const { respectSkip = true } = options;

  const sorted = [...entries].sort((a, b) => {
    if (respectSkip) {
      const aSkipped = a.status === 'skipped';
      const bSkipped = b.status === 'skipped';
      if (aSkipped && !bSkipped) return 1;
      if (!aSkipped && bSkipped) return -1;
      if (aSkipped && bSkipped) {
        if (a.sortOrder !== b.sortOrder) return a.sortOrder - b.sortOrder;
        return a.id - b.id;
      }
    }

    if (b.unreadCount !== a.unreadCount) {
      return b.unreadCount - a.unreadCount;
    }

    if (a.sortOrder !== b.sortOrder) {
      return a.sortOrder - b.sortOrder;
    }

    return a.id - b.id;
  });

  return sorted.map((entry, index) => ({
    ...entry,
    sortOrder: index,
  }));
}

export function pinActiveFolder(
  queue: FolderQueueEntry[],
  activeFolderId: number | null,
): FolderQueueEntry[] {
  if (typeof activeFolderId !== 'number') {
    return queue;
  }

  const activeIndex = queue.findIndex((entry) => entry.id === activeFolderId);
  if (activeIndex <= 0) {
    return queue;
  }

  const activeEntry = queue[activeIndex];
  return [activeEntry, ...queue.slice(0, activeIndex), ...queue.slice(activeIndex + 1)];
}

export function moveFolderToEnd(queue: FolderQueueEntry[], folderId: number): FolderQueueEntry[] {
  if (queue.length === 0) return queue;
  const maxSortOrder = queue.reduce((max, entry) => Math.max(max, entry.sortOrder), 0);

  return queue.map((entry) =>
    entry.id === folderId
      ? {
          ...entry,
          status: 'skipped',
          sortOrder: maxSortOrder + 1,
        }
      : entry,
  );
}

function countUnreadPreviews(articles: ArticlePreview[]): number {
  return articles.filter((article) => article.unread).length;
}

export interface FolderQueueBuildOptions extends ArticlePruneOptions {
  existingEntries?: Record<number, FolderQueueEntry>;
}

/**
 * Builds a sorted folder queue from article previews + folder metadata.
 */
export function buildFolderQueueFromArticles(
  folders: Folder[],
  articles: ArticlePreview[],
  options: FolderQueueBuildOptions = {},
): FolderQueueEntry[] {
  if (articles.length === 0) {
    return [];
  }

  const now = options.now ?? Date.now();
  const grouped = groupArticlesByFolder(articles);
  const folderNameMap = new Map<number, string>(folders.map((folder) => [folder.id, folder.name]));
  const nextEntries: FolderQueueEntry[] = [];

  for (const [folderId, previews] of grouped) {
    const prunedArticles = pruneArticlePreviews(previews, { ...options, now });
    const unreadCount = countUnreadPreviews(prunedArticles);

    if (unreadCount === 0) continue;

    const previous = options.existingEntries?.[folderId];
    nextEntries.push({
      id: folderId,
      name:
        folderNameMap.get(folderId) ??
        previous?.name ??
        (folderId === UNCATEGORIZED_FOLDER_ID ? 'Uncategorized' : `Folder ${String(folderId)}`),
      sortOrder: previous?.sortOrder ?? 0,
      status: previous?.status ?? 'queued',
      unreadCount,
      articles: prunedArticles,
      lastUpdated: now,
    });
  }

  return sortFolderQueueEntries(nextEntries);
}

/**
 * Computes folder progression details for UI (current, next, remaining, all-viewed flag).
 */
export function deriveFolderProgress(
  queue: FolderQueueEntry[],
  activeFolderId: number | null,
): FolderProgressState {
  if (queue.length === 0) {
    return {
      currentFolderId: null,
      nextFolderId: null,
      remainingFolderIds: [],
      allViewed: true,
    };
  }

  const ordered = [...queue];
  const matchingEntry = ordered.find((entry) => entry.id === activeFolderId);
  const firstEntry = ordered[0];
  // At this point, firstEntry must exist because we checked queue.length === 0 above
  // Use matchingEntry if found, otherwise fall back to first entry (which is guaranteed to exist)
  const currentEntry = matchingEntry ?? firstEntry;
  const currentIndex = ordered.indexOf(currentEntry);
  const remainingFolderIds =
    currentIndex >= 0
      ? ordered.slice(currentIndex + 1).map((entry) => entry.id)
      : ordered.map((entry) => entry.id);
  const nextFolderId = remainingFolderIds.length > 0 ? remainingFolderIds[0] : null;
  const totalUnread = ordered.reduce((sum, entry) => sum + entry.unreadCount, 0);

  return {
    currentFolderId: currentEntry.id,
    nextFolderId,
    remainingFolderIds,
    allViewed: totalUnread === 0,
  };
}
