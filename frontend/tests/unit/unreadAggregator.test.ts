import { describe, expect, it } from 'vitest';
import type { FolderQueueEntry } from '@/types';
import {
  moveFolderToEnd,
  pinActiveFolder,
  sortFolderQueueEntries,
} from '@/lib/utils/unreadAggregator';

function entry(overrides: Partial<FolderQueueEntry>): FolderQueueEntry {
  return {
    id: overrides.id ?? 1,
    name: overrides.name ?? 'Folder',
    sortOrder: overrides.sortOrder ?? 0,
    status: overrides.status ?? 'queued',
    unreadCount: overrides.unreadCount ?? 1,
    articles: overrides.articles ?? [],
    lastUpdated: overrides.lastUpdated ?? Date.now(),
  };
}

describe('folder queue ordering', () => {
  it('sorts by unread count and preserves stable ties by sortOrder', () => {
    const queue = sortFolderQueueEntries([
      entry({ id: 1, unreadCount: 2, sortOrder: 5 }),
      entry({ id: 2, unreadCount: 3, sortOrder: 1 }),
      entry({ id: 3, unreadCount: 2, sortOrder: 2 }),
    ]);

    expect(queue.map((item) => item.id)).toEqual([2, 3, 1]);
  });

  it('forces skipped folders to the end and keeps their relative order', () => {
    const moved = moveFolderToEnd(
      [
        entry({ id: 1, unreadCount: 5, sortOrder: 0 }),
        entry({ id: 2, unreadCount: 1, sortOrder: 1 }),
        entry({ id: 3, unreadCount: 3, sortOrder: 2 }),
      ],
      1,
    );

    const queue = sortFolderQueueEntries(moved);
    expect(queue.map((item) => item.id)).toEqual([3, 2, 1]);
    expect(queue[2]?.status).toBe('skipped');
  });

  it('pins the active folder while preserving the remaining order', () => {
    const queue = sortFolderQueueEntries([
      entry({ id: 1, unreadCount: 3 }),
      entry({ id: 2, unreadCount: 2 }),
      entry({ id: 3, unreadCount: 1 }),
    ]);

    const pinned = pinActiveFolder(queue, 3);
    expect(pinned.map((item) => item.id)).toEqual([3, 1, 2]);
  });
});
