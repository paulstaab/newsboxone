import { DEFAULT_PREFERENCES, type StoredSession, type UserSessionConfig } from '@/types';

/**
 * Encodes username and password for HTTP Basic authentication.
 */
export function encodeBasicCredentials(username: string, password: string): string {
  return btoa(`${username}:${password}`);
}

/**
 * Converts minimal persisted session data into the richer in-memory session shape.
 */
export function toUserSessionConfig(stored: StoredSession): UserSessionConfig {
  return {
    username: stored.username,
    credentials: stored.credentials,
    rememberDevice: stored.rememberDevice,
    ...DEFAULT_PREFERENCES,
    lastSyncAt: new Date().toISOString(),
  };
}

/**
 * Strips in-memory-only fields before persisting a session.
 */
export function toStoredSession(session: UserSessionConfig): StoredSession {
  return {
    username: session.username,
    credentials: session.credentials,
    rememberDevice: session.rememberDevice,
  };
}
