/** Browser storage with a memory fallback when access or quota fails. */
const fallback = {
  localStorage: new Map<string, string | null>(),
  sessionStorage: new Map<string, string | null>(),
};
let unavailable = false;
export const STORAGE_WARNING_EVENT = 'newsboxone:storage-unavailable';

/** Reports whether persistence has failed during this page lifetime. */
export function isStorageUnavailable(): boolean {
  return unavailable;
}

function storage(kind: 'localStorage' | 'sessionStorage') {
  const memory = fallback[kind];
  const failed = () => {
    unavailable = true;
    window.dispatchEvent(new Event(STORAGE_WARNING_EVENT));
  };
  return {
    getItem(key: string): string | null {
      if (typeof window === 'undefined') return null;
      if (memory.has(key)) return memory.get(key) ?? null;
      try {
        return window[kind].getItem(key);
      } catch {
        failed();
        return null;
      }
    },
    setItem(key: string, value: string): void {
      if (typeof window === 'undefined') return;
      try {
        window[kind].setItem(key, value);
        memory.delete(key);
      } catch {
        memory.set(key, value);
        failed();
      }
    },
    removeItem(key: string): void {
      if (typeof window === 'undefined') return;
      try {
        window[kind].removeItem(key);
        memory.delete(key);
      } catch {
        memory.set(key, null);
        failed();
      }
    },
  };
}
export const localStore = storage('localStorage');
export const sessionStore = storage('sessionStorage');
