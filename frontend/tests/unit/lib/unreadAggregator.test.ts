import { describe, expect, it } from 'vitest';
import type { ArticlePreview, Folder } from '@/types';
import { buildFolderQueueFromArticles, deriveFolderProgress } from '@/lib/utils/unreadAggregator';

const DAY_IN_MS = 24 * 60 * 60 * 1000;

function preview(overrides: Partial<ArticlePreview> = {}): ArticlePreview {
  return {
    id: overrides.id ?? Math.floor(Math.random() * 10000),
    folderId: overrides.folderId ?? 1,
    feedId: overrides.feedId ?? 1,
    title: overrides.title ?? 'Title',
    feedName: overrides.feedName ?? 'Feed Title',
    author: overrides.author ?? 'Author Name',
    summary: overrides.summary ?? 'Summary',
    body: overrides.body ?? '<p>Body</p>',
    url: overrides.url ?? 'https://example.com',
    thumbnailUrl: overrides.thumbnailUrl ?? null,
    pubDate: overrides.pubDate ?? Math.floor(Date.now() / 1000),
    unread: overrides.unread ?? true,
    starred: overrides.starred ?? false,
    hasFullText: overrides.hasFullText ?? false,
    storedAt: overrides.storedAt ?? Date.now(),
  };
}

describe('buildFolderQueueFromArticles', () => {
  it('sorts folders by unread count with deterministic tie-breakers', () => {
    const now = Date.now();
    const folders: Folder[] = [
      { id: 1, name: 'Beta', unreadCount: 0, feedIds: [] },
      { id: 2, name: 'Alpha', unreadCount: 0, feedIds: [] },
    ];

    const articles: ArticlePreview[] = [
      preview({ id: 1, folderId: 1, storedAt: now }),
      preview({ id: 2, folderId: 2, storedAt: now, unread: true }),
      preview({ id: 3, folderId: 2, storedAt: now, unread: true }),
    ];

    const queue = buildFolderQueueFromArticles(folders, articles, { now });
    expect(queue.map((entry) => entry.id)).toEqual([2, 1]);
    expect(queue[0].unreadCount).toBe(2);
    expect(queue[1].unreadCount).toBe(1);
  });

  it('prunes articles exceeding retention caps', () => {
    const now = Date.now();
    const folders: Folder[] = [{ id: 1, name: 'Design', unreadCount: 0, feedIds: [] }];

    const articles: ArticlePreview[] = [
      preview({ id: 1, storedAt: now }),
      preview({ id: 2, storedAt: now - 2 * DAY_IN_MS }),
      preview({ id: 3, storedAt: now - 30 * DAY_IN_MS }),
    ];

    const queue = buildFolderQueueFromArticles(folders, articles, {
      now,
      maxItems: 2,
      maxAgeMs: 10 * DAY_IN_MS,
    });

    expect(queue[0].articles).toHaveLength(2);
    expect(queue[0].articles.some((article) => article.id === 3)).toBe(false);
  });
});

describe('deriveFolderProgress', () => {
  it('returns current, next, and remaining folder IDs', () => {
    const now = Date.now();
    const folders: Folder[] = [
      { id: 1, name: 'Engineering', unreadCount: 0, feedIds: [] },
      { id: 2, name: 'Design', unreadCount: 0, feedIds: [] },
    ];

    const articles: ArticlePreview[] = [
      preview({ id: 1, folderId: 1, storedAt: now }),
      preview({ id: 2, folderId: 2, storedAt: now }),
    ];

    const queue = buildFolderQueueFromArticles(folders, articles, { now });
    const progress = deriveFolderProgress(queue, queue[0]?.id ?? null);

    expect(progress.currentFolderId).toBe(queue[0]?.id ?? null);
    expect(progress.nextFolderId).toBe(queue[1]?.id ?? null);
    expect(progress.remainingFolderIds).toEqual(queue.slice(1).map((entry) => entry.id));
    expect(progress.allViewed).toBe(false);
  });
});
