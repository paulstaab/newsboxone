import { DEFAULT_PREFERENCES, type StoredSession, type UserSessionConfig } from '@/types';

/**
 * Converts minimal persisted session data into the richer in-memory session shape.
 */
export function toUserSessionConfig(stored: StoredSession): UserSessionConfig {
  return {
    username: stored.username,
    token: stored.token,
    expiresAt: stored.expiresAt,
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
    token: session.token,
    expiresAt: session.expiresAt,
    rememberDevice: session.rememberDevice,
  };
}
