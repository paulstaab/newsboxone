import { localStore, sessionStore } from '@/lib/storage/browserStorage';
/**
 * Browser storage helpers for auth session state and preferences.
 * Supports session vs. local storage based on remember-device setting.
 */

import { CONFIG, getConfiguredKarakeepUrl } from './config/env';
import { type StoredSession, type UserPreferences, DEFAULT_PREFERENCES } from '@/types';

export const SESSION_ENDED_EVENT = 'newsboxone:session-ended';
/** Produces a non-credential identifier for matching cross-tab session notices. */
export function sessionIdentity(token: string): string {
  let first = 2166136261;
  let second = 5381;
  for (const char of token) {
    first = Math.imul(first ^ char.charCodeAt(0), 16777619);
    second = Math.imul(second, 33) ^ char.charCodeAt(0);
  }
  return `${String(first >>> 0)}:${String(second >>> 0)}`;
}
export const SESSION_LOGOUT_KEY = 'newsboxone:logout';

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
  const storage = session.rememberDevice ? localStore : sessionStore;
  storage.setItem(CONFIG.SESSION_KEY, JSON.stringify(session));

  const staleStorage = session.rememberDevice ? sessionStore : localStore;
  staleStorage.removeItem(CONFIG.SESSION_KEY);
}

/**
 * Loads session data from storage.
 * Tries localStorage first (persistent), then sessionStore.
 */
export function loadSession(): StoredSession | null {
  if (typeof window === 'undefined') return null;

  // Try localStorage first (remember-device was enabled)
  const localStored = localStore.getItem(CONFIG.SESSION_KEY);
  if (localStored) {
    const session = parseStoredSession(localStored);
    if (session) return session;
    localStore.removeItem(CONFIG.SESSION_KEY);
    if (!sessionStore.getItem(CONFIG.SESSION_KEY)) clearSession('expired');
  }

  // Fall back to sessionStorage
  const sessionStored = sessionStore.getItem(CONFIG.SESSION_KEY);
  if (sessionStored) {
    const session = parseStoredSession(sessionStored);
    if (session) return session;
    clearSession('expired');
  }

  return null;
}

/**
 * Clears session data from both storages.
 */
export function clearSession(reason: 'logout' | 'expired' = 'logout', broadcast = true): void {
  if (typeof window === 'undefined') return;
  const raw = localStore.getItem(CONFIG.SESSION_KEY) ?? sessionStore.getItem(CONFIG.SESSION_KEY);
  let token: string | undefined;
  try {
    token = raw ? (JSON.parse(raw) as StoredSession).token : undefined;
  } catch {
    /* Invalid session. */
  }
  localStore.removeItem(CONFIG.SESSION_KEY);
  sessionStore.removeItem(CONFIG.SESSION_KEY);
  localStore.removeItem(CONFIG.TIMELINE_CACHE_KEY);
  if (broadcast && token) {
    localStore.setItem(
      SESSION_LOGOUT_KEY,
      JSON.stringify({ identity: sessionIdentity(token), reason, at: Date.now() }),
    );
  }
  window.dispatchEvent(new CustomEvent(SESSION_ENDED_EVENT, { detail: reason }));
}

/**
 * Stores user preferences in localStorage (always persistent).
 */
export function storePreferences(preferences: UserPreferences): void {
  if (typeof window === 'undefined') return;
  const configuredKarakeepUrl = getConfiguredKarakeepUrl();
  const nextPreferences = configuredKarakeepUrl
    ? { ...preferences, karakeepBaseUrl: configuredKarakeepUrl }
    : preferences;
  localStore.setItem(CONFIG.PREFERENCES_KEY, JSON.stringify(nextPreferences));
  window.dispatchEvent(new Event(PREFERENCES_CHANGED_EVENT));
}

/**
 * Loads user preferences from localStore.
 * Returns defaults if none stored.
 */
export function loadPreferences(): UserPreferences {
  if (typeof window === 'undefined') return DEFAULT_PREFERENCES;

  const configuredKarakeepUrl = getConfiguredKarakeepUrl();

  const stored = localStore.getItem(CONFIG.PREFERENCES_KEY);
  if (stored) {
    try {
      const parsed = JSON.parse(stored) as Partial<UserPreferences>;
      const configuredUrlChanged = Boolean(
        configuredKarakeepUrl && parsed.karakeepBaseUrl !== configuredKarakeepUrl,
      );
      const preferences = {
        ...DEFAULT_PREFERENCES,
        ...parsed,
        ...(configuredKarakeepUrl ? { karakeepBaseUrl: configuredKarakeepUrl } : {}),
        ...(configuredUrlChanged
          ? { karakeepEnabled: false, karakeepConnectionVerified: false }
          : {}),
      };
      if (configuredUrlChanged) {
        localStore.setItem(CONFIG.PREFERENCES_KEY, JSON.stringify(preferences));
      }
      return preferences;
    } catch {
      localStore.removeItem(CONFIG.PREFERENCES_KEY);
    }
  }

  return configuredKarakeepUrl
    ? { ...DEFAULT_PREFERENCES, karakeepBaseUrl: configuredKarakeepUrl }
    : DEFAULT_PREFERENCES;
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
  localStore.removeItem(CONFIG.PREFERENCES_KEY);
}

/**
 * Clears all NewsBoxOne data from storage.
 */
export function clearAllData(): void {
  clearSession();
  clearPreferences();
  if (typeof window !== 'undefined') {
    localStore.removeItem(CONFIG.METRICS_KEY);
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
