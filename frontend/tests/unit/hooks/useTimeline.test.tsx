import { describe, it, expect, beforeEach, vi } from 'vitest';
import { act, renderHook, waitFor } from '@testing-library/react';
import type { Article, Folder, Feed, ArticlePreview, FolderQueueEntry } from '@/types';
import { useTimeline } from '@/hooks/useTimeline';
import { CONFIG } from '@/lib/config/env';
import { createEmptyTimelineCache } from '@/lib/storage';

// Mock SWR immutable hook to return deterministic folder/feed payloads
const mocks = vi.hoisted(() => ({
  foldersData: { value: [] as Folder[] | undefined },
  feedsData: { value: [] as Feed[] },
  unreadItems: [] as Article[],
}));

vi.mock('@/lib/api/itemsSync', () => {
  return {
    fetchUnreadItemsForSync: vi.fn(() =>
      Promise.resolve({
        items: mocks.unreadItems,
        serverUnreadIds: new Set(mocks.unreadItems.map((item) => item.id)),
      }),
    ),
  };
});

vi.mock('@/lib/storage/timelineCache', async () => {
  const actual = await import('@/lib/storage/timelineCache');
  return {
    ...actual,
    reconcileTimelineCache: actual.reconcileTimelineCache,
  };
});

vi.mock('@/lib/api/folders', () => ({
  getFolders: vi.fn(),
}));

vi.mock('@/lib/api/feeds', () => ({
  getFeeds: vi.fn(),
}));

vi.mock('@/lib/api/items', () => ({
  markItemsRead: vi.fn().mockResolvedValue(undefined),
  markItemRead: vi.fn().mockResolvedValue(undefined),
}));

function buildArticle(partial: Partial<Article>): Article {
  return {
    id: partial.id ?? Math.floor(Math.random() * 10_000),
    guid: partial.guid ?? `guid-${Math.random().toString(36).slice(2)}`,
    guidHash: partial.guidHash ?? 'hash',
    title: partial.title ?? 'Test Article',
    author: partial.author ?? 'NewsBoxOne',
    url: partial.url ?? 'https://example.com/article',
    body: partial.body ?? '<p>Body</p>',
    feedId: partial.feedId ?? 1,
    folderId: partial.folderId ?? null,
    unread: partial.unread ?? true,
    starred: partial.starred ?? false,
    pubDate: partial.pubDate ?? 1_700_000_000,
    lastModified: partial.lastModified ?? 1_700_000_000,
    enclosureLink: partial.enclosureLink ?? null,
    enclosureMime: partial.enclosureMime ?? null,
    fingerprint: partial.fingerprint ?? 'fp',
    contentHash: partial.contentHash ?? 'hash',
    mediaThumbnail: partial.mediaThumbnail ?? null,
    mediaDescription: partial.mediaDescription ?? null,
    rtl: partial.rtl ?? false,
  };
}

function buildPreview(partial: Partial<ArticlePreview>): ArticlePreview {
  return {
    id: partial.id ?? Math.floor(Math.random() * 10_000),
    folderId: partial.folderId ?? 1,
    feedId: partial.feedId ?? 1,
    title: partial.title ?? 'Test Article',
    feedName: partial.feedName ?? 'Sample Feed',
    author: partial.author ?? 'NewsBoxOne',
    summary: partial.summary ?? 'Summary',
    body: partial.body ?? '<p>Body</p>',
    url: partial.url ?? 'https://example.com/article',
    thumbnailUrl: partial.thumbnailUrl ?? null,
    pubDate: partial.pubDate ?? 1_700_000_000,
    unread: partial.unread ?? true,
    starred: partial.starred ?? false,
    hasFullText: partial.hasFullText ?? false,
    storedAt: partial.storedAt ?? Date.now(),
  };
}

function buildEntry(
  partial: Partial<FolderQueueEntry> & { id: number; articles: ArticlePreview[] },
) {
  const unreadCount = partial.articles.filter((article) => article.unread).length;
  return {
    id: partial.id,
    name: partial.name ?? `Folder ${String(partial.id)}`,
    sortOrder: partial.sortOrder ?? 0,
    status: partial.status ?? 'queued',
    unreadCount,
    articles: partial.articles,
    lastUpdated: partial.lastUpdated ?? Date.now(),
  } satisfies FolderQueueEntry;
}

