'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { createFeed, deleteFeed, moveFeed, renameFeed, updateFeedQuality } from '@/lib/api/feeds';
import { createFolder, deleteFolder, renameFolder } from '@/lib/api/folders';
import { type Feed, type Folder } from '@/types';
import {
  buildFeedManagementGroups,
  compareLabels,
  type FeedManagementGroup,
} from '@/lib/feeds/feedManagement';
import { useFeedManagementData } from '@/hooks/useFeedManagementData';
import { useFeedManagementDialogs } from '@/hooks/useFeedManagementDialogs';
import { useFeedManagementMutationRunner } from '@/hooks/useFeedManagementMutationRunner';
import { qualityPreferenceToBool, useFeedQualityForm } from '@/hooks/useFeedQualityForm';

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
  const {
    isAuthenticated,
    isInitializing,
    isLoading,
    isRefreshing,
    data,
    setData,
    pageError,
    handleRequestError,
    refreshPageData,
  } = useFeedManagementData();
  const {
    createFeedDialogRef,
    createFolderDialogRef,
    qualityDialogRef,
    openCreateFeedDialog,
    closeCreateFeedDialog,
  } = useFeedManagementDialogs();
  const {
    qualityFeedId,
    qualityFeedTitle,
    qualityFeedFolderId,
    qualityUseExtractedFulltext,
    qualityUseLlmSummary,
    setQualityFeedTitle,
    setQualityFeedFolderId,
    setQualityUseExtractedFulltext,
    setQualityUseLlmSummary,
    loadQualityForm,
    resetQualityDialog,
  } = useFeedQualityForm();

  const {
    busyLabel,
    mutationError,
    statusMessage,
    setMutationError,
    setStatusMessage,
    runMutation,
  } = useFeedManagementMutationRunner(refreshPageData, handleRequestError);
  const [newFeedUrl, setNewFeedUrl] = useState('');
  const [newFeedFolderId, setNewFeedFolderId] = useState('');
  const [newFolderName, setNewFolderName] = useState('');
  const [editingFolderId, setEditingFolderId] = useState<number | null>(null);
  const [editingFolderName, setEditingFolderName] = useState('');

  const sortedFolders = useMemo(
    () => [...data.folders].sort((left, right) => compareLabels(left.name, right.name)),
    [data.folders],
  );
  const groups = useMemo<FeedManagementGroup[]>(
    () => buildFeedManagementGroups(data.folders, data.feeds),
    [data.feeds, data.folders],
  );

  const selectedQualityFeed = useMemo(
    () => data.feeds.find((feed) => feed.id === qualityFeedId) ?? null,
    [data.feeds, qualityFeedId],
  );

  const openQualityDialog = useCallback(
    (feed: Feed) => {
      loadQualityForm(feed);
      qualityDialogRef.current?.showModal();
    },
    [loadQualityForm, qualityDialogRef],
  );

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
      setNewFeedUrl('');
      setNewFeedFolderId('');
      closeCreateFeedDialog();
      setStatusMessage(`Subscribed to ${result.feed.title}.`);
    });
  }, [
    closeCreateFeedDialog,
    newFeedFolderId,
    newFeedUrl,
    runMutation,
    setData,
    setMutationError,
    setStatusMessage,
  ]);

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
  }, [
    createFolderDialogRef,
    newFolderName,
    runMutation,
    setData,
    setMutationError,
    setStatusMessage,
  ]);

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
    [editingFolderName, runMutation, setData, setMutationError, setStatusMessage],
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
        setStatusMessage(`Deleted folder ${folder.name}.`);
      });
    },
    [data.feeds, runMutation, setData, setStatusMessage],
  );

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
        setStatusMessage(`Unsubscribed from ${feed.title}.`);
      });
    },
    [runMutation, setData, setStatusMessage],
  );

  const handleSaveFeedQuality = useCallback(async () => {
    if (qualityFeedId === null) {
      return;
    }

    const feed = data.feeds.find((entry) => entry.id === qualityFeedId);
    if (!feed) {
      setMutationError('Unable to find the selected feed.');
      return;
    }

    const trimmedTitle = qualityFeedTitle.trim();
    if (!trimmedTitle) {
      setMutationError('Feed name is required.');
      return;
    }

    await runMutation('Update feed quality', async () => {
      const nextFolderId = qualityFeedFolderId ? Number(qualityFeedFolderId) : null;

      let updatedFeed: Feed;
      try {
        await Promise.all([
          renameFeed(qualityFeedId, trimmedTitle),
          moveFeed(qualityFeedId, nextFolderId),
        ]);
        updatedFeed = await updateFeedQuality(qualityFeedId, {
          useExtractedFulltext: qualityPreferenceToBool(qualityUseExtractedFulltext),
          useLlmSummary: qualityPreferenceToBool(qualityUseLlmSummary),
        });
      } catch (error) {
        // Any step may have already been applied — refresh to reconcile UI state.
        await refreshPageData(false);
        throw error;
      }

      setData((current) => ({
        ...current,
        feeds: current.feeds.map((entry) => (entry.id === updatedFeed.id ? updatedFeed : entry)),
      }));
      qualityDialogRef.current?.close();
      resetQualityDialog();
      setStatusMessage(`Updated settings for ${trimmedTitle}.`);
    });
  }, [
    data.feeds,
    qualityFeedId,
    qualityFeedFolderId,
    qualityFeedTitle,
    qualityUseExtractedFulltext,
    qualityUseLlmSummary,
    qualityDialogRef,
    refreshPageData,
    resetQualityDialog,
    runMutation,
    setData,
    setMutationError,
    setStatusMessage,
  ]);

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
    qualityDialogRef,
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
    qualityFeedTitle,
    qualityFeedFolderId,
    setQualityFeedFolderId,
    setQualityFeedTitle,
    qualityUseExtractedFulltext,
    setQualityUseExtractedFulltext,
    qualityUseLlmSummary,
    setQualityUseLlmSummary,
    selectedQualityFeed,
    openCreateFeedDialog,
    closeCreateFeedDialog,
    openQualityDialog,
    resetQualityDialog,
    refreshPageData,
    handleSubscribe,
    handleCreateFolder,
    handleRenameFolder,
    handleDeleteFolder,
    handleDeleteFeed,
    handleSaveFeedQuality,
  };
}
