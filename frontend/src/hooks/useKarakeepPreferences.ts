'use client';

import { useCallback, useEffect, useState } from 'react';
import type { UserPreferences } from '@/types';
import { loadPreferences, PREFERENCES_CHANGED_EVENT, storePreferences } from '@/lib/storage';

/** Keeps browser-local Karakeep preferences synchronized within the current tab. */
export function useKarakeepPreferences() {
  const [preferences, setPreferences] = useState<UserPreferences>(loadPreferences);

  useEffect(() => {
    const refresh = () => {
      setPreferences(loadPreferences());
    };
    window.addEventListener(PREFERENCES_CHANGED_EVENT, refresh);
    window.addEventListener('storage', refresh);
    return () => {
      window.removeEventListener(PREFERENCES_CHANGED_EVENT, refresh);
      window.removeEventListener('storage', refresh);
    };
  }, []);

  const updatePreferences = useCallback((next: UserPreferences) => {
    storePreferences(next);
    setPreferences(next);
  }, []);

  return { preferences, updatePreferences };
}
