'use client';

import { useLiveState } from '@/hooks/useLiveState';

import { useCallback, useEffect, useMemo, useRef } from 'react';
import { api } from '@/lib/api';
import { isLikelyDirectFeedUrl } from '@/lib/feeds/feedDiscovery';
import type { DiscoveredFeed, RecommendedFeed } from '@/lib/api/types';
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
    discoveryDialogRef,
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
  const [newFeedUrl, setNewFeedUrlState] = useLiveState('');
  const [newFeedDialogError, setNewFeedDialogError] = useLiveState<string | null>(null);
  const [duplicateFeed, setDuplicateFeed] = useLiveState<Feed | null>(null);
  const [discoveredFeeds, setDiscoveredFeeds] = useLiveState<DiscoveredFeed[]>([]);
  const [selectedDiscoveredFeedUrl, setSelectedDiscoveredFeedUrl] = useLiveState('');
  const [newFeedFolderId, setNewFeedFolderId] = useLiveState('');
  const [recommendationSubscribeUrl, setRecommendationSubscribeUrl] = useLiveState<string | null>(
    null,
  );
  const [recommendedFeeds, setRecommendedFeeds] = useLiveState<RecommendedFeed[]>([]);
  const [recommendationReason, setRecommendationReason] = useLiveState<string | null>(null);
  const [recommendationError, setRecommendationError] = useLiveState<string | null>(null);
  const [isGeneratingRecommendations, setIsGeneratingRecommendations] = useLiveState(false);
  const [recommendationProgress, setRecommendationProgress] = useLiveState('');
  const recommendationAbortRef = useRef<AbortController | null>(null);
  const recommendationProgressTimersRef = useRef<number[]>([]);
  const [newFolderName, setNewFolderName] = useLiveState('');
  const [editingFolderId, setEditingFolderId] = useLiveState<number | null>(null);
  const [editingFolderName, setEditingFolderName] = useLiveState('');

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

  const resetFeedDiscovery = useCallback(() => {
    setDuplicateFeed(null);
    setNewFeedDialogError(null);
    setDiscoveredFeeds([]);
    setSelectedDiscoveredFeedUrl('');
  }, [setDuplicateFeed, setDiscoveredFeeds, setSelectedDiscoveredFeedUrl, setNewFeedDialogError]);

  const setNewFeedUrl = useCallback(
    (value: string) => {
      setNewFeedUrlState(value);
      resetFeedDiscovery();
    },
    [resetFeedDiscovery, setNewFeedUrlState],
  );

  const openNewFeedDialog = useCallback(() => {
    resetFeedDiscovery();
    setRecommendationSubscribeUrl(null);
    openCreateFeedDialog();
  }, [openCreateFeedDialog, resetFeedDiscovery, setRecommendationSubscribeUrl]);

  const closeNewFeedDialog = useCallback(() => {
    closeCreateFeedDialog();
    resetFeedDiscovery();
    setRecommendationSubscribeUrl(null);
  }, [closeCreateFeedDialog, resetFeedDiscovery, setRecommendationSubscribeUrl]);

  const clearRecommendationProgressTimers = useCallback(() => {
    for (const timer of recommendationProgressTimersRef.current) {
      window.clearTimeout(timer);
    }
    recommendationProgressTimersRef.current = [];
  }, []);

  const closeDiscoveryDialog = useCallback(() => {
    recommendationAbortRef.current?.abort();
    recommendationAbortRef.current = null;
    clearRecommendationProgressTimers();
    setIsGeneratingRecommendations(false);
    if (discoveryDialogRef.current?.open) {
      discoveryDialogRef.current.close();
    }
  }, [clearRecommendationProgressTimers, discoveryDialogRef, setIsGeneratingRecommendations]);

  const openDiscoveryDialog = useCallback(() => {
    setRecommendationError(null);
    setRecommendationReason(null);
    discoveryDialogRef.current?.showModal();
  }, [discoveryDialogRef, setRecommendationError, setRecommendationReason]);

  const openRecommendationSubscribeDialog = useCallback(
    (feed: RecommendedFeed) => {
      resetFeedDiscovery();
      setRecommendationSubscribeUrl(feed.url);
      setNewFeedUrlState(feed.url);
      discoveryDialogRef.current?.close();
      openCreateFeedDialog();
    },
    [
      discoveryDialogRef,
      openCreateFeedDialog,
      resetFeedDiscovery,
      setNewFeedUrlState,
      setRecommendationSubscribeUrl,
    ],
  );

  const handleGenerateRecommendations = useCallback(async () => {
    recommendationAbortRef.current?.abort();
    const controller = new AbortController();
    recommendationAbortRef.current = controller;
    clearRecommendationProgressTimers();
    setIsGeneratingRecommendations(true);
    setRecommendationError(null);
    setRecommendationReason(null);
    setRecommendedFeeds([]);
    setRecommendationProgress('Analyzing subscriptions');
    recommendationProgressTimersRef.current = [
      window.setTimeout(() => {
        setRecommendationProgress('Finding feeds');
      }, 700),
      window.setTimeout(() => {
        setRecommendationProgress('Verifying feeds');
      }, 1600),
    ];

    try {
      const result = await api.feeds.recommend(10, { signal: controller.signal });
      if (controller.signal.aborted) {
        return;
      }
      setRecommendedFeeds(result.feeds);
      setRecommendationReason(result.reason);
    } catch (error) {
      if (controller.signal.aborted) {
        return;
      }
      setRecommendationError(handleRequestError(error, 'Unable to generate recommendations.'));
    } finally {
      if (!controller.signal.aborted) {
        setIsGeneratingRecommendations(false);
        setRecommendationProgress('');
        clearRecommendationProgressTimers();
        recommendationAbortRef.current = null;
      }
    }
  }, [
    clearRecommendationProgressTimers,
    handleRequestError,
    setRecommendationError,
    setRecommendationProgress,
    setRecommendationReason,
    setIsGeneratingRecommendations,
    setRecommendedFeeds,
  ]);

  useEffect(() => {
    return () => {
      recommendationAbortRef.current?.abort();
      clearRecommendationProgressTimers();
    };
  }, [clearRecommendationProgressTimers]);

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
      openNewFeedDialog();
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [openNewFeedDialog]);

  const handleSubscribe = useCallback(async () => {
    const trimmedUrl = newFeedUrl.trim();
    if (!trimmedUrl) {
      setNewFeedDialogError('Enter a website, RSS, or Atom URL and try again.');
      return;
    }

    const subscribeToFeedUrl = async (feedUrl: string) => {
      const folderId = newFeedFolderId ? Number(newFeedFolderId) : null;
      const duplicate = data.feeds.find((feed) => feed.url === feedUrl);
      if (duplicate) {
        setDuplicateFeed(duplicate);
        throw new Error('This feed is already subscribed. Open its settings below.');
      }
      const result = await api.feeds.create(feedUrl, folderId);

      setData((current) => ({
        ...current,
        feeds: [...current.feeds, result.feed],
      }));
      if (!createFeedDialogRef.current?.open) return;
      setNewFeedUrlState('');
      setNewFeedFolderId('');
      resetFeedDiscovery();
      if (recommendationSubscribeUrl) {
        setRecommendedFeeds((current) => current.filter((feed) => feed.url !== feedUrl));
        setRecommendationSubscribeUrl(null);
        window.setTimeout(() => {
          discoveryDialogRef.current?.showModal();
        }, 0);
      }
      closeCreateFeedDialog();
      setStatusMessage(`Subscribed to ${result.feed.title}.`);
    };

    await runMutation(
      'Subscribe feed',
      async () => {
        setNewFeedDialogError(null);

        if (discoveredFeeds.length > 1) {
          if (!selectedDiscoveredFeedUrl) {
            throw new Error('Choose one discovered feed to subscribe.');
          }
          await subscribeToFeedUrl(selectedDiscoveredFeedUrl);
          return;
        }

        if (isLikelyDirectFeedUrl(trimmedUrl)) {
          await subscribeToFeedUrl(trimmedUrl);
          return;
        }

        const feeds = await api.feeds.discover(trimmedUrl);
        if (!createFeedDialogRef.current?.open) return;
        if (feeds.length === 0) {
          throw new Error('No feeds found. Edit the URL and try again.');
        }

        if (feeds.length === 1) {
          await subscribeToFeedUrl(feeds[0].url);
          return;
        }

        setDiscoveredFeeds(feeds);
        setSelectedDiscoveredFeedUrl('');
      },
      {
        onError: (message) => {
          if (createFeedDialogRef.current?.open) setNewFeedDialogError(message);
        },
        suppressGlobalError: true,
      },
    );
  }, [
    closeCreateFeedDialog,
    createFeedDialogRef,
    data.feeds,
    setDuplicateFeed,
    discoveredFeeds,
    discoveryDialogRef,
    newFeedFolderId,
    newFeedUrl,
    recommendationSubscribeUrl,
    resetFeedDiscovery,
    runMutation,
    selectedDiscoveredFeedUrl,
    setData,
    setStatusMessage,
    setDiscoveredFeeds,
    setSelectedDiscoveredFeedUrl,
    setNewFeedUrlState,
    setRecommendationSubscribeUrl,
    setRecommendedFeeds,
    setNewFeedDialogError,
    setNewFeedFolderId,
  ]);

  const handleCreateFolder = useCallback(async () => {
    const trimmedName = newFolderName.trim();
    if (!trimmedName) {
      setMutationError('Folder name is required.');
      return;
    }

    if (
      data.folders.some(
        (folder) => folder.name.trim().toLocaleLowerCase() === trimmedName.toLocaleLowerCase(),
      )
    ) {
      setMutationError('A folder with this name already exists.');
      return;
    }
    await runMutation('Create folder', async () => {
      const createdFolder = await api.folders.create(trimmedName);
      setData((current) => ({
        ...current,
        folders: [...current.folders, createdFolder],
      }));
      if (!createFolderDialogRef.current?.open) return;
      setNewFolderName('');
      createFolderDialogRef.current.close();
      setStatusMessage(`Created folder ${createdFolder.name}.`);
    });
  }, [
    createFolderDialogRef,
    data.folders,
    newFolderName,
    runMutation,
    setData,
    setMutationError,
    setStatusMessage,
    setNewFolderName,
  ]);

  const handleRenameFolder = useCallback(
    async (folderId: number) => {
      const trimmedName = editingFolderName.trim();
      if (!trimmedName) {
        setMutationError('Folder name is required.');
        return;
      }

      if (
        data.folders.some(
          (folder) =>
            folder.id !== folderId &&
            folder.name.trim().toLocaleLowerCase() === trimmedName.toLocaleLowerCase(),
        )
      ) {
        setMutationError('A folder with this name already exists.');
        return;
      }
      await runMutation('Rename folder', async () => {
        await api.folders.rename(folderId, trimmedName);
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
    [
      data.folders,
      editingFolderName,
      runMutation,
      setData,
      setMutationError,
      setStatusMessage,
      setEditingFolderId,
      setEditingFolderName,
    ],
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
            assignedFeeds.map((feed) => api.feeds.delete(feed.id)),
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
              `Unable to unsubscribe: ${assignedFeeds
                .filter((_, index) => results[index].status === 'rejected')
                .map((feed) => feed.title)
                .join(
                  ', ',
                )}. The folder was not deleted. Retry to unsubscribe the remaining feeds.`,
            );
          }
        }

        await api.folders.delete(folder.id);
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
        await api.feeds.delete(feed.id);
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
          api.feeds.rename(qualityFeedId, trimmedTitle),
          api.feeds.move(qualityFeedId, nextFolderId),
        ]);
        updatedFeed = await api.feeds.updateQuality(qualityFeedId, {
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
      if (!qualityDialogRef.current?.open) return;
      qualityDialogRef.current.close();
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
    discoveryDialogRef,
    newFeedUrl,
    setNewFeedUrl,
    recommendationSubscribeUrl,
    newFeedDialogError,
    duplicateFeed,
    discoveredFeeds,
    selectedDiscoveredFeedUrl,
    setSelectedDiscoveredFeedUrl,
    recommendedFeeds,
    recommendationReason,
    recommendationError,
    isGeneratingRecommendations,
    recommendationProgress,
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
    openCreateFeedDialog: openNewFeedDialog,
    closeCreateFeedDialog: closeNewFeedDialog,
    openDiscoveryDialog,
    closeDiscoveryDialog,
    openRecommendationSubscribeDialog,
    openQualityDialog,
    resetQualityDialog,
    refreshPageData,
    handleSubscribe,
    handleGenerateRecommendations,
    handleCreateFolder,
    handleRenameFolder,
    handleDeleteFolder,
    handleDeleteFeed,
    handleSaveFeedQuality,
  };
}
