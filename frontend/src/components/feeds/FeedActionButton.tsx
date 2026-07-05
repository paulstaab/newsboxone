import type { ButtonHTMLAttributes, ReactNode } from 'react';

interface FeedActionButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  children: ReactNode;
  label: string;
  variant?: 'default' | 'accent' | 'danger';
  size?: 'sm' | 'lg';
}

/**
 * Shared icon-only action button used by feed management controls.
 */
export function FeedActionButton({
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
