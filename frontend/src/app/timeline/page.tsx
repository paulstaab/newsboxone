'use client';

import {
  Suspense,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type CSSProperties,
} from 'react';
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
import { useKarakeepPreferences } from '@/hooks/useKarakeepPreferences';
import { useOnlineStatus } from '@/components/ui/OfflineBanner';
import {
  checkKarakeepBookmark,
  deleteKarakeepBookmark,
  KarakeepError,
  saveKarakeepBookmark,
} from '@/lib/karakeep/client';

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
    totalUnread,
    hasCompletedPass,
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
  const hasTriggeredInitialRefreshRef = useRef(false);

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
  const { preferences } = useKarakeepPreferences();
  const online = useOnlineStatus();
  const pageGenerationRef = useRef(0);
  useEffect(
    () => () => {
      pageGenerationRef.current += 1;
    },
    [],
  );
  const [checkedKarakeepIds, setCheckedKarakeepIds] = useState<Set<number>>(() => new Set());
  const [isCheckingKarakeep, setIsCheckingKarakeep] = useState(false);
  const [karakeepRetry, setKarakeepRetry] = useState(0);
  const [savingToKarakeepIds, setSavingToKarakeepIds] = useState<Set<number>>(() => new Set());
  const [karakeepBookmarkIds, setKarakeepBookmarkIds] = useState<Map<number, string>>(
    () => new Map(),
  );
  const savingToKarakeepIdsRef = useRef<Set<number>>(new Set());
  const karakeepAvailable =
    isAuthenticated &&
    preferences.karakeepEnabled &&
    preferences.karakeepConnectionVerified &&
    Boolean(preferences.karakeepBaseUrl && preferences.karakeepApiToken);

  const articleStatusKey = JSON.stringify(activeArticles.map(({ id, url }) => ({ id, url })));
  useEffect(() => {
    let cancelled = false;
    const isCancelled = () => cancelled;
    queueMicrotask(() => {
      if (!cancelled) {
        setIsCheckingKarakeep(karakeepAvailable && online);
        setCheckedKarakeepIds(new Set());
        setKarakeepBookmarkIds(new Map());
      }
    });
    if (karakeepAvailable && online) {
      const config = {
        baseUrl: preferences.karakeepBaseUrl,
        apiToken: preferences.karakeepApiToken,
      };
      // Bound concurrency for folders with many unread articles.
      const articles = JSON.parse(articleStatusKey) as { id: number; url: string }[];
      const worker = async () => {
        while (articles.length && !cancelled) {
          const article = articles.shift();
          if (!article) return;
          try {
            const bookmarkId = await checkKarakeepBookmark(config, article.url);
            if (isCancelled()) return;
            setKarakeepBookmarkIds((current) => {
              const next = new Map(current);
              if (bookmarkId) next.set(article.id, bookmarkId);
              return next;
            });
            setCheckedKarakeepIds((current) => new Set(current).add(article.id));
          } catch {
            /* Unknown status stays disabled until Retry. */
          }
        }
      };
      void Promise.all([worker(), worker(), worker(), worker()]).finally(() => {
        if (!isCancelled()) setIsCheckingKarakeep(false);
      });
    }
    return () => {
      cancelled = true;
    };
  }, [
    articleStatusKey,
    karakeepAvailable,
    online,
    preferences.karakeepBaseUrl,
    preferences.karakeepApiToken,
    karakeepRetry,
  ]);

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

  const handleSaveToKarakeep = useCallback(
    async (article: ArticlePreview) => {
      if (
        !navigator.onLine ||
        !checkedKarakeepIds.has(article.id) ||
        savingToKarakeepIdsRef.current.has(article.id)
      )
        return;
      const generation = pageGenerationRef.current;

      const isRemoving = karakeepBookmarkIds.has(article.id);
      savingToKarakeepIdsRef.current.add(article.id);
      setSavingToKarakeepIds((current) => new Set(current).add(article.id));
      try {
        const config = {
          baseUrl: preferences.karakeepBaseUrl,
          apiToken: preferences.karakeepApiToken,
        };
        const savedBookmarkId = karakeepBookmarkIds.get(article.id);
        if (savedBookmarkId) {
          await deleteKarakeepBookmark(config, savedBookmarkId);
          if (generation !== pageGenerationRef.current) return;
          setKarakeepBookmarkIds((current) => {
            const next = new Map(current);
            next.delete(article.id);
            return next;
          });
          showToast({
            title: 'Removed from Karakeep',
            message: article.title || 'Article removed.',
            type: 'success',
            duration: 2500,
          });
          return;
        }

        const bookmarkId = await saveKarakeepBookmark(
          {
            ...config,
          },
          {
            url: article.url,
            title: article.title,
            summary: article.summary,
          },
        );
        if (generation !== pageGenerationRef.current) return;
        setKarakeepBookmarkIds((current) => new Map(current).set(article.id, bookmarkId));
        showToast({
          title: 'Saved to Karakeep',
          message: article.title || 'Article saved.',
          type: 'success',
          duration: 2500,
        });
        if (article.unread) {
          await markItemRead(article.id);
        }
      } catch (error) {
        showToast({
          title: isRemoving ? 'Karakeep removal failed' : 'Karakeep save failed',
          message:
            error instanceof KarakeepError
              ? error.message
              : `Karakeep could not ${isRemoving ? 'remove' : 'save'} this article.`,
          type: 'error',
          duration: 5000,
        });
      } finally {
        savingToKarakeepIdsRef.current.delete(article.id);
        setSavingToKarakeepIds((current) => {
          const next = new Set(current);
          next.delete(article.id);
          return next;
        });
      }
    },
    [
      checkedKarakeepIds,
      karakeepBookmarkIds,
      markItemRead,
      preferences.karakeepApiToken,
      preferences.karakeepBaseUrl,
      showToast,
    ],
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
          if (article.unread) void markItemRead(article.id);
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
    if (!isHydrated || !isAuthenticated || hasTriggeredInitialRefreshRef.current) {
      return;
    }

    hasTriggeredInitialRefreshRef.current = true;
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
  }, [isHydrated, isAuthenticated, refresh]);

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
  }, [activeFolder, disableObserverTemporarily]);

  // Show loading state while checking authentication
  if (isInitializing || !isHydrated) {
    return <FullscreenStatus message="Loading..." />;
  }

  if (!isAuthenticated) {
    return null; // Will redirect
  }

  const hasUnread = Boolean(activeFolder);

  const showEmptyState = !activeFolder;
  const activeFolderUnread =
    activeFolder?.unreadCount ?? activeArticles.filter((article) => article.unread).length;
  const remainingFolders = queue.filter((entry) => entry.status !== 'skipped').length;
  const lastUpdatedLabel = activeFolder
    ? new Date(activeFolder.lastUpdated).toLocaleTimeString([], {
        hour: '2-digit',
        minute: '2-digit',
      })
    : null;

  let emptyStateType: 'no-unread' | 'no-items' | 'offline' | 'error' | 'all-viewed' = 'no-unread';
  if (error || lastUpdateError) {
    emptyStateType = 'error';
  } else if (hasCompletedPass) {
    emptyStateType = 'all-viewed';
  } else if (totalUnread === 0) {
    emptyStateType = 'no-unread';
  } else {
    emptyStateType = 'all-viewed';
  }

  const timelineStyle = {
    '--timeline-offset': `${isDocked ? String(dockedHeight) : '0'}px`,
  } as CSSProperties;

  return (
    <div className="min-h-screen bg-[hsl(var(--color-surface))] text-[hsl(var(--color-text))]">
      <div
        className={`timeline-page${isPopoutOpen ? ' timeline-page--disabled' : ''}`}
        aria-hidden={isPopoutOpen}
        inert={isPopoutOpen}
      >
        <header className="timeline-header">
          <div className="timeline-shell timeline-header__inner">
            <div className="timeline-header__copy">
              <p className="timeline-header__eyebrow">Timeline</p>
              <h1 className="timeline-header__title">NewsBoxOne</h1>
              <p className="timeline-header__subtitle">
                {activeFolder
                  ? `${activeFolder.name} is in focus`
                  : totalUnread === 0
                    ? 'All caught up'
                    : 'Choose a folder to continue'}
              </p>
            </div>
            <div className="timeline-header__stats" aria-label="Timeline summary">
              <div>
                <span className="timeline-header__stat-value">{totalUnread}</span>
                <span className="timeline-header__stat-label">Unread</span>
              </div>
              <div>
                <span className="timeline-header__stat-value">{activeFolderUnread}</span>
                <span className="timeline-header__stat-label">In Focus</span>
              </div>
              <div>
                <span className="timeline-header__stat-value">{remainingFolders}</span>
                <span className="timeline-header__stat-label">Folders</span>
              </div>
            </div>
          </div>
        </header>

        <div className="timeline-shell">
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

          <main className="timeline-main" style={timelineStyle}>
            {showEmptyState ? (
              <EmptyState
                type={emptyStateType}
                action={
                  emptyStateType === 'error'
                    ? {
                        label: 'Retry',
                        onClick: () => {
                          void refresh({ forceSync: true }).catch(() => undefined);
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
                  onSourceOpen={(article) => {
                    if (article.unread) void markItemRead(article.id);
                  }}
                  onSaveToKarakeep={karakeepAvailable ? handleSaveToKarakeep : undefined}
                  savingToKarakeepIds={savingToKarakeepIds}
                  savedToKarakeepIds={new Set(karakeepBookmarkIds.keys())}
                  unknownKarakeepIds={
                    karakeepAvailable
                      ? new Set(
                          activeArticles
                            .filter((article) => !checkedKarakeepIds.has(article.id))
                            .map((article) => article.id),
                        )
                      : undefined
                  }
                  karakeepOffline={!online}
                  isCheckingKarakeep={isCheckingKarakeep}
                  onRetryKarakeep={() => {
                    setKarakeepRetry((value) => value + 1);
                  }}
                  registerArticle={registerArticle}
                  selectedArticleId={selectedArticleId}
                  isUpdating={isUpdating}
                  disableActions={!hasUnread}
                />
              </div>
            )}
            {lastUpdatedLabel && (
              <div className="timeline-last-updated">Last updated at {lastUpdatedLabel}</div>
            )}
          </main>
        </div>

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
