'use client';

import {
  faCircleCheck,
  faCircleExclamation,
  faFolder,
  faFolderPlus,
  faPen,
  faPlus,
  faRotate,
  faRss,
  faSliders,
  faTrash,
} from '@fortawesome/free-solid-svg-icons';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { Fragment, Suspense, type ButtonHTMLAttributes } from 'react';
import { formatExactLocalDateTime, formatRelativeDateTime } from '@/lib/feeds/feedManagement';
import { TimelineActionButton } from '@/components/timeline/TimelineActionButton';
import { FullscreenStatus } from '@/components/ui/FullscreenStatus';
import { useFeedManagementPage } from '@/hooks/useFeedManagementPage';

interface FeedActionButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  label: string;
  variant?: 'default' | 'accent' | 'danger';
  size?: 'sm' | 'lg';
}

/**
 * Shared icon-only action button used throughout the page.
 */
function FeedActionButton({
  children,
  className = '',
  label,
  size = 'sm',
  variant = 'default',
  ...buttonProps
}: FeedActionButtonProps) {
  const palette =
    variant === 'accent'
      ? 'border-transparent bg-[hsl(var(--color-accent-strong))] text-slate-950 hover:brightness-110 focus:ring-[hsl(var(--color-accent-strong))]'
      : variant === 'danger'
        ? 'border-red-400/30 bg-red-500/10 text-red-300 hover:bg-red-500/15 focus:ring-red-300/60'
        : 'border-[hsl(var(--color-border))] bg-[hsl(var(--color-surface-muted))] text-[hsl(var(--color-text))] hover:bg-[hsl(var(--color-surface))] focus:ring-[hsl(var(--color-accent-strong))]';
  const sizing = size === 'lg' ? 'h-11 w-11' : 'h-9 w-9';

  return (
    <button
      {...buttonProps}
      aria-label={label}
      title={label}
      className={`inline-flex ${sizing} items-center justify-center rounded-md border transition focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-offset-[hsl(var(--color-surface-muted))] disabled:cursor-not-allowed disabled:opacity-60 ${palette} ${className}`.trim()}
      type={buttonProps.type ?? 'button'}
    >
      {children}
    </button>
  );
}

function formatAutomaticQualityLabel(value: boolean | undefined) {
  if (value === undefined) {
    return 'Automatic';
  }
  return `Automatic (${value ? 'Enabled' : 'Disabled'})`;
}

/**
 * Feed management route for subscriptions and folders.
 */
