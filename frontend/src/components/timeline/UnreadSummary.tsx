'use client';

interface UnreadSummaryProps {
  totalUnread: number;
  activeFolderUnread: number;
  remainingFolders: number;
  className?: string;
}

/**
 * Shows unread counts and metadata for the active folder.
 */
export function UnreadSummary({
  totalUnread,
  activeFolderUnread,
  remainingFolders,
  className = '',
}: UnreadSummaryProps) {
  if (totalUnread === 0) {
    return (
      <div className={`flex items-center gap-2 text-sm text-gray-600 ${className}`}>
        <svg
          className="w-5 h-5 text-green-500"
          fill="none"
          strokeWidth="2"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
        </svg>
        <span>All caught up</span>
      </div>
    );
  }

  return (
    <div className={`flex flex-col gap-1 text-sm ${className}`}>
      <div className="inline-flex items-center gap-2 px-3 py-1.5 bg-blue-50 border border-blue-200 rounded-full">
        <span className="w-2 h-2 bg-blue-600 rounded-full animate-pulse"></span>
        <span className="text-sm font-medium text-blue-900">
          {totalUnread} unread across timeline
        </span>
      </div>
      <div className="text-gray-600">
        {activeFolderUnread} in focus · {remainingFolders} folder{remainingFolders === 1 ? '' : 's'}{' '}
        queued
      </div>
    </div>
  );
}

interface UnreadBadgeProps {
  count: number;
  size?: 'sm' | 'md' | 'lg';
  variant?: 'default' | 'subtle';
}

/**
 * Displays a compact unread badge.
 */
export function UnreadBadge({ count, size = 'md', variant = 'default' }: UnreadBadgeProps) {
  if (count === 0) return null;

  const sizeClasses = {
    sm: 'text-xs px-1.5 py-0.5 min-w-[18px]',
    md: 'text-sm px-2 py-0.5 min-w-[24px]',
    lg: 'text-base px-2.5 py-1 min-w-[28px]',
  };

  const variantClasses = {
    default: 'bg-blue-600 text-white',
    subtle: 'bg-blue-100 text-blue-800 border border-blue-200',
  };

  // Format large numbers (e.g., 1000+ -> 1k+)
  const displayCount = count > 999 ? `${String(Math.floor(count / 1000))}k+` : count.toString();

  return (
    <span
      className={`inline-flex items-center justify-center font-semibold rounded-full ${sizeClasses[size]} ${variantClasses[variant]}`}
      aria-label={`${String(count)} unread items`}
    >
      {displayCount}
    </span>
  );
}
