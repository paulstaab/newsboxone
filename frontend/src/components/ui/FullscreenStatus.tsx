interface FullscreenStatusProps {
  message: string;
  className?: string;
}

/**
 * Renders a centered full-page loading state.
 */
export function FullscreenStatus({ message, className = 'bg-gray-50' }: FullscreenStatusProps) {
  return (
    <div className={`min-h-screen flex items-center justify-center ${className}`.trim()}>
      <div
        className="inline-flex items-center gap-3 text-gray-600"
        role="status"
        aria-live="polite"
      >
        <div
          className="h-8 w-8 animate-spin rounded-full border-b-2 border-blue-600"
          aria-hidden="true"
        />
        <span>{message}</span>
      </div>
    </div>
  );
}
