'use client';

/**
 * Global SWR provider configuration.
 * Provides caching, deduplication, offline gating, and revalidation settings.
 * Aligned with FR-003: 5-minute cache TTL.
 */

import { SWRConfig, type SWRConfiguration } from 'swr';
import type { ReactNode } from 'react';
import { CONFIG } from '@/lib/config/env';

/**
 * Default SWR configuration for the application.
 */
export const swrConfig: SWRConfiguration = {
  // 5-minute dedupe interval (prevents duplicate requests within this window)
  dedupingInterval: CONFIG.SWR_CACHE_TTL,

  // Revalidate on window focus (manual refresh-like behavior)
  revalidateOnFocus: true,

  // Don't revalidate on reconnect automatically (let user control sync)
  revalidateOnReconnect: false,

  // Retry failed requests
  shouldRetryOnError: true,
  errorRetryCount: 3,
  errorRetryInterval: 1000,

  // Don't revalidate if we already have data (stale-while-revalidate)
  revalidateIfStale: true,

  // Focus throttle to prevent rapid revalidation
  focusThrottleInterval: 5000,

  // Loading timeout for suspense
  loadingTimeout: 3000,

  // Keep data when key changes
  keepPreviousData: true,

  // Custom fetcher is set per-hook, not globally
  // Each API call uses its own credentials

  // Offline gating: don't fetch when offline
  isPaused: () => typeof navigator !== 'undefined' && !navigator.onLine,

  // Error handling
  onError: (error: unknown, key: string) => {
    // Log errors for debugging, could integrate with metrics
    if (process.env.NODE_ENV === 'development') {
      console.error(`SWR Error [${key}]:`, error);
    }
  },

  // Success callback for potential metrics
  onSuccess: (data: unknown, key: string) => {
    if (process.env.NODE_ENV === 'development') {
      console.debug(`SWR Success [${key}]:`, data ? 'data received' : 'no data');
    }
  },
};

/**
 * Props for the SWR provider wrapper.
 */
interface SWRProviderProps {
  children: ReactNode;
  /** Optional config overrides for testing */
  config?: Partial<SWRConfiguration>;
}

/**
 * SWR provider component that wraps the application.
 * Provides global caching and configuration for all SWR hooks.
 */
export function SWRProvider({ children, config }: SWRProviderProps) {
  // Merge default config with any overrides

  const mergedConfig: SWRConfiguration = config ? { ...swrConfig, ...config } : swrConfig;

  return <SWRConfig value={mergedConfig}>{children}</SWRConfig>;
}

export default SWRProvider;
