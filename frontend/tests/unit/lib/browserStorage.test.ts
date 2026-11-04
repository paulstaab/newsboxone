import { afterEach, describe, expect, it, vi } from 'vitest';
import { localStore, sessionStore, isStorageUnavailable } from '@/lib/storage/browserStorage';

afterEach(() => {
  vi.restoreAllMocks();
});

describe('browser storage fallback', () => {
  it('retains writes and removals in memory when storage is full', () => {
    const blocked = {
      getItem: () => null,
      setItem: () => {
        throw new DOMException('Full', 'QuotaExceededError');
      },
      removeItem: () => {
        throw new DOMException('Denied', 'SecurityError');
      },
      clear: () => undefined,
      key: () => null,
      length: 0,
    };
    vi.spyOn(window, 'localStorage', 'get').mockReturnValue(blocked);
    localStore.setItem('fallback-test', 'offline-changes');
    expect(localStore.getItem('fallback-test')).toBe('offline-changes');
    expect(isStorageUnavailable()).toBe(true);
    localStore.removeItem('fallback-test');
    expect(localStore.getItem('fallback-test')).toBeNull();
  });

  it('continues when the storage getter itself is blocked', () => {
    vi.spyOn(window, 'sessionStorage', 'get').mockImplementation(() => {
      throw new DOMException('Denied', 'SecurityError');
    });
    sessionStore.setItem('blocked-storage', 'session');
    expect(sessionStore.getItem('blocked-storage')).toBe('session');
    sessionStore.removeItem('blocked-storage');
    expect(sessionStore.getItem('blocked-storage')).toBeNull();
  });
});
