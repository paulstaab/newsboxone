'use client';

/**
 * Skip link component for keyboard accessibility.
 * Allows users to bypass navigation and jump to main content.
 */

import type { ReactNode } from 'react';

export interface SkipLinkProps {
  /** Target element ID to skip to */
  href: string;
  /** Link text */
  children: ReactNode;
}

/**
 * Renders an accessible skip-to-content link.
 */
export function SkipLink({ href, children }: SkipLinkProps) {
  return (
    <a
      href={href}
      className="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-[100] focus:rounded-md focus:bg-[hsl(var(--color-accent))] focus:px-4 focus:py-2 focus:text-white focus:outline-none focus:ring-2 focus:ring-white focus:ring-offset-2"
    >
      {children}
    </a>
  );
}

export default SkipLink;
