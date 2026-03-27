// Runtime environment guards and configuration.

/** Storage key for debug mode preference */
const DEBUG_KEY = 'newsboxone:debug';
const RAW_BASE_PATH = process.env.NEXT_PUBLIC_BASE_PATH ?? '';

/**
 * Base path for deployments hosted under a subfolder (e.g., GitHub Pages).
 */
export const APP_BASE_PATH = RAW_BASE_PATH ? `/${RAW_BASE_PATH.replace(/^\/|\/$/g, '')}` : '';

/**
 * Feature flags for conditional functionality.
 */
export interface FeatureFlags {
  /** Enable debug mode (verbose logging, diagnostics panel) */
  debug: boolean;
  /** Enable offline mode indicator */
  offlineMode: boolean;
  /** Enable experimental features */
  experimental: boolean;
}

/**
 * Returns current feature flags based on environment and localStorage overrides.
 */
export function getFeatureFlags(): FeatureFlags {
  const isDebugStored = typeof window !== 'undefined' && localStorage.getItem(DEBUG_KEY) === 'true';
  const isDev = process.env.NODE_ENV === 'development';

  return {
    debug: isDev || isDebugStored,
    offlineMode: true, // always enabled
    experimental: isDev,
  };
}

/**
 * Enables or disables debug mode.
 */
export function setDebugMode(enabled: boolean): void {
  if (typeof window !== 'undefined') {
    if (enabled) {
      localStorage.setItem(DEBUG_KEY, 'true');
    } else {
      localStorage.removeItem(DEBUG_KEY);
    }
  }
}

/**
 * App configuration constants.
 */
export const CONFIG = {
  /** API path prefix for the combined NewsBoxOne backend */
  API_PATH: '/api',

  /** Default batch size for item fetching */
  DEFAULT_BATCH_SIZE: 50,

  /** SWR deduplication interval in milliseconds */
  SWR_DEDUPE_INTERVAL: 5000,

  /** SWR cache TTL in milliseconds (5 minutes) */
  SWR_CACHE_TTL: 5 * 60 * 1000,

  /** Maximum retry attempts for failed requests */
  MAX_RETRIES: 3,

  /** Base delay for exponential backoff (ms) */
  RETRY_BASE_DELAY: 1000,

  /** Session storage key */
  SESSION_KEY: 'newsboxone:session',

  /** Preferences storage key */
  PREFERENCES_KEY: 'newsboxone:preferences',

  /** Metrics/sync storage key */
  METRICS_KEY: 'newsboxone:metrics',

  /** User-Agent header for API requests */
  USER_AGENT: 'newsboxone/1.0',

  /** Timeline cache namespace stored in localStorage */
  TIMELINE_CACHE_KEY: 'newsboxone.timeline.v1',

  /** Current schema version for the timeline cache envelope */
  TIMELINE_CACHE_VERSION: 1,

  /** Maximum number of articles to persist per folder */
  TIMELINE_MAX_ITEMS_PER_FOLDER: 200,

  /** Maximum age (in days) for cached articles before pruning */
  TIMELINE_MAX_ITEM_AGE_DAYS: 14,

  /** Performance mark label for first paint of cached timeline */
  TIMELINE_PERF_CACHE_READY_MARK: 'timeline-cache-ready',

  /** Target (ms) for cache render completion */
  TIMELINE_PERF_CACHE_TARGET_MS: 500,

  /** Performance mark label for completion of timeline updates */
  TIMELINE_PERF_UPDATE_MARK: 'timeline-update-complete',

  /** Target (ms) for completing an update cycle */
  TIMELINE_PERF_UPDATE_TARGET_MS: 10_000,

  /** Exponential retry delays for timeline updates (ms) */
  TIMELINE_UPDATE_RETRY_DELAYS_MS: [1000, 2000, 4000] as const,
} as const;

/**
 * Error messages for common scenarios (FR-012: actionable copy).
 */
export const ERROR_MESSAGES = {
  INVALID_CREDENTIALS: 'Invalid username or password. Please check your credentials.',
  NETWORK_ERROR: 'Unable to connect to the NewsBoxOne API. Please check your connection.',
  SERVER_ERROR: 'The server encountered an error. Please try again later.',
  SESSION_EXPIRED: 'Your session has expired. Please log in again.',
  RATE_LIMITED: 'Too many requests. Please wait a moment and try again.',
  OFFLINE: 'You are currently offline. Some features may be unavailable.',
  NOT_FOUND: 'The requested resource was not found.',
  UNKNOWN: 'An unexpected error occurred. Please try again.',
} as const;
