'use client';

import { Suspense, useCallback, useEffect, useMemo, useRef, type CSSProperties } from 'react';
import { useAuthGuard } from '@/hooks/useAuthGuard';
import { useTimeline } from '@/hooks/useTimeline';
import { useFolderQueueDocking } from '@/hooks/useFolderQueueDocking';
import { useArticlePopout } from '@/hooks/useArticlePopout';
import { FolderQueuePills } from '@/components/timeline/FolderQueuePills';
import { TimelineList } from '@/components/timeline/TimelineList';
import { EmptyState } from '@/components/timeline/EmptyState';
import { PinnedActionCluster } from '@/components/timeline/PinnedActionCluster';
import { ArticlePopout } from '@/components/timeline/ArticlePopout';
import { RequestStateToast, useToast } from '@/components/ui/RequestStateToast';
import { handleTimelineKeyDown } from '@/lib/timeline/keyboard-handler';
import type { ArticlePreview } from '@/types';
import {
  markTimelineCacheLoadStart,
  markTimelineCacheReady,
  markTimelineUpdateStart,
  markTimelineUpdateComplete,
} from '@/lib/metrics/metricsClient';
import { FullscreenStatus } from '@/components/ui/FullscreenStatus';

/**
 * Timeline page content component
 * Extracted to wrap useSearchParams in Suspense
 */
