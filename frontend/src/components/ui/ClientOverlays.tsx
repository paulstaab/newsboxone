'use client';

import { useEffect, useState } from 'react';
import { isStorageUnavailable, STORAGE_WARNING_EVENT } from '@/lib/storage/browserStorage';
import { OfflineBanner } from '@/components/ui/OfflineBanner';
import { InstallPrompt } from '@/components/ui/InstallPrompt';
import { SettingsMenu } from '@/components/ui/SettingsMenu';

/**
 * Hosts client-only overlay UI such as banners and toasts.
 */
export function ClientOverlays() {
  const [isMounted, setIsMounted] = useState(false);
  const [storageWarning, setStorageWarning] = useState(isStorageUnavailable);
  useEffect(() => {
    const warn = () => {
      setStorageWarning(true);
    };
    window.addEventListener(STORAGE_WARNING_EVENT, warn);
    return () => {
      window.removeEventListener(STORAGE_WARNING_EVENT, warn);
    };
  }, []);

  useEffect(() => {
    // oxlint-disable-next-line react/set-state-in-effect
    setIsMounted(true);
  }, []);

  if (!isMounted) {
    return null;
  }

  return (
    <>
      <OfflineBanner message="You are currently offline. Feed changes and Karakeep actions are unavailable. Read changes will retry when connected." />
      {storageWarning && (
        <div role="alert" className="storage-warning">
          Browser storage is unavailable or full. Your session and pending offline changes may be
          lost when this page closes.
        </div>
      )}
      <InstallPrompt delayMs={3000} showDuringActivity={false} />
      <SettingsMenu position="top-right" />
    </>
  );
}
