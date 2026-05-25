import { beforeEach, describe, expect, it, vi } from 'vitest';
import { fetchUnreadItemsForSync } from '@/lib/api/itemsSync';
import type { Article } from '@/types';

const apiMocks = vi.hoisted(() => ({
  getItems: vi.fn(),
}));

vi.mock('@/lib/api/apiClient', () => ({
  api: {
    items: {
      get: apiMocks.getItems,
    },
  },
}));

function article(id: number): Article {
  return {
    id,
    guid: `guid-${String(id)}`,
    guidHash: `hash-${String(id)}`,
    title: `Article ${String(id)}`,
    author: 'NewsBoxOne',
    url: `https://example.com/${String(id)}`,
    body: '',
    feedId: 1,
    folderId: null,
    unread: true,
    starred: false,
    pubDate: id,
    lastModified: id,
    enclosureLink: null,
    enclosureMime: null,
    fingerprint: '',
    contentHash: '',
    mediaThumbnail: null,
    mediaDescription: null,
    rtl: false,
  };
}

describe('fetchUnreadItemsForSync', () => {
  beforeEach(() => {
    apiMocks.getItems.mockReset();
  });

  it('paginates using newest item id boundaries without skipping unread items', async () => {
    apiMocks.getItems.mockImplementation(({ offset = 0, batchSize = 20 } = {}) => {
      const allIds = Array.from({ length: 100 }, (_value, index) => 100 - index);
      const boundedIds = offset > 0 ? allIds.filter((id) => id <= offset) : allIds;
      return Promise.resolve(boundedIds.slice(0, batchSize).map(article));
    });

    const result = await fetchUnreadItemsForSync({ batchSize: 20 });

    expect(result.items.map((item) => item.id)).toEqual(
      Array.from({ length: 100 }, (_value, index) => 100 - index),
    );
    expect(result.serverUnreadIds.size).toBe(100);
    const requestedOffsets = apiMocks.getItems.mock.calls.map((call) => {
      const params = call[0] as { offset?: number } | undefined;
      return params?.offset;
    });
    expect(requestedOffsets).toEqual([0, 80, 60, 40, 20]);
  });
});
