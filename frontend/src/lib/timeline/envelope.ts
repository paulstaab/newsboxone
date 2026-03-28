import type { FolderQueueEntry } from '@/types';

/**
 * Rebuilds the folder record from the ordered queue representation.
 */
export function buildFolderMap(entries: FolderQueueEntry[]): Record<number, FolderQueueEntry> {
  return entries.reduce<Record<number, FolderQueueEntry>>((acc, entry) => {
    acc[entry.id] = entry;
    return acc;
  }, {});
}

/**
 * Returns the next non-skipped folder ID to activate.
 */
export function findNextActiveId(queue: FolderQueueEntry[]): number | null {
  const nextActive = queue.find((entry) => entry.status !== 'skipped');
  return nextActive ? nextActive.id : null;
}
