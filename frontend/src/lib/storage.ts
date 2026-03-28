/**
 * Browser storage helpers for auth session state and preferences.
 * Supports session vs. local storage based on remember-device setting.
 */

import { CONFIG } from './config/env';
import { type StoredSession, type UserPreferences, DEFAULT_PREFERENCES } from '@/types';

/**
 * Stores session data in the appropriate storage based on rememberDevice flag.
 */
export function storeSession(session: StoredSession): void {
  const storage = session.rememberDevice ? localStorage : sessionStorage;
  storage.setItem(CONFIG.SESSION_KEY, JSON.stringify(session));

  // If using sessionStorage, ensure localStorage doesn't have stale data
  if (!session.rememberDevice) {
    localStorage.removeItem(CONFIG.SESSION_KEY);
  }
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
    try {
      return JSON.parse(localStored) as StoredSession;
    } catch {
      localStorage.removeItem(CONFIG.SESSION_KEY);
    }
  }

  // Fall back to sessionStorage
  const sessionStored = sessionStorage.getItem(CONFIG.SESSION_KEY);
  if (sessionStored) {
    try {
      return JSON.parse(sessionStored) as StoredSession;
    } catch {
      sessionStorage.removeItem(CONFIG.SESSION_KEY);
    }
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
