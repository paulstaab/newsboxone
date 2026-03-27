'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuthGuard } from '@/hooks/useAuthGuard';
import { createFeed, deleteFeed, getFeeds, moveFeed, renameFeed } from '@/lib/api/feeds';
import { createFolder, deleteFolder, getFolders, renameFolder } from '@/lib/api/folders';
import { getItems } from '@/lib/api/items';
import { AuthenticationError } from '@/lib/api/client';
import { formatError } from '@/lib/utils/errorFormatter';
import { ItemFilterType, type Feed, type Folder } from '@/types';
import {
  buildFeedManagementGroups,
  compareLabels,
  type FeedManagementGroup,
} from '@/lib/feeds/feedManagement';

interface FeedManagementData {
  folders: Folder[];
  feeds: Feed[];
}

/**
 * Removes a feed activity entry without mutating the source record.
 */
function omitLatestArticleDate(
  entries: Record<number, number | null>,
  feedId: number,
): Record<number, number | null> {
  return Object.fromEntries(
    Object.entries(entries).filter(([entryId]) => Number(entryId) !== feedId),
  ) as Record<number, number | null>;
}

/**
 * Returns true when keyboard shortcuts should be ignored because focus is inside an editable field.
 */
function isEditableTarget(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) {
    return false;
  }

  const tagName = target.tagName;
  return (
    target.isContentEditable ||
    tagName === 'INPUT' ||
    tagName === 'TEXTAREA' ||
    tagName === 'SELECT'
  );
}

/**
 * Owns feed-management page data loading, dialogs, and mutations.
 */
