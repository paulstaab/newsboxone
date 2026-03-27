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
          icon: (
            <svg
              className="w-16 h-16 text-gray-400"
              fill="none"
              strokeWidth="2"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          ),
          title: 'All caught up!',
          description: message ?? 'You have no unread articles. Check back later for new content.',
        };

      case 'no-items':
        return {
          icon: (
            <svg
              className="w-16 h-16 text-gray-400"
              fill="none"
              strokeWidth="2"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path d="M19 20H5a2 2 0 01-2-2V6a2 2 0 012-2h10a2 2 0 012 2v1m2 13a2 2 0 01-2-2V7m2 13a2 2 0 002-2V9a2 2 0 00-2-2h-2m-4-3H9M7 16h6M7 8h6v4H7V8z" />
            </svg>
          ),
          title: 'No articles yet',
          description: message ?? 'Subscribe to some feeds to start reading articles.',
        };

      case 'offline':
        return {
          icon: (
            <svg
              className="w-16 h-16 text-gray-400"
              fill="none"
              strokeWidth="2"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path d="M18.364 5.636a9 9 0 010 12.728m0 0l-2.829-2.829m2.829 2.829L21 21M15.536 8.464a5 5 0 010 7.072m0 0l-2.829-2.829m-4.243 2.829a4.978 4.978 0 01-1.414-2.83m-1.414 5.658a9 9 0 01-2.167-9.238m7.824 2.167a1 1 0 111.414 1.414m-1.414-1.414L3 3l8.293 8.293z" />
            </svg>
          ),
          title: "You're offline",
          description: message ?? 'Connect to the internet to load articles.',
        };

      case 'error':
        return {
          icon: (
            <svg
              className="w-16 h-16 text-red-400"
              fill="none"
              strokeWidth="2"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
            </svg>
          ),
          title: 'Something went wrong',
          description: message ?? 'Unable to load articles. Please try again.',
        };

      case 'all-viewed':
        return {
          icon: (
            <svg
              className="w-16 h-16 text-gray-400"
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
          title: 'All folders viewed',
          description: message ?? 'You have reached the end of your folder queue.',
        };

      default:
        return {
          icon: null,
          title: 'No content',
          description: message ?? 'Nothing to show here.',
        };
    }
  };

  const content = getContent();

  return (
    <div className="flex flex-col items-center justify-center py-16 px-4 text-center">
      {content.icon && <div className="mb-4">{content.icon}</div>}

      <h3 className="text-xl font-semibold text-gray-900 mb-2">{content.title}</h3>

      <p className="text-gray-600 max-w-md mb-6">{content.description}</p>

      {action && (
        <button
          onClick={action.onClick}
          className="px-6 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 transition-colors"
        >
          {action.label}
        </button>
      )}
    </div>
  );
}