function setCache(entries: FolderQueueEntry[], activeFolderId: number | null = null) {
  const cachedEnvelope = createEmptyTimelineCache();
  for (const entry of entries) {
    cachedEnvelope.folders[entry.id] = entry;
  }
  cachedEnvelope.activeFolderId = activeFolderId;
  localStorage.setItem(CONFIG.TIMELINE_CACHE_KEY, JSON.stringify(cachedEnvelope));
}

function buildFeed(partial: Partial<Feed>): Feed {
  return {
    id: partial.id ?? 1,
    title: partial.title ?? 'Sample Feed',
    url: partial.url ?? 'https://example.com/feed.xml',
    link: partial.link ?? 'https://example.com',
    faviconLink: partial.faviconLink ?? null,
    added: partial.added ?? 0,
    lastArticleDate: partial.lastArticleDate ?? null,
    nextUpdateTime: partial.nextUpdateTime ?? null,
    folderId: partial.folderId ?? null,
    unreadCount: partial.unreadCount ?? 0,
    ordering: partial.ordering ?? 0,
    pinned: partial.pinned ?? false,
    lastUpdateError: partial.lastUpdateError ?? null,
    updateMode: partial.updateMode ?? 1,
    lastQualityCheck: partial.lastQualityCheck ?? null,
    useExtractedFulltext: partial.useExtractedFulltext ?? false,
    useLlmSummary: partial.useLlmSummary ?? false,
    manualUseExtractedFulltext: partial.manualUseExtractedFulltext ?? null,
    manualUseLlmSummary: partial.manualUseLlmSummary ?? null,
    lastManualQualityOverride: partial.lastManualQualityOverride ?? null,
  };
}

