'use client';

interface EmptyStateProps {
  /** Type of empty state to display */
  type: 'no-unread' | 'no-items' | 'offline' | 'error' | 'all-viewed';
  /** Optional custom message */
  message?: string;
  /** Optional action button */
  action?: {
    label: string;
    onClick: () => void;
  };
}

/**
 * Displays timeline empty or error state messaging.
 */
export function EmptyState({ type, message, action }: EmptyStateProps) {
  const getContent = () => {
    switch (type) {
      case 'no-unread':
        return {
          badge: 'Reading queue clear',
          icon: (
            <svg
              className="h-16 w-16"
              fill="none"
              strokeWidth="2"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          ),
          iconClassName:
            'bg-[hsl(var(--color-accent)_/_0.16)] text-[hsl(var(--color-accent-strong))] ring-[hsl(var(--color-accent)_/_0.2)]',
          title: 'All caught up!',
          description: message ?? 'You have no unread articles. Check back later for new content.',
        };

      case 'no-items':
        return {
          badge: 'Timeline empty',
          icon: (
            <svg
              className="h-16 w-16"
              fill="none"
              strokeWidth="2"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path d="M19 20H5a2 2 0 01-2-2V6a2 2 0 012-2h10a2 2 0 012 2v1m2 13a2 2 0 01-2-2V7m2 13a2 2 0 002-2V9a2 2 0 00-2-2h-2m-4-3H9M7 16h6M7 8h6v4H7V8z" />
            </svg>
          ),
          iconClassName:
            'bg-[hsl(var(--color-surface)_/_0.55)] text-[hsl(var(--color-text-muted))] ring-[hsl(var(--color-border))]',
          title: 'No articles yet',
          description: message ?? 'Subscribe to some feeds to start reading articles.',
        };

      case 'offline':
        return {
          badge: 'Offline mode',
          icon: (
            <svg
              className="h-16 w-16"
              fill="none"
              strokeWidth="2"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path d="M18.364 5.636a9 9 0 010 12.728m0 0l-2.829-2.829m2.829 2.829L21 21M15.536 8.464a5 5 0 010 7.072m0 0l-2.829-2.829m-4.243 2.829a4.978 4.978 0 01-1.414-2.83m-1.414 5.658a9 9 0 01-2.167-9.238m7.824 2.167a1 1 0 111.414 1.414m-1.414-1.414L3 3l8.293 8.293z" />
            </svg>
          ),
          iconClassName:
            'bg-[hsl(var(--color-surface)_/_0.55)] text-[hsl(var(--color-text-muted))] ring-[hsl(var(--color-border))]',
          title: "You're offline",
          description: message ?? 'Connect to the internet to load articles.',
        };

      case 'error':
        return {
          badge: 'Load failed',
          icon: (
            <svg
              className="h-16 w-16"
              fill="none"
              strokeWidth="2"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
            </svg>
          ),
          iconClassName:
            'bg-[hsl(0_84%_60%_/_0.12)] text-[hsl(0_84%_72%)] ring-[hsl(0_84%_60%_/_0.24)]',
          title: 'Something went wrong',
          description: message ?? 'Unable to load articles. Please try again.',
        };

      case 'all-viewed':
        return {
          badge: 'Queue complete',
          icon: (
            <svg
              className="h-16 w-16"
              fill="none"
              strokeWidth="2"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"
              />
            </svg>
          ),
          iconClassName:
            'bg-[hsl(var(--color-accent)_/_0.12)] text-[hsl(var(--color-accent-strong))] ring-[hsl(var(--color-accent)_/_0.18)]',
          title: 'All folders viewed',
          description: message ?? 'You have reached the end of your folder queue.',
        };

      default:
        return {
          badge: 'Empty state',
          icon: null,
          iconClassName:
            'bg-[hsl(var(--color-surface)_/_0.55)] text-[hsl(var(--color-text-muted))] ring-[hsl(var(--color-border))]',
          title: 'No content',
          description: message ?? 'Nothing to show here.',
        };
    }
  };

  const content = getContent();

  return (
    <div className="flex px-4 py-10 sm:py-16">
      <section className="relative mx-auto w-full max-w-2xl overflow-hidden rounded-[28px] border border-[hsl(var(--color-border))] bg-[linear-gradient(180deg,hsl(var(--color-surface-muted)_/_0.96)_0%,hsl(var(--color-surface)_/_0.98)_100%)] px-6 py-10 text-center shadow-[var(--shadow-lg)] sm:px-10 sm:py-14">
        <div className="pointer-events-none absolute inset-x-10 top-0 h-28 rounded-full bg-[radial-gradient(circle_at_center,hsl(var(--color-accent)_/_0.18),transparent_70%)] blur-2xl" />

        <div className="relative flex flex-col items-center">
          {content.icon && (
            <div
              className={`mb-6 flex h-24 w-24 items-center justify-center rounded-full ring-1 ring-inset backdrop-blur-sm ${content.iconClassName}`}
            >
              {content.icon}
            </div>
          )}

          <span className="mb-4 inline-flex items-center rounded-full border border-[hsl(var(--color-border))] bg-[hsl(var(--color-surface)_/_0.6)] px-3 py-1 text-xs font-semibold uppercase tracking-[0.22em] text-[hsl(var(--color-text-muted))]">
            {content.badge}
          </span>

          <h3 className="mb-3 text-3xl font-semibold tracking-[-0.03em] text-[hsl(var(--color-text))] sm:text-[2.1rem]">
            {content.title}
          </h3>

          <p className="mb-8 max-w-xl text-balance text-base leading-8 text-[hsl(var(--color-text-muted))] sm:text-lg">
            {content.description}
          </p>

          {action && (
            <button
              onClick={action.onClick}
              className="rounded-full bg-[hsl(var(--color-accent))] px-6 py-3 text-sm font-semibold text-white shadow-[0_12px_30px_hsl(var(--color-accent)_/_0.3)] transition-transform transition-colors hover:bg-[hsl(var(--color-accent-strong))] hover:-translate-y-0.5 focus:outline-none focus:ring-2 focus:ring-[hsl(var(--color-accent-strong))] focus:ring-offset-2 focus:ring-offset-[hsl(var(--color-surface))]"
            >
              {action.label}
            </button>
          )}
        </div>
      </section>
    </div>
  );
}