function FeedManagementContent() {
  const {
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
    setQualityFeedTitle,
    qualityFeedFolderId,
    setQualityFeedFolderId,
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
  } = useFeedManagementPage();

  if (isInitializing || isLoading) {
    return (
      <FullscreenStatus
        message="Loading feed management..."
        className="bg-[hsl(var(--color-surface))]"
      />
    );
  }

  if (!isAuthenticated) {
    return null;
  }

  const feedCount = data.feeds.length;
  const folderCount = sortedFolders.length;
  const errorCount = data.feeds.filter((feed) => Boolean(feed.lastUpdateError)).length;

  return (
    <div className="min-h-screen bg-[hsl(var(--color-surface))] text-[hsl(var(--color-text))]">
      <header className="timeline-header">
        <div className="timeline-shell timeline-header__inner">
          <div className="timeline-header__copy">
            <p className="timeline-header__eyebrow">Feed Management</p>
            <h1 className="timeline-header__title">NewsBoxOne</h1>
            <p className="timeline-header__subtitle">Manage feeds, folders, and extraction rules</p>
          </div>
          <div className="timeline-header__stats" aria-label="Feed management summary">
            <div>
              <span className="timeline-header__stat-value">{feedCount}</span>
              <span className="timeline-header__stat-label">Feeds</span>
            </div>
            <div>
              <span className="timeline-header__stat-value">{folderCount}</span>
              <span className="timeline-header__stat-label">Folders</span>
            </div>
            <div>
              <span className="timeline-header__stat-value">{errorCount}</span>
              <span className="timeline-header__stat-label">Issues</span>
            </div>
          </div>
        </div>
      </header>

      <div className="feed-management-shell">
        <div className="feed-management-content">
          {pageError ? (
            <section className="feed-management-alert feed-management-alert--error">
              <p>{pageError}</p>
            </section>
          ) : null}

          {mutationError ? (
            <section className="feed-management-alert feed-management-alert--error">
              <p>{mutationError}</p>
            </section>
          ) : null}

          {statusMessage ? (
            <section className="feed-management-alert feed-management-alert--success">
              <p>{statusMessage}</p>
            </section>
          ) : null}

          {groups.length === 0 ? (
            <section className="feed-management-empty">
              <h2>No feeds yet</h2>
              <p>Add your first feed above to start building your reading queue.</p>
            </section>
          ) : (
            <section className="feed-management-table-card">
              <div className="overflow-x-auto">
                <table aria-label="Feed management table" className="feed-management-table">
                  <colgroup>
                    <col className="w-[52%]" />
                    <col className="w-[18%]" />
                    <col className="w-[10%]" />
                    <col className="w-[20%]" />
                  </colgroup>
                  <thead>
                    <tr>
                      <th>Feed Name</th>
                      <th>Last Article</th>
                      <th className="text-center">Status</th>
                      <th>Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {groups.map((group) => {
                      const isEditingFolder = editingFolderId === group.id && group.id !== null;

                      return (
                        <Fragment
                          key={
                            group.isUncategorized
                              ? 'group-uncategorized'
                              : `group-${String(group.id)}`
                          }
                        >
                          <tr className="feed-management-group-row border-t-2 border-[hsl(var(--color-accent)/0.35)] bg-[linear-gradient(90deg,hsl(var(--color-accent)/0.12),hsl(var(--color-surface)/0.48))]">
                            {isEditingFolder ? (
                              <td colSpan={4}>
                                <form
                                  onSubmit={(event) => {
                                    event.preventDefault();
                                    if (group.id !== null) {
                                      void handleRenameFolder(group.id);
                                    }
                                  }}
                                  className="flex flex-wrap items-center gap-3"
                                >
                                  <input
                                    type="text"
                                    value={editingFolderName}
                                    onChange={(event) => {
                                      setEditingFolderName(event.target.value);
                                    }}
                                    className="feed-management-input min-w-[240px]"
                                    aria-label="Folder name"
                                  />
                                  <button type="submit" className="feed-management-primary-button">
                                    Save
                                  </button>
                                  <button
                                    type="button"
                                    className="feed-management-secondary-button"
                                    onClick={() => {
                                      setEditingFolderId(null);
                                      setEditingFolderName('');
                                    }}
                                  >
                                    Cancel
                                  </button>
                                </form>
                              </td>
                            ) : (
                              <>
                                <td colSpan={3}>
                                  <h2 className="feed-management-folder-title inline-flex max-w-full items-center gap-2">
                                    <span
                                      className="feed-management-folder-icon inline-flex h-8 w-8 flex-none items-center justify-center rounded-md bg-[hsl(var(--color-accent)/0.16)] text-[hsl(var(--color-accent-strong))]"
                                      aria-hidden
                                    >
                                      <FontAwesomeIcon icon={faFolder} className="h-4 w-4" />
                                    </span>
                                    <span>{group.name}</span>
                                    <span className="feed-management-folder-count inline-flex flex-none items-center rounded-md border border-[hsl(var(--color-border))] px-2 py-1 text-xs font-bold uppercase leading-none text-[hsl(var(--color-text-muted))]">
                                      {group.feeds.length} feed
                                      {group.feeds.length === 1 ? '' : 's'}
                                    </span>
                                  </h2>
                                </td>
                                <td>
                                  {group.id !== null ? (
                                    <div className="feed-management-row-actions">
                                      <FeedActionButton
                                        label={`Rename folder ${group.name}`}
                                        onClick={() => {
                                          setEditingFolderId(group.id);
                                          setEditingFolderName(group.name);
                                        }}
                                      >
                                        <FontAwesomeIcon
                                          icon={faPen}
                                          className="h-4.5 w-4.5"
                                          aria-hidden="true"
                                        />
                                      </FeedActionButton>
                                      <FeedActionButton
                                        label={`Delete folder ${group.name}`}
                                        onClick={() => {
                                          const folder = data.folders.find(
                                            (entry) => entry.id === group.id,
                                          );
                                          if (folder) {
                                            void handleDeleteFolder(folder);
                                          }
                                        }}
                                        variant="danger"
                                      >
                                        <FontAwesomeIcon
                                          icon={faTrash}
                                          className="h-4.5 w-4.5"
                                          aria-hidden="true"
                                        />
                                      </FeedActionButton>
                                    </div>
                                  ) : null}
                                </td>
                              </>
                            )}
                          </tr>

                          {group.feeds.map(({ feed, lastArticleDate }) => {
                            return (
                              <tr
                                key={`feed-${String(feed.id)}`}
                                className="feed-management-feed-row shadow-[inset_4px_0_0_hsl(var(--color-border))]"
                              >
                                <td>
                                  <div className="feed-management-feed-cell">
                                    <h3
                                      className="feed-management-feed-title flex items-center gap-2"
                                      title={feed.url}
                                    >
                                      <span
                                        className="feed-management-feed-icon inline-flex h-7 w-7 flex-none items-center justify-center rounded-md border border-[hsl(var(--color-border))] bg-[hsl(var(--color-surface))] text-[hsl(var(--color-text-muted))]"
                                        aria-hidden
                                      >
                                        <FontAwesomeIcon icon={faRss} className="h-3.5 w-3.5" />
                                      </span>
                                      <span className="min-w-0 overflow-hidden text-ellipsis">
                                        {feed.title}
                                      </span>
                                    </h3>
                                  </div>
                                </td>
                                <td>
                                  <p
                                    className="feed-management-date"
                                    title={formatExactLocalDateTime(lastArticleDate)}
                                  >
                                    {formatRelativeDateTime(lastArticleDate)}
                                  </p>
                                </td>
                                <td className="text-center">
                                  <div className="flex items-center justify-center">
                                    {feed.lastUpdateError ? (
                                      <span
                                        aria-label={`Update error: ${feed.lastUpdateError}`}
                                        className="feed-management-status feed-management-status--warning"
                                        title={feed.lastUpdateError}
                                      >
                                        <FontAwesomeIcon
                                          icon={faCircleExclamation}
                                          className="h-5 w-5"
                                          aria-hidden="true"
                                        />
                                      </span>
                                    ) : (
                                      <span
                                        aria-label="Feed healthy"
                                        className="feed-management-status feed-management-status--ok"
                                      >
                                        <FontAwesomeIcon
                                          icon={faCircleCheck}
                                          className="h-5 w-5"
                                          aria-hidden="true"
                                        />
                                      </span>
                                    )}
                                  </div>
                                </td>

                                <td>
                                  <div className="feed-management-row-actions">
                                    <FeedActionButton
                                      label={`Adjust feed quality for ${feed.title}`}
                                      onClick={() => {
                                        openQualityDialog(feed);
                                      }}
                                    >
                                      <FontAwesomeIcon
                                        icon={faSliders}
                                        className="h-4.5 w-4.5"
                                        aria-hidden="true"
                                      />
                                    </FeedActionButton>
                                    <FeedActionButton
                                      label={`Delete feed ${feed.title}`}
                                      variant="danger"
                                      onClick={() => {
                                        void handleDeleteFeed(feed);
                                      }}
                                    >
                                      <FontAwesomeIcon
                                        icon={faTrash}
                                        className="h-4.5 w-4.5"
                                        aria-hidden="true"
                                      />
                                    </FeedActionButton>
                                  </div>
                                </td>
                              </tr>
                            );
                          })}
                        </Fragment>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </section>
          )}

          <div className="feed-management-actions">
            <TimelineActionButton
              icon={<FontAwesomeIcon icon={faRotate} className="h-5 w-5" aria-hidden="true" />}
              label={isRefreshing ? 'Updating feeds' : 'Update feeds'}
              tooltip="Update feeds"
              disabled={busyLabel !== null}
              isLoading={isRefreshing}
              onClick={() => {
                void refreshPageData(false);
              }}
            />
            <TimelineActionButton
              icon={<FontAwesomeIcon icon={faFolderPlus} className="h-5 w-5" aria-hidden="true" />}
              label="Add folder"
              tooltip="Add folder"
              disabled={busyLabel !== null}
              onClick={() => {
                createFolderDialogRef.current?.showModal();
              }}
            />
            <TimelineActionButton
              icon={<FontAwesomeIcon icon={faPlus} className="h-5 w-5" aria-hidden="true" />}
              label="Subscribe to feed"
              tooltip="Subscribe to feed"
              disabled={busyLabel !== null}
              onClick={openCreateFeedDialog}
            />
          </div>

          <dialog
            ref={createFeedDialogRef}
            className="feed-management-dialog feed-management-dialog--feed"
          >
            <form
              method="dialog"
              onSubmit={(event) => {
                event.preventDefault();
                void handleSubscribe();
              }}
              className="space-y-6 p-6 sm:p-7"
            >
              <div className="space-y-2">
                <p className="text-[0.72rem] font-semibold uppercase tracking-[0.22em] text-[hsl(var(--color-text-muted))]">
                  New Subscription
                </p>
                <h2 className="text-2xl font-semibold tracking-tight sm:text-3xl">
                  Add a feed to your reading queue
                </h2>
                <p className="max-w-xl text-sm leading-7 text-[hsl(var(--color-text-muted))]">
                  Paste an RSS or Atom URL, then choose whether it should land in a folder or stay
                  uncategorized.
                </p>
              </div>

              <div className="grid gap-4 sm:grid-cols-[minmax(0,1.7fr)_minmax(220px,1fr)]">
                <label className="flex flex-col gap-2 text-sm font-medium text-[hsl(var(--color-text))]">
                  <span className="text-[0.7rem] uppercase tracking-[0.18em] text-[hsl(var(--color-text-muted))]">
                    Feed URL
                  </span>
                  <input
                    type="url"
                    value={newFeedUrl}
                    onChange={(event) => {
                      setNewFeedUrl(event.target.value);
                    }}
                    placeholder="https://example.com/feed.xml"
                    className="rounded-2xl border border-white/10 bg-black/10 px-4 py-3 text-sm outline-none transition placeholder:text-[hsl(var(--color-text-muted))] focus:border-[hsl(var(--color-accent-strong))] focus:ring-2 focus:ring-[hsl(var(--color-accent-strong))]"
                    aria-label="Feed URL"
                  />
                </label>

                <label className="flex flex-col gap-2 text-sm font-medium text-[hsl(var(--color-text))]">
                  <span className="text-[0.7rem] uppercase tracking-[0.18em] text-[hsl(var(--color-text-muted))]">
                    Destination folder
                  </span>
                  <select
                    value={newFeedFolderId}
                    onChange={(event) => {
                      setNewFeedFolderId(event.target.value);
                    }}
                    className="rounded-2xl border border-white/10 bg-black/10 px-4 py-3 text-sm outline-none transition focus:border-[hsl(var(--color-accent-strong))] focus:ring-2 focus:ring-[hsl(var(--color-accent-strong))]"
                    aria-label="Destination folder"
                  >
                    <option value="">Uncategorized</option>
                    {sortedFolders.map((folder) => (
                      <option key={folder.id} value={String(folder.id)}>
                        {folder.name}
                      </option>
                    ))}
                  </select>
                </label>
              </div>

              <div className="flex justify-end gap-3">
                <button
                  type="button"
                  className="rounded-full border border-white/10 bg-white/6 px-5 py-3 text-sm font-medium text-[hsl(var(--color-text))]"
                  onClick={closeCreateFeedDialog}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={busyLabel !== null}
                  className="rounded-full bg-[hsl(var(--color-accent-strong))] px-5 py-3 text-sm font-semibold text-slate-950 transition hover:brightness-110 focus:outline-none focus:ring-2 focus:ring-[hsl(var(--color-accent-strong))] focus:ring-offset-2 focus:ring-offset-[hsl(var(--color-surface-muted))] disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {busyLabel === 'Subscribe feed' ? 'Subscribing...' : 'Subscribe'}
                </button>
              </div>
            </form>
          </dialog>

          <dialog
            ref={qualityDialogRef}
            className="feed-management-dialog"
            onClose={resetQualityDialog}
          >
            <form
              onSubmit={(event) => {
                event.preventDefault();
                void handleSaveFeedQuality();
              }}
              className="space-y-6 p-6 sm:p-7"
            >
              <div className="space-y-2">
                <p className="text-[0.72rem] font-semibold uppercase tracking-[0.22em] text-[hsl(var(--color-text-muted))]">
                  Feed Settings
                </p>
                <h2 className="text-2xl font-semibold tracking-tight sm:text-3xl">
                  {selectedQualityFeed
                    ? qualityFeedTitle || selectedQualityFeed.title
                    : qualityFeedTitle || 'Feed settings'}
                </h2>
              </div>

              <div className="feed-management-settings">
                <div className="feed-management-settings-grid">
                  <div className="flex items-center bg-[hsl(var(--color-surface-muted))]/92 px-5 py-4 text-sm font-semibold text-[hsl(var(--color-text))]">
                    Title
                  </div>
                  <div className="bg-[hsl(var(--color-surface))]/92 px-5 py-4">
                    <input
                      type="text"
                      value={qualityFeedTitle}
                      onChange={(event) => {
                        setQualityFeedTitle(event.target.value);
                      }}
                      className="w-full rounded-2xl border border-white/10 bg-black/10 px-4 py-3 text-sm text-[hsl(var(--color-text))] outline-none transition focus:border-[hsl(var(--color-accent-strong))] focus:ring-2 focus:ring-[hsl(var(--color-accent-strong))]"
                      aria-label="Feed title setting"
                    />
                  </div>

                  <div className="flex items-center bg-[hsl(var(--color-surface-muted))]/92 px-5 py-4 text-sm font-semibold text-[hsl(var(--color-text))]">
                    Folder
                  </div>
                  <div className="bg-[hsl(var(--color-surface))]/92 px-5 py-4">
                    <select
                      value={qualityFeedFolderId}
                      onChange={(event) => {
                        setQualityFeedFolderId(event.target.value);
                      }}
                      className="w-full rounded-2xl border border-white/10 bg-black/10 px-4 py-3 text-sm outline-none transition focus:border-[hsl(var(--color-accent-strong))] focus:ring-2 focus:ring-[hsl(var(--color-accent-strong))]"
                      aria-label="Folder setting"
                    >
                      <option value="">Uncategorized</option>
                      {sortedFolders.map((folder) => (
                        <option key={folder.id} value={String(folder.id)}>
                          {folder.name}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div className="flex items-center bg-[hsl(var(--color-surface-muted))]/92 px-5 py-4 text-sm font-semibold text-[hsl(var(--color-text))]">
                    URL
                  </div>
                  <div
                    className="break-all bg-[hsl(var(--color-surface))]/92 px-5 py-4 text-sm text-[hsl(var(--color-text))]"
                    title={selectedQualityFeed?.url ?? undefined}
                  >
                    {selectedQualityFeed?.url ? (
                      <a
                        href={selectedQualityFeed.url}
                        target="_blank"
                        rel="noreferrer"
                        className="text-[hsl(var(--color-accent-strong))] underline decoration-white/20 underline-offset-4 transition hover:decoration-current focus:outline-none focus:ring-2 focus:ring-[hsl(var(--color-accent-strong))] focus:ring-offset-2 focus:ring-offset-[hsl(var(--color-surface))]"
                      >
                        {selectedQualityFeed.url}
                      </a>
                    ) : (
                      'Not available'
                    )}
                  </div>

                  <div className="flex items-center bg-[hsl(var(--color-surface-muted))]/92 px-5 py-4 text-sm font-semibold text-[hsl(var(--color-text))]">
                    Extract Full Text
                  </div>
                  <div className="bg-[hsl(var(--color-surface))]/92 px-5 py-4">
                    <select
                      value={qualityUseExtractedFulltext}
                      onChange={(event) => {
                        setQualityUseExtractedFulltext(
                          event.target.value as typeof qualityUseExtractedFulltext,
                        );
                      }}
                      className="w-full rounded-2xl border border-white/10 bg-black/10 px-4 py-3 text-sm outline-none transition focus:border-[hsl(var(--color-accent-strong))] focus:ring-2 focus:ring-[hsl(var(--color-accent-strong))]"
                      aria-label="Extract full text setting"
                    >
                      <option value="automatic">
                        {formatAutomaticQualityLabel(selectedQualityFeed?.useExtractedFulltext)}
                      </option>
                      <option value="enabled">Enabled</option>
                      <option value="disabled">Disabled</option>
                    </select>
                  </div>

                  <div className="flex items-center bg-[hsl(var(--color-surface-muted))]/92 px-5 py-4 text-sm font-semibold text-[hsl(var(--color-text))]">
                    Create LLM Summaries
                  </div>
                  <div className="bg-[hsl(var(--color-surface))]/92 px-5 py-4">
                    <select
                      value={qualityUseLlmSummary}
                      onChange={(event) => {
                        setQualityUseLlmSummary(event.target.value as typeof qualityUseLlmSummary);
                      }}
                      className="w-full rounded-2xl border border-white/10 bg-black/10 px-4 py-3 text-sm outline-none transition focus:border-[hsl(var(--color-accent-strong))] focus:ring-2 focus:ring-[hsl(var(--color-accent-strong))]"
                      aria-label="Create LLM summaries setting"
                    >
                      <option value="automatic">
                        {formatAutomaticQualityLabel(selectedQualityFeed?.useLlmSummary)}
                      </option>
                      <option value="enabled">Enabled</option>
                      <option value="disabled">Disabled</option>
                    </select>
                  </div>

                  <div className="flex items-center bg-[hsl(var(--color-surface-muted))]/92 px-5 py-4 text-sm font-semibold text-[hsl(var(--color-text))]">
                    Last Article
                  </div>
                  <div
                    className="bg-[hsl(var(--color-surface))]/92 px-5 py-4 text-sm text-[hsl(var(--color-text))]"
                    title={formatExactLocalDateTime(selectedQualityFeed?.lastArticleDate ?? null)}
                  >
                    {formatExactLocalDateTime(selectedQualityFeed?.lastArticleDate ?? null)}
                  </div>

                  <div className="flex items-center bg-[hsl(var(--color-surface-muted))]/92 px-5 py-4 text-sm font-semibold text-[hsl(var(--color-text))]">
                    Next Scheduled Update
                  </div>
                  <div
                    className="bg-[hsl(var(--color-surface))]/92 px-5 py-4 text-sm text-[hsl(var(--color-text))]"
                    title={formatExactLocalDateTime(selectedQualityFeed?.nextUpdateTime ?? null)}
                  >
                    {formatExactLocalDateTime(selectedQualityFeed?.nextUpdateTime ?? null)}
                  </div>

                  <div className="flex items-center bg-[hsl(var(--color-surface-muted))]/92 px-5 py-4 text-sm font-semibold text-[hsl(var(--color-text))]">
                    Last Quality Check
                  </div>
                  <div
                    className="bg-[hsl(var(--color-surface))]/92 px-5 py-4 text-sm text-[hsl(var(--color-text))]"
                    title={formatExactLocalDateTime(selectedQualityFeed?.lastQualityCheck ?? null)}
                  >
                    {formatExactLocalDateTime(selectedQualityFeed?.lastQualityCheck ?? null)}
                  </div>
                </div>
              </div>

              <div className="flex justify-end gap-3">
                <button
                  type="button"
                  className="rounded-full border border-white/10 bg-white/6 px-5 py-3 text-sm font-medium text-[hsl(var(--color-text))]"
                  onClick={() => {
                    qualityDialogRef.current?.close();
                  }}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={busyLabel !== null}
                  className="rounded-full bg-[hsl(var(--color-accent-strong))] px-5 py-3 text-sm font-semibold text-slate-950 transition hover:brightness-110 focus:outline-none focus:ring-2 focus:ring-[hsl(var(--color-accent-strong))] focus:ring-offset-2 focus:ring-offset-[hsl(var(--color-surface-muted))] disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {busyLabel === 'Update feed quality' ? 'Saving...' : 'Save'}
                </button>
              </div>
            </form>
          </dialog>

          <dialog
            ref={createFolderDialogRef}
            className="feed-management-dialog feed-management-dialog--folder"
          >
            <form
              method="dialog"
              onSubmit={(event) => {
                event.preventDefault();
                void handleCreateFolder();
              }}
              className="space-y-5 p-6"
            >
              <div className="space-y-2">
                <h2 className="text-2xl font-semibold">Create Folder</h2>
                <p className="text-sm text-[hsl(var(--color-text-secondary))]">
                  Add a folder to organize related feeds together.
                </p>
              </div>

              <label className="flex flex-col gap-2 text-sm font-medium">
                Folder name
                <input
                  type="text"
                  value={newFolderName}
                  onChange={(event) => {
                    setNewFolderName(event.target.value);
                  }}
                  className="rounded-2xl border border-white/10 bg-black/10 px-4 py-3 text-sm outline-none transition focus:border-[hsl(var(--color-accent-strong))] focus:ring-2 focus:ring-[hsl(var(--color-accent-strong))]"
                  aria-label="New folder name"
                />
              </label>

              <div className="flex justify-end gap-3">
                <button
                  type="button"
                  className="rounded-full border border-white/10 bg-white/6 px-4 py-2 text-sm font-medium text-[hsl(var(--color-text))]"
                  onClick={() => {
                    createFolderDialogRef.current?.close();
                    setNewFolderName('');
                  }}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="rounded-full bg-[hsl(var(--color-accent-strong))] px-4 py-2 text-sm font-semibold text-slate-950"
                >
                  Create Folder
                </button>
              </div>
            </form>
          </dialog>
        </div>
      </div>
    </div>
  );
}

export default function FeedManagementPage() {
  return (
    <Suspense fallback={null}>
      <FeedManagementContent />
    </Suspense>
  );
}