describe('useTimeline', () => {
  beforeEach(() => {
    localStorage.clear();
    mocks.foldersData.value = [];
    mocks.feedsData.value = [];
    mocks.unreadItems = [];
  });

  it('prioritizes folders by unread count and exposes active articles', async () => {
    mocks.foldersData.value = [
      { id: 10, name: 'Dev Updates', unreadCount: 0, feedIds: [] },
      { id: 20, name: 'Design Notes', unreadCount: 0, feedIds: [] },
    ];
    mocks.feedsData.value = [
      buildFeed({ id: 1, title: 'Dev Feed', folderId: 10 }),
      buildFeed({ id: 2, title: 'Design Feed', folderId: 20 }),
    ];

    setCache(
      [
        buildEntry({
          id: 10,
          name: 'Dev Updates',
          articles: [
            buildPreview({ id: 1, feedId: 1, folderId: 10, title: 'Dev A' }),
            buildPreview({ id: 2, feedId: 1, folderId: 10, title: 'Dev B' }),
          ],
        }),
        buildEntry({
          id: 20,
          name: 'Design Notes',
          articles: [buildPreview({ id: 3, feedId: 2, folderId: 20, title: 'Design A' })],
        }),
      ],
      10,
    );

    const { result } = renderHook(() => useTimeline());

    await waitFor(() => {
      expect(result.current.queue.length).toBe(2);
      expect(result.current.activeFolder?.id).toBe(10);
    });

    expect(result.current.activeArticles).toHaveLength(2);
    expect(result.current.totalUnread).toBe(3);
    expect(result.current.progress.currentFolderId).toBe(10);
    expect(result.current.progress.nextFolderId).toBe(20);
  });

  it('hydrates from cached envelope when network data is unavailable', async () => {
    const cachedArticles: ArticlePreview[] = [
      {
        id: 99,
        folderId: 42,
        feedId: 9,
        title: 'Offline Story',
        feedName: 'Offline Feed',
        author: 'Offline Author',
        summary: 'Cached summary',
        body: '<p>Cached body</p>',
        url: 'https://example.com/offline',
        thumbnailUrl: null,
        pubDate: 1_700_000_100,
        unread: true,
        starred: false,
        hasFullText: false,
        storedAt: Date.now(),
      },
    ];

    const cachedEntry: FolderQueueEntry = {
      id: 42,
      name: 'Offline Folder',
      sortOrder: 0,
      status: 'queued',
      unreadCount: 1,
      articles: cachedArticles,
      lastUpdated: Date.now(),
    };

    mocks.foldersData.value = undefined;
    setCache([cachedEntry], 42);

    const { result } = renderHook(() => useTimeline());

    await waitFor(() => {
      expect(result.current.activeFolder?.id).toBe(42);
    });

    expect(result.current.activeArticles).toHaveLength(1);
    expect(result.current.activeArticles[0].title).toBe('Offline Story');
    expect(result.current.totalUnread).toBe(1);
    expect(result.current.queue[0]?.name).toBe('Offline Folder');
  });

  it('marks a folder as read, removes articles, and advances to next folder', async () => {
    mocks.foldersData.value = [
      { id: 10, name: 'Dev Updates', unreadCount: 0, feedIds: [] },
      { id: 20, name: 'Design Notes', unreadCount: 0, feedIds: [] },
    ];
    mocks.feedsData.value = [
      buildFeed({ id: 1, folderId: 10 }),
      buildFeed({ id: 2, folderId: 20 }),
    ];

    setCache(
      [
        buildEntry({
          id: 10,
          name: 'Dev Updates',
          articles: [
            buildPreview({ id: 1, feedId: 1, folderId: 10, title: 'Dev A' }),
            buildPreview({ id: 2, feedId: 1, folderId: 10, title: 'Dev B' }),
          ],
        }),
        buildEntry({
          id: 20,
          name: 'Design Notes',
          articles: [buildPreview({ id: 3, feedId: 2, folderId: 20, title: 'Design A' })],
        }),
      ],
      10,
    );
    mocks.unreadItems = [buildArticle({ id: 3, feedId: 2, folderId: 20, title: 'Design A' })];

    const { result } = renderHook(() => useTimeline());

    await waitFor(() => {
      expect(result.current.activeFolder?.id).toBe(10);
      expect(result.current.activeArticles).toHaveLength(2);
    });

    // Mark first folder as read
    await act(async () => {
      await result.current.markFolderRead(10);
    });

    await waitFor(() => {
      expect(result.current.activeFolder?.id).toBe(20);
      expect(result.current.activeArticles).toHaveLength(1);
    });

    expect(result.current.totalUnread).toBe(1);
    expect(result.current.queue).toHaveLength(1);
  });

  it('tracks pendingReadIds when marking folder as read', async () => {
    mocks.foldersData.value = [{ id: 10, name: 'Dev Updates', unreadCount: 0, feedIds: [] }];
    mocks.feedsData.value = [buildFeed({ id: 1, folderId: 10 })];

    setCache(
      [
        buildEntry({
          id: 10,
          name: 'Dev Updates',
          articles: [
            buildPreview({ id: 1, feedId: 1, folderId: 10 }),
            buildPreview({ id: 2, feedId: 1, folderId: 10 }),
          ],
        }),
      ],
      10,
    );

    const { result } = renderHook(() => useTimeline());

    await waitFor(() => {
      expect(result.current.activeFolder?.id).toBe(10);
    });

    // Mark folder as read (this is async)
    let markPromise: Promise<void> = Promise.resolve();
    act(() => {
      markPromise = result.current.markFolderRead(10);
    });

    // Check that items were removed optimistically from queue before the API call completes
    await waitFor(() => {
      expect(result.current.queue).toHaveLength(0);
    });

    // Wait for the API call to complete
    await markPromise;

    // After successful API call, pendingReadIds should be cleared (removed on success)
    const cache = JSON.parse(localStorage.getItem(CONFIG.TIMELINE_CACHE_KEY) ?? '{}') as {
      pendingReadIds?: number[];
    };
    expect(cache.pendingReadIds).toEqual([]);
  });

  it('skips a folder, moving it to the end of the queue', async () => {
    mocks.foldersData.value = [
      { id: 10, name: 'Dev Updates', unreadCount: 0, feedIds: [] },
      { id: 20, name: 'Design Notes', unreadCount: 0, feedIds: [] },
    ];
    mocks.feedsData.value = [
      buildFeed({ id: 1, folderId: 10 }),
      buildFeed({ id: 2, folderId: 20 }),
    ];

    setCache(
      [
        buildEntry({
          id: 10,
          name: 'Dev Updates',
          articles: [buildPreview({ id: 1, feedId: 1, folderId: 10, title: 'Dev A' })],
        }),
        buildEntry({
          id: 20,
          name: 'Design Notes',
          articles: [buildPreview({ id: 3, feedId: 2, folderId: 20, title: 'Design A' })],
        }),
      ],
      10,
    );

    const { result } = renderHook(() => useTimeline());

    await waitFor(() => {
      expect(result.current.activeFolder?.id).toBe(10);
    });

    // Skip first folder
    await act(async () => {
      await result.current.skipFolder(10);
    });

    await waitFor(() => {
      expect(result.current.activeFolder?.id).toBe(20);
    });

    // Check that folder 10 is now at the end of the queue
    expect(result.current.queue).toHaveLength(2);
    expect(result.current.queue[0].id).toBe(20);
    expect(result.current.queue[1].id).toBe(10);
    expect(result.current.queue[1].status).toBe('skipped');
  });

  it('pins a selected folder to the front while preserving remaining order', async () => {
    mocks.foldersData.value = [
      { id: 10, name: 'Dev Updates', unreadCount: 0, feedIds: [] },
      { id: 20, name: 'Design Notes', unreadCount: 0, feedIds: [] },
      { id: 30, name: 'Growth', unreadCount: 0, feedIds: [] },
    ];
    mocks.feedsData.value = [
      buildFeed({ id: 1, folderId: 10 }),
      buildFeed({ id: 2, folderId: 20 }),
      buildFeed({ id: 3, folderId: 30 }),
    ];

    setCache(
      [
        buildEntry({
          id: 10,
          name: 'Dev Updates',
          articles: [
            buildPreview({ id: 1, feedId: 1, folderId: 10 }),
            buildPreview({ id: 2, feedId: 1, folderId: 10 }),
          ],
        }),
        buildEntry({
          id: 20,
          name: 'Design Notes',
          articles: [
            buildPreview({ id: 3, feedId: 2, folderId: 20 }),
            buildPreview({ id: 4, feedId: 2, folderId: 20 }),
          ],
        }),
        buildEntry({
          id: 30,
          name: 'Growth',
          articles: [buildPreview({ id: 5, feedId: 3, folderId: 30 })],
        }),
      ],
      10,
    );

    const { result } = renderHook(() => useTimeline());

    await waitFor(() => {
      expect(result.current.queue[0]?.id).toBe(10);
    });

    act(() => {
      result.current.setActiveFolder(30);
    });

    await waitFor(() => {
      expect(result.current.activeFolder?.id).toBe(30);
    });

    expect(result.current.queue.map((entry) => entry.id)).toEqual([30, 10, 20]);
  });

  it('keeps read items in cache until the next sync reconciliation', async () => {
    mocks.foldersData.value = [{ id: 10, name: 'Dev Updates', unreadCount: 0, feedIds: [] }];
    mocks.feedsData.value = [buildFeed({ id: 1, folderId: 10 })];

    setCache(
      [
        buildEntry({
          id: 10,
          name: 'Dev Updates',
          articles: [
            buildPreview({ id: 1, feedId: 1, folderId: 10, title: 'Dev A' }),
            buildPreview({ id: 2, feedId: 1, folderId: 10, title: 'Dev B' }),
          ],
        }),
      ],
      10,
    );

    const { result } = renderHook(() => useTimeline());

    await waitFor(() => {
      expect(result.current.activeArticles).toHaveLength(2);
    });

    await act(async () => {
      await result.current.markItemRead(1);
    });

    await waitFor(() => {
      expect(result.current.activeArticles).toHaveLength(2);
      expect(result.current.activeArticles[0].unread).toBe(false);
    });

    await act(async () => {
      await result.current.markItemRead(2);
    });

    await waitFor(() => {
      expect(result.current.queue).toHaveLength(1);
      expect(result.current.activeFolder?.id).toBe(10);
      expect(result.current.activeArticles.every((article) => !article.unread)).toBe(true);
    });
  });

  it('restarts the queue when all folders are skipped', async () => {
    mocks.foldersData.value = [{ id: 10, name: 'Dev Updates', unreadCount: 0, feedIds: [] }];
    mocks.feedsData.value = [buildFeed({ id: 1, folderId: 10 })];
    setCache(
      [
        buildEntry({
          id: 10,
          name: 'Dev Updates',
          articles: [buildPreview({ id: 1, feedId: 1, folderId: 10 })],
        }),
      ],
      10,
    );

    const { result } = renderHook(() => useTimeline());

    await waitFor(() => {
      expect(result.current.activeFolder?.id).toBe(10);
    });

    // Skip the only folder
    await act(async () => {
      await result.current.skipFolder(10);
    });

    await waitFor(() => {
      expect(result.current.activeFolder).toBeNull();
      expect(result.current.queue[0].status).toBe('skipped');
    });

    // Restart
    await act(async () => {
      await result.current.restart();
    });

    await waitFor(() => {
      expect(result.current.activeFolder?.id).toBe(10);
      expect(result.current.queue[0].status).toBe('queued');
    });
  });
});
