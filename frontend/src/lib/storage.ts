/**
 * Browser storage helpers for auth session state and preferences.
 * Supports session vs. local storage based on remember-device setting.
 */

import { CONFIG } from './config/env';
import { type StoredSession, type UserPreferences, DEFAULT_PREFERENCES } from '@/types';

export const PREFERENCES_CHANGED_EVENT = 'newsboxone:preferences-changed';

function parseStoredSession(value: string): StoredSession | null {
  try {
    const parsed: unknown = JSON.parse(value);
    if (!parsed || typeof parsed !== 'object') return null;

    const session = parsed as Partial<StoredSession>;
    const expiresAt = typeof session.expiresAt === 'string' ? Date.parse(session.expiresAt) : NaN;
    if (
      typeof session.username !== 'string' ||
      session.username.trim().length === 0 ||
      typeof session.token !== 'string' ||
      session.token.length === 0 ||
      typeof session.rememberDevice !== 'boolean' ||
      !Number.isFinite(expiresAt) ||
      expiresAt <= Date.now()
    ) {
      return null;
    }

    return session as StoredSession;
  } catch {
    return null;
  }
}

/**
 * Stores session data in the appropriate storage based on rememberDevice flag.
 */
export function storeSession(session: StoredSession): void {
  const storage = session.rememberDevice ? localStorage : sessionStorage;
  storage.setItem(CONFIG.SESSION_KEY, JSON.stringify(session));

  const staleStorage = session.rememberDevice ? sessionStorage : localStorage;
  staleStorage.removeItem(CONFIG.SESSION_KEY);
}

/**
 * Loads session data from storage.
 * Tries localStorage first (persistent), then sessionStorage.
 */
export function loadSession(): StoredSession | null {
  if (typeof window === 'undefined') return null;

  // Try localStorage first (remember-device was enabled)
  const localStored = localStorage.getItem(CONFIG.SESSION_KEY);
  if (localStored) {
    const session = parseStoredSession(localStored);
    if (session) return session;
    localStorage.removeItem(CONFIG.SESSION_KEY);
  }

  // Fall back to sessionStorage
  const sessionStored = sessionStorage.getItem(CONFIG.SESSION_KEY);
  if (sessionStored) {
    const session = parseStoredSession(sessionStored);
    if (session) return session;
    sessionStorage.removeItem(CONFIG.SESSION_KEY);
  }

  return null;
}

/**
 * Clears session data from both storages.
 */
export function clearSession(): void {
  if (typeof window === 'undefined') return;
  localStorage.removeItem(CONFIG.SESSION_KEY);
  sessionStorage.removeItem(CONFIG.SESSION_KEY);
}

/**
 * Stores user preferences in localStorage (always persistent).
 */
export function storePreferences(preferences: UserPreferences): void {
  if (typeof window === 'undefined') return;
  localStorage.setItem(CONFIG.PREFERENCES_KEY, JSON.stringify(preferences));
  window.dispatchEvent(new Event(PREFERENCES_CHANGED_EVENT));
}

/**
 * Loads user preferences from localStorage.
 * Returns defaults if none stored.
 */
export function loadPreferences(): UserPreferences {
  if (typeof window === 'undefined') return DEFAULT_PREFERENCES;

  const stored = localStorage.getItem(CONFIG.PREFERENCES_KEY);
  if (stored) {
    try {
      const parsed = JSON.parse(stored) as Partial<UserPreferences>;
      // Merge with defaults to handle missing fields
      return { ...DEFAULT_PREFERENCES, ...parsed };
    } catch {
      localStorage.removeItem(CONFIG.PREFERENCES_KEY);
    }
  }

  return DEFAULT_PREFERENCES;
}

/**
 * Updates a single preference value.
 */
export function updatePreference<K extends keyof UserPreferences>(
  key: K,
  value: UserPreferences[K],
): void {
  const current = loadPreferences();
  storePreferences({ ...current, [key]: value });
}

/**
 * Clears all preferences (reset to defaults).
 */
export function clearPreferences(): void {
  if (typeof window === 'undefined') return;
  localStorage.removeItem(CONFIG.PREFERENCES_KEY);
}

/**
 * Clears all NewsBoxOne data from storage.
 */
export function clearAllData(): void {
  clearSession();
  clearPreferences();
  if (typeof window !== 'undefined') {
    localStorage.removeItem(CONFIG.METRICS_KEY);
  }
}

/**
 * Checks if user is currently authenticated (has stored session).
 */
export function isAuthenticated(): boolean {
  return loadSession() !== null;
}

export {
  createEmptyTimelineCache,
  loadTimelineCache,
  mergeItemsIntoCache,
  reconcileTimelineCache,
  pruneTimelineCache,
  storeTimelineCache,
} from './storage/timelineCache';
