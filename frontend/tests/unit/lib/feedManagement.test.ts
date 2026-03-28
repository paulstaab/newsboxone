import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { buildFeedManagementGroups, formatRelativeDateTime } from '@/lib/feeds/feedManagement';
import type { Feed, Folder } from '@/types';

function buildFeed(partial: Partial<Feed>): Feed {
  return {
    id: partial.id ?? 1,
    title: partial.title ?? 'Sample Feed',
    url: partial.url ?? 'https://example.com/feed.xml',
    link: partial.link ?? 'https://example.com',
    faviconLink: partial.faviconLink ?? null,
    added: partial.added ?? 0,
    nextUpdateTime: partial.nextUpdateTime ?? null,
    folderId: partial.folderId ?? null,
    unreadCount: partial.unreadCount ?? 0,
    ordering: partial.ordering ?? 0,
    pinned: partial.pinned ?? false,
    lastUpdateError: partial.lastUpdateError ?? null,
    updateMode: partial.updateMode ?? 1,
  };
}

describe('feedManagement utilities', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-03-15T12:00:00Z'));
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('groups folders and feeds alphabetically, including uncategorized feeds', () => {
    const folders: Folder[] = [
      { id: 20, name: 'Podcasts', unreadCount: 0, feedIds: [] },
      { id: 10, name: 'Design', unreadCount: 0, feedIds: [] },
    ];
    const feeds = [
      buildFeed({ id: 1, title: 'Zulu Feed', folderId: 20 }),
      buildFeed({ id: 2, title: 'Alpha Feed', folderId: 20 }),
      buildFeed({ id: 3, title: 'Beta Feed', folderId: null }),
    ];

    const groups = buildFeedManagementGroups(folders, feeds, { 1: 1_700_000_000 });

    expect(groups.map((group) => group.name)).toEqual(['Podcasts', 'Uncategorized']);
    expect(groups[0].feeds.map((row) => row.feed.title)).toEqual(['Alpha Feed', 'Zulu Feed']);
    expect(groups[1].feeds[0].lastArticleDate).toBeNull();
  });

  it('formats timestamps relative to now', () => {
    const twoHoursAgo = Math.floor(new Date('2026-03-15T10:00:00Z').getTime() / 1000);
    const inThreeHours = Math.floor(new Date('2026-03-15T15:00:00Z').getTime() / 1000);

    expect(formatRelativeDateTime(null)).toBe('Not available');
    expect(formatRelativeDateTime(0)).toBe('Not available');
    expect(formatRelativeDateTime(twoHoursAgo)).toBe('2 hours ago');
    expect(formatRelativeDateTime(inThreeHours)).toBe('in 3 hours');
  });
});
