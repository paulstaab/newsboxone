import { describe, it, expect, beforeEach } from 'vitest';
import { clearSession, loadSession, storeSession } from '@/lib/storage';
import { toStoredSession, toUserSessionConfig } from '@/lib/auth/session';

describe('auth session utilities', () => {
  beforeEach(() => {
    sessionStorage.clear();
    localStorage.clear();
  });

  it('stores sessionStorage by default', () => {
    storeSession({
      username: 'testuser',
      token: 'issued-token',
      expiresAt: '2026-04-01T00:00:00.000Z',
      rememberDevice: false,
    });

    expect(sessionStorage.getItem('newsboxone:session')).not.toBeNull();
    expect(localStorage.getItem('newsboxone:session')).toBeNull();
  });

  it('stores localStorage when rememberDevice is enabled', () => {
    storeSession({
      username: 'testuser',
      token: 'issued-token',
      expiresAt: '2026-04-01T00:00:00.000Z',
      rememberDevice: true,
    });

    expect(localStorage.getItem('newsboxone:session')).not.toBeNull();
  });

  it('loads stored sessions from browser storage', () => {
    storeSession({
      username: 'testuser',
      token: 'issued-token',
      expiresAt: '2026-04-01T00:00:00.000Z',
      rememberDevice: true,
    });

    expect(loadSession()).toEqual({
      username: 'testuser',
      token: 'issued-token',
      expiresAt: '2026-04-01T00:00:00.000Z',
      rememberDevice: true,
    });
  });

  it('clears stored sessions', () => {
    storeSession({
      username: 'testuser',
      token: 'issued-token',
      expiresAt: '2026-04-01T00:00:00.000Z',
      rememberDevice: true,
    });

    clearSession();

    expect(loadSession()).toBeNull();
  });

  it('round-trips stored and in-memory session shapes', () => {
    const stored = {
      username: 'testuser',
      token: 'issued-token',
      expiresAt: '2026-04-01T00:00:00.000Z',
      rememberDevice: true,
    };

    const session = toUserSessionConfig(stored);
    expect(toStoredSession(session)).toEqual(stored);
  });
});
