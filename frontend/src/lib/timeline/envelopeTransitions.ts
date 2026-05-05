import { moveFolderToEnd, sortFolderQueueEntries } from '@/lib/utils/unreadAggregator';
import type { TimelineCacheEnvelope } from '@/types';
import { buildFolderMap, findNextActiveId } from './envelope';

/**
 * Selects an active folder and re-queues it when it had been skipped.
 */
export function activateTimelineFolder(
  current: TimelineCacheEnvelope,
  folderId: number,
): TimelineCacheEnvelope {
  if (!(folderId in current.folders)) {
    return current;
  }

  const target = current.folders[folderId];
  const updatedFolders = { ...current.folders };
  if (target.status === 'skipped') {
    updatedFolders[folderId] = {
      ...target,
      status: 'queued',
    };
  }

  return {
    ...current,
    folders: updatedFolders,
    activeFolderId: folderId,
  };
}

/**
 * Removes a folder from the queue after all its visible articles are marked read.
 */
export function markTimelineFolderRead(
  current: TimelineCacheEnvelope,
  folderId: number,
): { envelope: TimelineCacheEnvelope; itemIds: number[] } {
  if (!(folderId in current.folders)) {
    return { envelope: current, itemIds: [] };
  }

  const folder = current.folders[folderId];
  const itemIds = folder.articles.map((article) => article.id);
  const { [folderId]: _removed, ...updatedFolders } = current.folders;
  void _removed;

  const remainingQueue = sortFolderQueueEntries(Object.values(updatedFolders));
  const nextActiveId = findNextActiveId(remainingQueue);

  return {
    envelope: {
      ...current,
      folders: buildFolderMap(remainingQueue),
      activeFolderId: nextActiveId,
      pendingReadIds: [...current.pendingReadIds, ...itemIds],
    },
    itemIds,
  };
}

/**
 * Clears successfully persisted read ids from the pending queue.
 */
export function clearPendingReadIds(
  current: TimelineCacheEnvelope,
  itemIds: number[],
): TimelineCacheEnvelope {
  const pending = new Set(itemIds);
  return {
    ...current,
    pendingReadIds: current.pendingReadIds.filter((id) => !pending.has(id)),
  };
}

/**
 * Moves one folder to the end of the queue as skipped.
 */
export function skipTimelineFolder(
  current: TimelineCacheEnvelope,
  folderId: number,
): TimelineCacheEnvelope {
  const updatedEntries = moveFolderToEnd(Object.values(current.folders), folderId);
  const remainingQueue = sortFolderQueueEntries(updatedEntries);
  const nextActiveId = findNextActiveId(remainingQueue);

  return {
    ...current,
    folders: buildFolderMap(remainingQueue),
    activeFolderId: nextActiveId,
    pendingSkipFolderIds: [...current.pendingSkipFolderIds, folderId],
  };
}

/**
 * Re-queues skipped folders and chooses the next active folder.
 */
export function restartTimelineQueue(current: TimelineCacheEnvelope): TimelineCacheEnvelope {
  const updatedFolders = { ...current.folders };

  Object.values(updatedFolders).forEach((folder) => {
    if (folder.status === 'skipped') {
      updatedFolders[folder.id] = {
        ...folder,
        status: 'queued',
      };
    }
  });

  const remainingQueue = sortFolderQueueEntries(Object.values(updatedFolders));
  const nextActiveId = findNextActiveId(remainingQueue);

  return {
    ...current,
    folders: buildFolderMap(remainingQueue),
    activeFolderId: nextActiveId,
    pendingSkipFolderIds: [],
  };
}

/**
 * Optimistically marks one item read inside the cached timeline envelope.
 */
export function markTimelineItemRead(
  current: TimelineCacheEnvelope,
  itemId: number,
): TimelineCacheEnvelope {
  const updatedFolders = { ...current.folders };
  let targetFolderId: number | null = null;

  for (const folderIdStr in updatedFolders) {
    const fid = Number(folderIdStr);
    const folder = updatedFolders[fid];
    if (folder.articles.some((article) => article.id === itemId)) {
      targetFolderId = fid;
      break;
    }
  }

  if (targetFolderId === null) {
    return current;
  }

  const folder = updatedFolders[targetFolderId];
  const updatedArticles = folder.articles.map((article) =>
    article.id === itemId ? { ...article, unread: false } : article,
  );

  updatedFolders[targetFolderId] = {
    ...folder,
    articles: updatedArticles,
    unreadCount: updatedArticles.filter((article) => article.unread).length,
  };

  const remainingQueue = sortFolderQueueEntries(Object.values(updatedFolders));
  const nextActiveId =
    current.activeFolderId === targetFolderId && targetFolderId in updatedFolders
      ? targetFolderId
      : findNextActiveId(remainingQueue);

  return {
    ...current,
    folders: buildFolderMap(remainingQueue),
    activeFolderId: nextActiveId,
    pendingReadIds: [...current.pendingReadIds, itemId],
  };
}
