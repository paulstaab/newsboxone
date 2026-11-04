import { act, renderHook, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { ReactNode } from 'react';
import { AuthProvider, useAuth } from '@/hooks/useAuth';
import {
  clearSession,
  SESSION_LOGOUT_KEY,
  sessionIdentity,
  storeSession,
  storePreferences,
  loadPreferences,
} from '@/lib/storage';
import { CONFIG } from '@/lib/config/env';
import { DEFAULT_PREFERENCES } from '@/types';

const mocks = vi.hoisted(() => ({
  replace: vi.fn(),
  logout: vi.fn().mockResolvedValue(undefined),
}));
const router = { replace: mocks.replace };
vi.mock('next/navigation', () => ({ useRouter: () => router }));
vi.mock('@/lib/api/apiClient', () => ({
  getApiClient: () => ({ auth: { logout: mocks.logout } }),
}));

/** Supplies the real authentication lifecycle to hook tests. */
function Wrapper({ children }: { children: ReactNode }) {
  return <AuthProvider>{children}</AuthProvider>;
}

const session = {
  username: 'reader',
  token: 'browser-token',
  expiresAt: '2099-01-01T00:00:00.000Z',
  rememberDevice: false,
};
beforeEach(() => {
  localStorage.clear();
  sessionStorage.clear();
  vi.clearAllMocks();
});
afterEach(() => {
  vi.restoreAllMocks();
});

describe('session lifecycle', () => {
  it('expires a rejected session and removes article data while retaining Karakeep credentials', async () => {
    storeSession(session);
    storePreferences({ ...DEFAULT_PREFERENCES, karakeepApiToken: 'keep-this-key' });
    localStorage.setItem(CONFIG.TIMELINE_CACHE_KEY, 'cached-articles-and-pending-reads');
    const { result } = renderHook(useAuth, { wrapper: Wrapper });
    await waitFor(() => {
      expect(result.current.isAuthenticated).toBe(true);
    });
    act(() => {
      clearSession('expired');
    });
    expect(result.current.session).toBeNull();
    expect(result.current.error).toBe('Session expired');
    expect(mocks.replace).toHaveBeenCalledWith('/login');
    expect(localStorage.getItem(CONFIG.TIMELINE_CACHE_KEY)).toBeNull();
    expect(loadPreferences().karakeepApiToken).toBe('keep-this-key');
  });

  it('signs out matching sessions across tabs without persisting the bearer token in logout notices', async () => {
    storeSession(session);
    const { result } = renderHook(useAuth, { wrapper: Wrapper });
    await waitFor(() => {
      expect(result.current.isAuthenticated).toBe(true);
    });
    act(() => {
      window.dispatchEvent(
        new StorageEvent('storage', {
          key: SESSION_LOGOUT_KEY,
          newValue: JSON.stringify({
            identity: sessionIdentity('another-token'),
            reason: 'logout',
          }),
        }),
      );
    });
    expect(result.current.isAuthenticated).toBe(true);
    act(() => {
      window.dispatchEvent(
        new StorageEvent('storage', {
          key: SESSION_LOGOUT_KEY,
          newValue: JSON.stringify({ identity: sessionIdentity(session.token), reason: 'logout' }),
        }),
      );
    });
    expect(result.current.isAuthenticated).toBe(false);
    storeSession(session);
    clearSession();
    expect(localStorage.getItem(SESSION_LOGOUT_KEY)).not.toContain(session.token);
  });

  it('shows session expiry when an expired session is found on startup', async () => {
    sessionStorage.setItem(
      CONFIG.SESSION_KEY,
      JSON.stringify({ ...session, expiresAt: '2000-01-01T00:00:00Z' }),
    );
    const { result } = renderHook(useAuth, { wrapper: Wrapper });
    await waitFor(() => {
      expect(result.current.isInitializing).toBe(false);
    });
    expect(result.current.error).toBe('Session expired');
  });

  it('finishes local logout when revocation fails', async () => {
    storeSession(session);
    mocks.logout.mockRejectedValueOnce(new TypeError('Offline'));
    const { result } = renderHook(useAuth, { wrapper: Wrapper });
    await waitFor(() => {
      expect(result.current.isAuthenticated).toBe(true);
    });
    await act(async () => {
      await result.current.logout();
    });
    expect(result.current.session).toBeNull();
    expect(sessionStorage.getItem(CONFIG.SESSION_KEY)).toBeNull();
  });
});
