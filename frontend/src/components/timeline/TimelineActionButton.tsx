import type { ButtonHTMLAttributes, ReactNode } from 'react';

interface TimelineActionButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  icon: ReactNode;
  label: string;
  tooltip?: string;
  isLoading?: boolean;
}

/**
 * Base button used for timeline actions.
 */
export function TimelineActionButton({
  icon,
  label,
  tooltip,
  isLoading = false,
  className,
  disabled,
  ...props
}: TimelineActionButtonProps) {
  return (
    <button
      type="button"
      aria-label={label}
      title={tooltip ?? label}
      aria-disabled={(disabled ?? isLoading) ? true : undefined}
      disabled={disabled ?? isLoading}
      className={[
        'relative inline-flex items-center justify-center rounded-md border',
        'border-[hsl(var(--color-border))] bg-[hsl(var(--color-surface-muted))]',
        'text-[hsl(var(--color-text))] shadow-sm transition-colors',
        'hover:border-[hsl(var(--color-accent)/0.5)] hover:bg-[hsl(var(--color-surface))]',
        'disabled:cursor-not-allowed disabled:opacity-50',
        className,
      ]
        .filter(Boolean)
        .join(' ')}
      style={{ width: '3.5rem', height: '3.5rem' }}
      {...props}
    >
      <span className={isLoading ? 'opacity-0' : 'opacity-100'} aria-hidden>
        {icon}
      </span>
      {isLoading && (
        <span
          className="absolute h-4 w-4 animate-spin rounded-full border-2 border-gray-400 border-t-transparent"
          aria-hidden
        />
      )}
    </button>
  );
}