function TimelineContent() {
  const { isAuthenticated, isInitializing } = useAuthGuard();

  // Mark cache load start before hook initialization
  useEffect(() => {
    markTimelineCacheLoadStart();
  }, []);

  const { isDocked, dockedHeight, queueRef, sentinelRef } = useFolderQueueDocking();

  const {
    queue,
    activeFolder,
    activeArticles,
    progress,
    totalUnread,
    isHydrated,
    isUpdating,
    isRefreshing,
    error,
    refresh,
    setActiveFolder,
    markFolderRead,
    markItemRead,
    skipFolder,
    restart,
    lastUpdateError,
    selectedArticleId,
    setSelectedArticleId,
    setSelectedArticleElement,
    registerArticle,
    disableObserverTemporarily,
  } = useTimeline({
    topOffset: isDocked ? dockedHeight : 0,
  });

  const timelineRef = useRef<HTMLDivElement>(null);
  const scrollToTopOnNextFolderRef = useRef(false);

  const {
    isOpen: isPopoutOpen,
    articleKey: popoutArticleKey,
    dialogRef,
    closeButtonRef,
    openPopout,
    closePopout,
  } = useArticlePopout();
  const unreadIdSet = useMemo(
    () => new Set(activeArticles.filter((article) => article.unread).map((article) => article.id)),
    [activeArticles],
  );

  const popoutArticle = useMemo(() => {
    if (!isPopoutOpen || !popoutArticleKey) return null;
    return (
      activeArticles.find(
        (article) =>
          article.id === popoutArticleKey.id && article.feedId === popoutArticleKey.feedId,
      ) ?? null
    );
  }, [activeArticles, isPopoutOpen, popoutArticleKey]);

  const { toasts, showToast, dismissToast } = useToast();

  const handleOpenArticle = useCallback(
    (article: ArticlePreview, opener: HTMLElement) => {
      setSelectedArticleId(article.id);
      setSelectedArticleElement(opener);
      openPopout({ id: article.id, feedId: article.feedId }, opener);
      if (article.unread) {
        void markItemRead(article.id);
      }
    },
    [markItemRead, openPopout, setSelectedArticleElement, setSelectedArticleId],
  );

  useEffect(() => {
    if (!isPopoutOpen) return;
    if (!popoutArticle) {
      closePopout();
    }
  }, [closePopout, isPopoutOpen, popoutArticle]);

  useEffect(() => {
    if (isPopoutOpen) return;

    const handler = (event: KeyboardEvent) => {
      handleTimelineKeyDown(event, {
        timelineRef,
        selectedId: selectedArticleId,
        onSelect: setSelectedArticleId,
        onActivate: (id, opener) => {
          const article = activeArticles.find((item) => item.id === id);
          if (!article) return;
          setSelectedArticleId(id);
          if (opener) {
            setSelectedArticleElement(opener);
          }
          openPopout({ id: article.id, feedId: article.feedId }, opener ?? undefined);
        },
        onMarkRead: (id) => {
          if (!unreadIdSet.has(id)) return;
          void markItemRead(id);
        },
      });
    };

    window.addEventListener('keydown', handler, { passive: false });
    return () => {
      window.removeEventListener('keydown', handler);
    };
  }, [
    activeArticles,
    isPopoutOpen,
    markItemRead,
    openPopout,
    selectedArticleId,
    setSelectedArticleElement,
    setSelectedArticleId,
    unreadIdSet,
  ]);

  // Mark cache ready after hydration
  useEffect(() => {
    if (isHydrated) {
      markTimelineCacheReady();
    }
  }, [isHydrated]);

  // Automatic update on mount (US5 requirement)
  useEffect(() => {
    if (isHydrated && isAuthenticated) {
      markTimelineUpdateStart();
      // Trigger refresh to get latest articles and merge with cache
      void refresh()
        .then(() => {
          markTimelineUpdateComplete();
        })
        .catch(() => {
          // Error already logged and retried in useTimeline
          // Just mark the update as complete (with error)
          markTimelineUpdateComplete();
        });
    }
    // Only run on mount when hydrated and authenticated
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isHydrated, isAuthenticated]);

  // Show toast when update fails after all retries
  useEffect(() => {
    if (lastUpdateError) {
      showToast({
        title: 'Update Failed',
        message: `Failed to update timeline: ${lastUpdateError}`,
        type: 'error',
        duration: 5000,
      });
    }
  }, [lastUpdateError, showToast]);

  useEffect(() => {
    if (!scrollToTopOnNextFolderRef.current) return;
    scrollToTopOnNextFolderRef.current = false;
    // Disable the IntersectionObserver before scrolling to prevent articles from being marked read
    disableObserverTemporarily();
    window.scrollTo({ top: 0, left: 0 });
    // disableObserverTemporarily is stable (useCallback with empty deps), so it's safe to omit
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeFolder]);

  // Show loading state while checking authentication
  if (isInitializing || !isHydrated) {
    return <FullscreenStatus message="Loading..." />;
  }

  if (!isAuthenticated) {
    return null; // Will redirect
  }

  const hasUnread = !progress.allViewed;

  const showEmptyState = !activeFolder;
  const lastUpdatedLabel = activeFolder
    ? new Date(activeFolder.lastUpdated).toLocaleTimeString([], {
        hour: '2-digit',
        minute: '2-digit',
      })
    : null;

  let emptyStateType: 'no-unread' | 'no-items' | 'offline' | 'error' | 'all-viewed' = 'no-unread';
  if (error) {
    emptyStateType = 'error';
  } else if (totalUnread === 0) {
    emptyStateType = 'no-unread';
  } else {
    emptyStateType = 'all-viewed';
  }

  const timelineStyle = {
    '--timeline-offset': `${isDocked ? String(dockedHeight) : '0'}px`,
  } as CSSProperties;

  return (
    <div className="min-h-screen bg-gray-50">
      <div
        className={`timeline-page${isPopoutOpen ? ' timeline-page--disabled' : ''}`}
        aria-hidden={isPopoutOpen}
      >
        {/* Header */}
        <header className="bg-white">
          <div className="max-w-4xl mx-auto px-4 py-4">
            <div className="flex items-center justify-between">
              <h1 className="text-2xl font-bold text-gray-900">NewsBoxOne</h1>
            </div>
          </div>
        </header>

        <div className="max-w-4xl mx-auto px-4">
          {/* Folder queue */}
          <div ref={sentinelRef} aria-hidden="true" className="folder-queue-sentinel" />
          <div
            ref={queueRef}
            className={`folder-queue-dock${isDocked ? ' folder-queue-dock--sticky' : ''}`}
          >
            <FolderQueuePills
              queue={queue}
              activeFolderId={activeFolder ? activeFolder.id : null}
              onSelect={setActiveFolder}
              isLoading={isUpdating}
            />
            <span className="sr-only" data-testid="active-folder-name">
              {activeFolder?.name ?? 'All caught up'}
            </span>
          </div>

          {/* Main content */}
          <main className="py-6" style={timelineStyle}>
            {showEmptyState ? (
              <EmptyState
                type={emptyStateType}
                action={
                  emptyStateType === 'error'
                    ? {
                        label: 'Retry',
                        onClick: () => {
                          void refresh({ forceSync: true });
                        },
                      }
                    : emptyStateType === 'all-viewed'
                      ? {
                          label: 'Restart',
                          onClick: () => {
                            void restart();
                          },
                        }
                      : undefined
                }
              />
            ) : (
              <div
                ref={timelineRef}
                role="region"
                aria-label="Timeline"
                tabIndex={isPopoutOpen ? -1 : 0}
              >
                <TimelineList
                  items={activeArticles}
                  isLoading={isUpdating && activeArticles.length === 0}
                  emptyMessage={`No unread articles left in ${activeFolder.name}.`}
                  onOpenArticle={handleOpenArticle}
                  registerArticle={registerArticle}
                  selectedArticleId={selectedArticleId}
                  isUpdating={isUpdating}
                  disableActions={!hasUnread}
                />
              </div>
            )}
            {lastUpdatedLabel && (
              <div className="mt-14 text-center text-sm text-gray-500">
                Last updated at {lastUpdatedLabel}
              </div>
            )}
          </main>
        </div>

        <PinnedActionCluster
          onSync={() => {
            markTimelineUpdateStart();
            void refresh({ forceSync: true })
              .then(() => {
                markTimelineUpdateComplete();
              })
              .catch(() => {
                markTimelineUpdateComplete();
              });
          }}
          onSkip={async () => {
            if (!activeFolder) return;
            await skipFolder(activeFolder.id);
          }}
          onMarkAllRead={async () => {
            if (!activeFolder) return;
            scrollToTopOnNextFolderRef.current = true;
            await markFolderRead(activeFolder.id);
          }}
          disableSkip={!hasUnread}
          disableMarkAllRead={!hasUnread}
          isSyncing={isRefreshing}
        />

        {/* Toast notifications for errors */}
        {toasts.map((toast) => (
          <RequestStateToast key={toast.id} message={toast} onDismiss={dismissToast} />
        ))}
      </div>

      <ArticlePopout
        isOpen={isPopoutOpen}
        article={popoutArticle}
        onClose={closePopout}
        dialogRef={dialogRef}
        closeButtonRef={closeButtonRef}
      />
    </div>
  );
}

/**
 * Timeline page wrapper with suspense fallback.
 */
export default function TimelinePage() {
  return (
    <Suspense fallback={<FullscreenStatus message="Loading timeline..." />}>
      <TimelineContent />
    </Suspense>
  );
}
