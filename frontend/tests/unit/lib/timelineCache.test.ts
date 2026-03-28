import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { ArticlePreview, TimelineCacheEnvelope } from '@/types';
import {
  createEmptyTimelineCache,
  loadTimelineCache,
  pruneTimelineCache,
  storeTimelineCache,
} from '@/lib/storage/timelineCache';
import { CONFIG } from '@/lib/config/env';

const DAY_IN_MS = 24 * 60 * 60 * 1000;

function createPreview(overrides: Partial<ArticlePreview> = {}): ArticlePreview {
  return {
    id: overrides.id ?? Math.floor(Math.random() * 10_000),
    folderId: overrides.folderId ?? 1,
    feedId: overrides.feedId ?? 99,
    title: overrides.title ?? 'Sample article',
    feedName: overrides.feedName ?? 'Sample Feed',
    author: overrides.author ?? 'Sample Author',
    summary: overrides.summary ?? 'Summary',
    body: overrides.body ?? '<p>Body</p>',
    url: overrides.url ?? 'https://example.com/article',
    thumbnailUrl: overrides.thumbnailUrl ?? null,
    pubDate: overrides.pubDate ?? Math.floor(Date.now() / 1000),
    unread: overrides.unread ?? true,
    starred: overrides.starred ?? false,
    hasFullText: overrides.hasFullText ?? true,
    storedAt: overrides.storedAt ?? Date.now(),
  };
}

beforeEach(() => {
  vi.useFakeTimers();
  vi.setSystemTime(new Date('2025-01-01T00:00:00Z'));
  localStorage.clear();
});

afterEach(() => {
  vi.useRealTimers();
});

describe('timeline cache helpers', () => {
  it('returns empty envelope when nothing is stored', () => {
    const envelope = loadTimelineCache();
    expect(envelope).toEqual(createEmptyTimelineCache());
  });

  it('persists and reloads pruned envelopes', () => {
    const envelope: TimelineCacheEnvelope = {
      version: CONFIG.TIMELINE_CACHE_VERSION,
      lastSynced: Date.now(),
      activeFolderId: 1,
      folders: {
        1: {
          id: 1,
          name: 'Engineering',
          sortOrder: 0,
          status: 'active',
          unreadCount: 2,
          articles: [createPreview({ id: 1 }), createPreview({ id: 2 })],
          lastUpdated: Date.now(),
        },
      },
      pendingReadIds: [1, 1, 2],
      pendingSkipFolderIds: [1, 42],
    };

    storeTimelineCache(envelope);
    const loaded = loadTimelineCache();

    expect(loaded.folders[1].articles).toHaveLength(2);
    expect(loaded.pendingReadIds).toEqual([1, 2]);
    expect(loaded.pendingSkipFolderIds).toEqual([]);
  });

  it('drops stale articles and removes empty folders during pruning', () => {
    const now = Date.now();
    const oldTimestamp = now - (CONFIG.TIMELINE_MAX_ITEM_AGE_DAYS + 1) * DAY_IN_MS;

    const envelope: TimelineCacheEnvelope = {
      version: CONFIG.TIMELINE_CACHE_VERSION,
      lastSynced: now,
      activeFolderId: 1,
      folders: {
        1: {
          id: 1,
          name: 'Engineering',
          sortOrder: 0,
          status: 'queued',
          unreadCount: 1,
          articles: [createPreview({ id: 1, storedAt: oldTimestamp })],
          lastUpdated: now,
        },
        2: {
          id: 2,
          name: 'Design',
          sortOrder: 1,
          status: 'queued',
          unreadCount: CONFIG.TIMELINE_MAX_ITEMS_PER_FOLDER + 5,
          articles: Array.from({ length: CONFIG.TIMELINE_MAX_ITEMS_PER_FOLDER + 5 }, (_, index) =>
            createPreview({ id: 2000 + index, folderId: 2 }),
          ),
          lastUpdated: now,
        },
      },
      pendingReadIds: [],
      pendingSkipFolderIds: [],
    };

    const pruned = pruneTimelineCache(envelope, now);

    expect(pruned.folders[1]).toBeUndefined();
    expect(pruned.folders[2].articles).toHaveLength(CONFIG.TIMELINE_MAX_ITEMS_PER_FOLDER);
  });
});

