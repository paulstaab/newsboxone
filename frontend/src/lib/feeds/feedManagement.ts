import { formatDistanceToNowStrict } from 'date-fns';
import type { Feed, Folder } from '@/types';

export const UNCATEGORIZED_GROUP_NAME = 'Uncategorized';

/**
 * Feed row model enriched with the latest article date used by the management page.
 */
export interface FeedManagementRow {
  feed: Feed;
  lastArticleDate: number | null;
}

/**
 * Folder/feed grouping model for the feed management page.
 */
export interface FeedManagementGroup {
  id: number | null;
  name: string;
  feeds: FeedManagementRow[];
  isUncategorized: boolean;
}

/**
 * Sorts labels using the user's locale with case-insensitive ordering.
 */
export function compareLabels(left: string, right: string): number {
  return left.localeCompare(right, undefined, { sensitivity: 'base' });
}

/**
 * Builds alphabetized feed groups and feed rows for the management page.
 */
export function buildFeedManagementGroups(
  folders: Folder[],
  feeds: Feed[],
  latestArticleDates: Record<number, number | null>,
): FeedManagementGroup[] {
  const folderNameById = new Map(folders.map((folder) => [folder.id, folder.name]));
  const groupedFeeds = new Map<number | null, FeedManagementRow[]>();

  for (const feed of feeds) {
    const folderId = feed.folderId ?? null;
    const rows = groupedFeeds.get(folderId) ?? [];
    rows.push({
      feed,
      lastArticleDate: latestArticleDates[feed.id] ?? null,
    });
    groupedFeeds.set(folderId, rows);
  }

  const groups: FeedManagementGroup[] = [];

  for (const [folderId, rows] of groupedFeeds.entries()) {
    const name =
      folderId === null ? UNCATEGORIZED_GROUP_NAME : (folderNameById.get(folderId) ?? 'Unknown');

    groups.push({
      id: folderId,
      name,
      isUncategorized: folderId === null,
      feeds: [...rows].sort((left, right) => compareLabels(left.feed.title, right.feed.title)),
    });
  }

  return groups.sort((left, right) => compareLabels(left.name, right.name));
}

/**
 * Formats a Unix timestamp in seconds relative to the current time.
 */
export function formatRelativeDateTime(timestampSeconds: number | null): string {
  if (timestampSeconds === null || timestampSeconds <= 0) {
    return 'Not available';
  }

  return formatDistanceToNowStrict(new Date(timestampSeconds * 1000), {
    addSuffix: true,
  });
}

/**
 * Formats a Unix timestamp in seconds using the viewer's local timezone as YYYY-MM-DD HH:mm:ss.
 */
export function formatExactLocalDateTime(timestampSeconds: number | null): string {
  if (timestampSeconds === null || timestampSeconds <= 0) {
    return 'Not available';
  }

  const date = new Date(timestampSeconds * 1000);
  const year = String(date.getFullYear());
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  const hours = String(date.getHours()).padStart(2, '0');
  const minutes = String(date.getMinutes()).padStart(2, '0');
  const seconds = String(date.getSeconds()).padStart(2, '0');

  return `${year}-${month}-${day} ${hours}:${minutes}:${seconds}`;
}
