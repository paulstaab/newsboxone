/**
 * Typed domain implementation for the Feeds API.
 */

import { apiDelete, apiGet, apiPost } from './client';
import type { FeedsApi } from './types';
import { type ApiFeed, type Feed, type FeedsResponse, normalizeFeed } from '@/types';

/**
 * Feed endpoint group implementation.
 */
export const feedsApi: FeedsApi = {
  getAll: async () => {
    const response = await apiGet<FeedsResponse>('/feeds');
    return {
      feeds: response.feeds.map(normalizeFeed),
      starredCount: response.starredCount ?? 0,
      newestItemId: response.newestItemId ?? null,
    };
  },

  create: async (url: string, folderId: number | null = null) => {
    const response = await apiPost<{ feeds: ApiFeed[]; newestItemId: number | null }>('/feeds', {
      url,
      folderId,
    });
    const feeds = response.feeds;
    if (feeds.length === 0) {
      throw new Error('No feed returned from create');
    }
    return {
      feed: normalizeFeed(feeds[0]),
      newestItemId: response.newestItemId,
    };
  },

  delete: async (feedId: number) => {
    await apiDelete(`/feeds/${String(feedId)}`);
  },

  move: async (feedId: number, folderId: number | null) => {
    await apiPost(`/feeds/${String(feedId)}/move`, { folderId });
  },

  rename: async (feedId: number, feedTitle: string) => {
    await apiPost(`/feeds/${String(feedId)}/rename`, { feedTitle });
  },

  markRead: async (feedId: number, newestItemId: number) => {
    await apiPost(`/feeds/${String(feedId)}/read`, { newestItemId });
  },

  updateQuality: async (
    feedId: number,
    input: {
      useExtractedFulltext?: boolean | null;
      useLlmSummary?: boolean | null;
      reevaluate?: boolean;
    },
  ) => {
    const response = await apiPost<{ feed: ApiFeed }>(`/feeds/${String(feedId)}/quality`, input);
    return normalizeFeed(response.feed);
  },
};

/**
 * Fetches all subscribed feeds.
 */
export async function getFeeds(): Promise<{
  feeds: Feed[];
  starredCount: number;
  newestItemId: number | null;
}> {
  return feedsApi.getAll();
}

/**
 * Adds a new feed subscription.
 */
export async function createFeed(
  url: string,
  folderId: number | null = null,
): Promise<{ feed: Feed; newestItemId: number | null }> {
  return feedsApi.create(url, folderId);
}

/**
 * Deletes a feed subscription.
 */
export async function deleteFeed(feedId: number): Promise<void> {
  return feedsApi.delete(feedId);
}

/**
 * Moves a feed to a different folder.
 */
export async function moveFeed(feedId: number, folderId: number | null): Promise<void> {
  return feedsApi.move(feedId, folderId);
}

/**
 * Renames a feed.
 */
export async function renameFeed(feedId: number, feedTitle: string): Promise<void> {
  return feedsApi.rename(feedId, feedTitle);
}

/**
 * Marks all items in a feed as read up to a specific item ID.
 */
export async function markFeedRead(feedId: number, newestItemId: number): Promise<void> {
  return feedsApi.markRead(feedId, newestItemId);
}

/**
 * Updates manual feed-quality preferences or triggers a quality re-evaluation.
 */
export async function updateFeedQuality(
  feedId: number,
  input: {
    useExtractedFulltext?: boolean | null;
    useLlmSummary?: boolean | null;
    reevaluate?: boolean;
  },
): Promise<Feed> {
  return feedsApi.updateQuality(feedId, input);
}
