/**
 * Typed domain wrapper for the Feeds API.
 * Aligned with contracts/feeds.md
 *
 * Re-exports from the centralized API client for backward compatibility.
 */

import { api } from './apiClient';
import type { Feed } from '@/types';

/**
 * Fetches all subscribed feeds.
 */
export async function getFeeds(): Promise<{
  feeds: Feed[];
  starredCount: number;
  newestItemId: number | null;
}> {
  return api.feeds.getAll();
}

/**
 * Adds a new feed subscription.
 */
export async function createFeed(
  url: string,
  folderId: number | null = null,
): Promise<{ feed: Feed; newestItemId: number | null }> {
  return api.feeds.create(url, folderId);
}

/**
 * Deletes a feed subscription.
 */
export async function deleteFeed(feedId: number): Promise<void> {
  return api.feeds.delete(feedId);
}

/**
 * Moves a feed to a different folder.
 */
export async function moveFeed(feedId: number, folderId: number | null): Promise<void> {
  return api.feeds.move(feedId, folderId);
}

/**
 * Renames a feed.
 */
export async function renameFeed(feedId: number, feedTitle: string): Promise<void> {
  return api.feeds.rename(feedId, feedTitle);
}

/**
 * Marks all items in a feed as read up to a specific item ID.
 */
export async function markFeedRead(feedId: number, newestItemId: number): Promise<void> {
  return api.feeds.markRead(feedId, newestItemId);
}