describe('mergeItemsIntoCache', () => {
  it('merges new articles into existing folders without duplicates', async () => {
    const { mergeItemsIntoCache } = await import('@/lib/storage/timelineCache');
    const now = Date.now();

    const existingEnvelope: TimelineCacheEnvelope = {
      version: CONFIG.TIMELINE_CACHE_VERSION,
      lastSynced: now - 1000,
      activeFolderId: 1,
      folders: {
        1: {
          id: 1,
          name: 'Engineering',
          sortOrder: 0,
          status: 'active',
          unreadCount: 2,
          articles: [createPreview({ id: 1, folderId: 1 }), createPreview({ id: 2, folderId: 1 })],
          lastUpdated: now - 1000,
        },
      },
      pendingReadIds: [],
      pendingSkipFolderIds: [],
    };

    const newArticles: ArticlePreview[] = [
      createPreview({ id: 2, folderId: 1 }), // Duplicate
      createPreview({ id: 3, folderId: 1 }), // New
      createPreview({ id: 4, folderId: 1 }), // New
    ];

    const merged = mergeItemsIntoCache(existingEnvelope, newArticles, now);

    expect(merged.folders[1].articles).toHaveLength(4);
    expect(merged.folders[1].articles.map((a) => a.id)).toEqual([1, 2, 3, 4]);
    expect(merged.folders[1].unreadCount).toBe(4);
    expect(merged.lastSynced).toBe(now);
  });

  it('respects pendingReadIds as tombstones', async () => {
    const { mergeItemsIntoCache } = await import('@/lib/storage/timelineCache');
    const now = Date.now();

    const existingEnvelope: TimelineCacheEnvelope = {
      version: CONFIG.TIMELINE_CACHE_VERSION,
      lastSynced: now - 1000,
      activeFolderId: 1,
      folders: {
        1: {
          id: 1,
          name: 'Engineering',
          sortOrder: 0,
          status: 'active',
          unreadCount: 1,
          articles: [createPreview({ id: 1, folderId: 1 })],
          lastUpdated: now - 1000,
        },
      },
      pendingReadIds: [2, 3], // These should be blocked
      pendingSkipFolderIds: [],
    };

    const newArticles: ArticlePreview[] = [
      createPreview({ id: 2, folderId: 1 }), // Should be blocked
      createPreview({ id: 3, folderId: 1 }), // Should be blocked
      createPreview({ id: 4, folderId: 1 }), // Should be added
    ];

    const merged = mergeItemsIntoCache(existingEnvelope, newArticles, now);

    expect(merged.folders[1].articles).toHaveLength(2);
    expect(merged.folders[1].articles.map((a) => a.id)).toEqual([1, 4]);
    expect(merged.pendingReadIds).toEqual([2, 3]); // Tombstones persist
  });

  it('creates new folder entries for articles in new folders', async () => {
    const { mergeItemsIntoCache } = await import('@/lib/storage/timelineCache');
    const now = Date.now();

    const existingEnvelope: TimelineCacheEnvelope = {
      version: CONFIG.TIMELINE_CACHE_VERSION,
      lastSynced: now - 1000,
      activeFolderId: 1,
      folders: {
        1: {
          id: 1,
          name: 'Engineering',
          sortOrder: 0,
          status: 'active',
          unreadCount: 1,
          articles: [createPreview({ id: 1, folderId: 1 })],
          lastUpdated: now - 1000,
        },
      },
      pendingReadIds: [],
      pendingSkipFolderIds: [],
    };

    const newArticles: ArticlePreview[] = [
      createPreview({ id: 10, folderId: 2 }), // New folder
      createPreview({ id: 11, folderId: 2 }), // New folder
    ];

    const merged = mergeItemsIntoCache(existingEnvelope, newArticles, now);

    expect(merged.folders[1]).toBeDefined();
    expect(merged.folders[2]).toBeDefined();
    expect(merged.folders[2].articles).toHaveLength(2);
    expect(merged.folders[2].unreadCount).toBe(2);
  });

  it('keeps folders with only read items after merge until sync cleanup', async () => {
    const { mergeItemsIntoCache } = await import('@/lib/storage/timelineCache');
    const now = Date.now();

    const existingEnvelope: TimelineCacheEnvelope = {
      version: CONFIG.TIMELINE_CACHE_VERSION,
      lastSynced: now - 1000,
      activeFolderId: 1,
      folders: {
        1: {
          id: 1,
          name: 'Engineering',
          sortOrder: 0,
          status: 'active',
          unreadCount: 2,
          articles: [
            createPreview({ id: 1, folderId: 1, unread: false }),
            createPreview({ id: 2, folderId: 1, unread: false }),
          ],
          lastUpdated: now - 1000,
        },
      },
      pendingReadIds: [],
      pendingSkipFolderIds: [],
    };

    const newArticles: ArticlePreview[] = [
      createPreview({ id: 3, folderId: 1, unread: false }), // Also read
    ];

    const merged = mergeItemsIntoCache(existingEnvelope, newArticles, now);

    expect(merged.folders[1]).toBeDefined();
    expect(merged.folders[1].unreadCount).toBe(0);
    expect(merged.folders[1].articles).toHaveLength(3);
    expect(merged.activeFolderId).toBe(1);
  });

  it('preserves folder metadata during merge', async () => {
    const { mergeItemsIntoCache } = await import('@/lib/storage/timelineCache');
    const now = Date.now();

    const existingEnvelope: TimelineCacheEnvelope = {
      version: CONFIG.TIMELINE_CACHE_VERSION,
      lastSynced: now - 1000,
      activeFolderId: 1,
      folders: {
        1: {
          id: 1,
          name: 'Engineering',
          sortOrder: 0,
          status: 'active',
          unreadCount: 1,
          articles: [createPreview({ id: 1, folderId: 1 })],
          lastUpdated: now - 1000,
        },
      },
      pendingReadIds: [],
      pendingSkipFolderIds: [],
    };

    const newArticles: ArticlePreview[] = [createPreview({ id: 2, folderId: 1 })];

    const merged = mergeItemsIntoCache(existingEnvelope, newArticles, now);

    expect(merged.folders[1].name).toBe('Engineering');
    expect(merged.folders[1].status).toBe('active');
    expect(merged.folders[1].id).toBe(1);
  });

  it('applies pruning during merge to respect retention limits', async () => {
    const { mergeItemsIntoCache } = await import('@/lib/storage/timelineCache');
    const now = Date.now();
    const oldTimestamp = now - (CONFIG.TIMELINE_MAX_ITEM_AGE_DAYS + 1) * DAY_IN_MS;

    const existingEnvelope: TimelineCacheEnvelope = {
      version: CONFIG.TIMELINE_CACHE_VERSION,
      lastSynced: now - 1000,
      activeFolderId: 1,
      folders: {
        1: {
          id: 1,
          name: 'Engineering',
          sortOrder: 0,
          status: 'active',
          unreadCount: 1,
          articles: [createPreview({ id: 1, folderId: 1, storedAt: oldTimestamp })],
          lastUpdated: now - 1000,
        },
      },
      pendingReadIds: [],
      pendingSkipFolderIds: [],
    };

    const newArticles: ArticlePreview[] = [createPreview({ id: 2, folderId: 1, storedAt: now })];

    const merged = mergeItemsIntoCache(existingEnvelope, newArticles, now);

    // Old article should be pruned, only new one remains
    expect(merged.folders[1].articles).toHaveLength(1);
    expect(merged.folders[1].articles[0].id).toBe(2);
  });
});
