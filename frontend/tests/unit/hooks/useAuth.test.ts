import { describe, it, expect, beforeEach } from 'vitest';
import { clearSession, loadSession, storeSession } from '@/lib/storage';
import { encodeBasicCredentials, toStoredSession, toUserSessionConfig } from '@/lib/auth/session';

describe('auth session utilities', () => {
  beforeEach(() => {
    sessionStorage.clear();
    localStorage.clear();
  });

  it('encodes username and password as basic auth credentials', () => {
    expect(encodeBasicCredentials('testuser', 'testpass')).toBe('dGVzdHVzZXI6dGVzdHBhc3M=');
  });

  it('stores sessionStorage by default', () => {
    storeSession({
      username: 'testuser',
      credentials: 'encoded',
      rememberDevice: false,
    });

    expect(sessionStorage.getItem('newsboxone:session')).not.toBeNull();
    expect(localStorage.getItem('newsboxone:session')).toBeNull();
  });

  it('stores localStorage when rememberDevice is enabled', () => {
    storeSession({
      username: 'testuser',
      credentials: 'encoded',
      rememberDevice: true,
    });

    expect(localStorage.getItem('newsboxone:session')).not.toBeNull();
  });

  it('loads stored sessions from browser storage', () => {
    storeSession({
      username: 'testuser',
      credentials: 'encoded',
      rememberDevice: true,
    });

    expect(loadSession()).toEqual({
      username: 'testuser',
      credentials: 'encoded',
      rememberDevice: true,
    });
  });

  it('clears stored sessions', () => {
    storeSession({
      username: 'testuser',
      credentials: 'encoded',
      rememberDevice: true,
    });

    clearSession();

    expect(loadSession()).toBeNull();
  });

  it('round-trips stored and in-memory session shapes', () => {
    const stored = {
      username: 'testuser',
      credentials: 'encoded',
      rememberDevice: true,
    };

    const session = toUserSessionConfig(stored);
    expect(toStoredSession(session)).toEqual(stored);
  });
});