export function useFeedManagementPage() {
  const router = useRouter();
  const { isAuthenticated, isInitializing, logout } = useAuthGuard();
  const createFeedDialogRef = useRef<HTMLDialogElement>(null);
  const createFolderDialogRef = useRef<HTMLDialogElement>(null);
  const moveFeedDialogRef = useRef<HTMLDialogElement>(null);

  const [data, setData] = useState<FeedManagementData>({ folders: [], feeds: [] });
  const [latestArticleDates, setLatestArticleDates] = useState<Record<number, number | null>>({});
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [busyLabel, setBusyLabel] = useState<string | null>(null);
  const [pageError, setPageError] = useState<string | null>(null);
  const [mutationError, setMutationError] = useState<string | null>(null);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);
  const [newFeedUrl, setNewFeedUrl] = useState('');
  const [newFeedFolderId, setNewFeedFolderId] = useState('');
  const [newFolderName, setNewFolderName] = useState('');
  const [editingFolderId, setEditingFolderId] = useState<number | null>(null);
  const [editingFolderName, setEditingFolderName] = useState('');
  const [editingFeedId, setEditingFeedId] = useState<number | null>(null);
  const [editingFeedTitle, setEditingFeedTitle] = useState('');
  const [moveFeedId, setMoveFeedId] = useState<number | null>(null);
  const [moveFeedTitle, setMoveFeedTitle] = useState('');
  const [moveFeedFolderId, setMoveFeedFolderId] = useState('');

  const sortedFolders = useMemo(
    () => [...data.folders].sort((left, right) => compareLabels(left.name, right.name)),
    [data.folders],
  );
  const groups = useMemo<FeedManagementGroup[]>(
    () => buildFeedManagementGroups(data.folders, data.feeds, latestArticleDates),
    [data.feeds, data.folders, latestArticleDates],
  );

  const handleRequestError = useCallback(
    (error: unknown, fallbackMessage: string) => {
      if (error instanceof AuthenticationError) {
        logout();
        router.push('/login');
        return fallbackMessage;
      }

      const formatted = formatError(error);
      return [formatted.message || fallbackMessage, formatted.action].filter(Boolean).join(' ');
    },
    [logout, router],
  );

  const openCreateFeedDialog = useCallback(() => {
    createFeedDialogRef.current?.showModal();
  }, []);

  const closeCreateFeedDialog = useCallback(() => {
    createFeedDialogRef.current?.close();
  }, []);

  const openMoveFeedDialog = useCallback((feed: Feed) => {
    setMoveFeedId(feed.id);
    setMoveFeedTitle(feed.title);
    setMoveFeedFolderId(feed.folderId === null ? '' : String(feed.folderId));
    moveFeedDialogRef.current?.showModal();
  }, []);

  const resetMoveFeedDialog = useCallback(() => {
    setMoveFeedId(null);
    setMoveFeedTitle('');
    setMoveFeedFolderId('');
  }, []);

  const refreshFeedActivity = useCallback(async (feeds: Feed[]) => {
    if (feeds.length === 0) {
      setLatestArticleDates({});
      return;
    }

    try {
      const items = await getItems({
        type: ItemFilterType.ALL,
        getRead: true,
        batchSize: 200,
      });

      const datesByFeed: Record<number, number | null> = {};
      for (const feed of feeds) {
        datesByFeed[feed.id] = null;
      }
      for (const item of items) {
        if (!(item.feedId in datesByFeed)) continue;
        const current = datesByFeed[item.feedId];
        if (current === null || item.pubDate > current) {
          datesByFeed[item.feedId] = item.pubDate;
        }
      }

      setLatestArticleDates(datesByFeed);
    } catch {
      setLatestArticleDates((current) => current);
    }
  }, []);

  const refreshPageData = useCallback(
    async (initialLoad = false) => {
      if (initialLoad) {
        setIsLoading(true);
      } else {
        setIsRefreshing(true);
      }

      try {
        const [folders, feedsResponse] = await Promise.all([getFolders(), getFeeds()]);
        setData({ folders, feeds: feedsResponse.feeds });
        setPageError(null);
        void refreshFeedActivity(feedsResponse.feeds);
      } catch (error) {
        const message = handleRequestError(error, 'Unable to load feed management data.');
        setPageError(message);
      } finally {
        if (initialLoad) {
          setIsLoading(false);
        } else {
          setIsRefreshing(false);
        }
      }
    },
    [handleRequestError, refreshFeedActivity],
  );

  useEffect(() => {
    if (!isInitializing && isAuthenticated) {
      void refreshPageData(true);
    }
  }, [isAuthenticated, isInitializing, refreshPageData]);

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key !== '+' && event.code !== 'NumpadAdd') {
        return;
      }

      if (isEditableTarget(event.target)) {
        return;
      }

      event.preventDefault();
      openCreateFeedDialog();
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [openCreateFeedDialog]);

  const runMutation = useCallback(
    async (label: string, action: () => Promise<void>) => {
      setBusyLabel(label);
      setMutationError(null);
      setStatusMessage(null);

      try {
        await action();
        await refreshPageData(false);
        return true;
      } catch (error) {
        const message = handleRequestError(error, `${label} failed.`);
        setMutationError(message);
        return false;
      } finally {
        setBusyLabel(null);
      }
    },
    [handleRequestError, refreshPageData],
  );

  const handleSubscribe = useCallback(async () => {
    const trimmedUrl = newFeedUrl.trim();
    if (!trimmedUrl) {
      setMutationError('Feed URL is required. Enter a valid RSS or Atom URL and try again.');
      return;
    }

    await runMutation('Subscribe feed', async () => {
      const folderId = newFeedFolderId ? Number(newFeedFolderId) : null;
      const result = await createFeed(trimmedUrl, folderId);

      setData((current) => ({
        ...current,
        feeds: [...current.feeds, result.feed],
      }));
      setLatestArticleDates((current) => ({
        ...current,
        [result.feed.id]: null,
      }));
      setNewFeedUrl('');
      setNewFeedFolderId('');
      closeCreateFeedDialog();
      setStatusMessage(`Subscribed to ${result.feed.title}.`);
    });
  }, [closeCreateFeedDialog, newFeedFolderId, newFeedUrl, runMutation]);

  const handleCreateFolder = useCallback(async () => {
    const trimmedName = newFolderName.trim();
    if (!trimmedName) {
      setMutationError('Folder name is required.');
      return;
    }

    await runMutation('Create folder', async () => {
      const createdFolder = await createFolder(trimmedName);
      setData((current) => ({
        ...current,
        folders: [...current.folders, createdFolder],
      }));
      setNewFolderName('');
      createFolderDialogRef.current?.close();
      setStatusMessage(`Created folder ${createdFolder.name}.`);
    });
  }, [newFolderName, runMutation]);

  const handleRenameFolder = useCallback(
    async (folderId: number) => {
      const trimmedName = editingFolderName.trim();
      if (!trimmedName) {
        setMutationError('Folder name is required.');
        return;
      }

      await runMutation('Rename folder', async () => {
        await renameFolder(folderId, trimmedName);
        setData((current) => ({
          ...current,
          folders: current.folders.map((folder) =>
            folder.id === folderId ? { ...folder, name: trimmedName } : folder,
          ),
        }));
        setEditingFolderId(null);
        setEditingFolderName('');
        setStatusMessage(`Renamed folder to ${trimmedName}.`);
      });
    },
    [editingFolderName, runMutation],
  );

  const handleDeleteFolder = useCallback(
    async (folder: Folder) => {
      const assignedFeeds = data.feeds.filter((feed) => feed.folderId === folder.id);
      const assignedFeedCount = assignedFeeds.length;
      const confirmed = window.confirm(
        `Delete "${folder.name}"? This will unsubscribe ${String(assignedFeedCount)} feed${
          assignedFeedCount === 1 ? '' : 's'
        } currently assigned to the folder.`,
      );

      if (!confirmed) {
        return;
      }

      await runMutation('Delete folder', async () => {
        if (assignedFeeds.length > 0) {
          const results = await Promise.allSettled(
            assignedFeeds.map((feed) => deleteFeed(feed.id)),
          );

          const deletedFeedIds = assignedFeeds
            .filter((_, index) => results[index].status === 'fulfilled')
            .map((feed) => feed.id);
          const failedCount = results.filter((result) => result.status === 'rejected').length;

          if (failedCount > 0) {
            setData((current) => ({
              ...current,
              feeds: current.feeds.filter((feed) => !deletedFeedIds.includes(feed.id)),
            }));
            setLatestArticleDates((current) =>
              deletedFeedIds.reduce(
                (nextEntries, feedId) => omitLatestArticleDate(nextEntries, feedId),
                current,
              ),
            );
            throw new Error(
              `Unable to unsubscribe ${String(failedCount)} feed${failedCount === 1 ? '' : 's'} from "${folder.name}". The folder was not deleted.`,
            );
          }
        }

        await deleteFolder(folder.id);
        setData((current) => ({
          folders: current.folders.filter((entry) => entry.id !== folder.id),
          feeds: current.feeds.filter((feed) => feed.folderId !== folder.id),
        }));
        setLatestArticleDates((current) =>
          assignedFeeds.reduce(
            (nextEntries, feed) => omitLatestArticleDate(nextEntries, feed.id),
            current,
          ),
        );
        setStatusMessage(`Deleted folder ${folder.name}.`);
      });
    },
    [data.feeds, runMutation],
  );

  const handleRenameFeed = useCallback(
    async (feedId: number) => {
      const trimmedTitle = editingFeedTitle.trim();
      if (!trimmedTitle) {
        setMutationError('Feed name is required.');
        return;
      }

      await runMutation('Rename feed', async () => {
        await renameFeed(feedId, trimmedTitle);
        setData((current) => ({
          ...current,
          feeds: current.feeds.map((feed) =>
            feed.id === feedId ? { ...feed, title: trimmedTitle } : feed,
          ),
        }));
        setEditingFeedId(null);
        setEditingFeedTitle('');
        setStatusMessage(`Renamed feed to ${trimmedTitle}.`);
      });
    },
    [editingFeedTitle, runMutation],
  );

  const handleMoveFeed = useCallback(
    async (feedId: number, folderIdValue: string) => {
      const folderId = folderIdValue ? Number(folderIdValue) : null;

      return runMutation('Move feed', async () => {
        await moveFeed(feedId, folderId);
        setData((current) => ({
          ...current,
          feeds: current.feeds.map((feed) => (feed.id === feedId ? { ...feed, folderId } : feed)),
        }));
        setStatusMessage('Moved feed successfully.');
      });
    },
    [runMutation],
  );

  const handleMoveFeedSubmit = useCallback(async () => {
    if (moveFeedId === null) {
      return;
    }

    const moved = await handleMoveFeed(moveFeedId, moveFeedFolderId);
    if (moved) {
      moveFeedDialogRef.current?.close();
      resetMoveFeedDialog();
    }
  }, [handleMoveFeed, moveFeedFolderId, moveFeedId, resetMoveFeedDialog]);

  const handleDeleteFeed = useCallback(
    async (feed: Feed) => {
      const confirmed = window.confirm(`Unsubscribe "${feed.title}"?`);
      if (!confirmed) {
        return;
      }

      await runMutation('Delete feed', async () => {
        await deleteFeed(feed.id);
        setData((current) => ({
          ...current,
          feeds: current.feeds.filter((entry) => entry.id !== feed.id),
        }));
        setLatestArticleDates((current) => omitLatestArticleDate(current, feed.id));
        setStatusMessage(`Unsubscribed from ${feed.title}.`);
      });
    },
    [runMutation],
  );

  return {
    isAuthenticated,
    isInitializing,
    isLoading,
    isRefreshing,
    data,
    groups,
    sortedFolders,
    busyLabel,
    pageError,
    mutationError,
    statusMessage,
    createFeedDialogRef,
    createFolderDialogRef,
    moveFeedDialogRef,
    newFeedUrl,
    setNewFeedUrl,
    newFeedFolderId,
    setNewFeedFolderId,
    newFolderName,
    setNewFolderName,
    editingFolderId,
    setEditingFolderId,
    editingFolderName,
    setEditingFolderName,
    editingFeedId,
    setEditingFeedId,
    editingFeedTitle,
    setEditingFeedTitle,
    moveFeedTitle,
    moveFeedFolderId,
    setMoveFeedFolderId,
    openCreateFeedDialog,
    closeCreateFeedDialog,
    openMoveFeedDialog,
    resetMoveFeedDialog,
    refreshPageData,
    handleSubscribe,
    handleCreateFolder,
    handleRenameFolder,
    handleDeleteFolder,
    handleRenameFeed,
    handleMoveFeedSubmit,
    handleDeleteFeed,
  };
}
