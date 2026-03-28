/**
 * Client-only session state capturing auth state and user preferences.
 */
export interface UserSessionConfig {
  /** Username for HTTP Basic auth */
  username: string;

  /** Base64-encoded credentials: base64(username:password) */
  credentials: string;

  /** Whether credentials are persisted to localStorage (true) or sessionStorage (false) */
  rememberDevice: boolean;

  /** User preference: default timeline view mode */
  viewMode: ViewMode;

  /** User preference: sort order */
  sortOrder: SortOrder;

  /** User preference: show read items in timeline */
  showRead: boolean;

  /** ISO 8601 timestamp of last successful sync */
  lastSyncAt: string | null;
}

export type ViewMode = 'card' | 'compact' | 'list';
export type SortOrder = 'newest' | 'oldest';

/** Minimal session data stored in browser storage */
export interface StoredSession {
  username: string;
  credentials: string;
  rememberDevice: boolean;
}

/** User preferences stored separately (always in localStorage) */
export interface UserPreferences {
  viewMode: ViewMode;
  sortOrder: SortOrder;
  showRead: boolean;
}

/** Default preferences applied when none are stored */
export const DEFAULT_PREFERENCES: UserPreferences = {
  viewMode: 'card',
  sortOrder: 'newest',
  showRead: false,
};
