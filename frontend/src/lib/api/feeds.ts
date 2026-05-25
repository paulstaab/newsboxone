/**
 * Typed domain implementation for the Feeds API.
 */

import { apiDelete, apiGet, apiPost } from './client';
import type { FeedsApi } from './types';
import { type ApiFeed, type FeedsResponse, normalizeFeed } from '@/types';

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

    const createdFeed =
      feeds.find((feed) => feed.url === url && (feed.folderId ?? null) === folderId) ?? feeds[0];

    return {
      feed: normalizeFeed(createdFeed),
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
