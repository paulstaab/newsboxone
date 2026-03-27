'use client';

import { useEffect, useState } from 'react';
import { OfflineBanner } from '@/components/ui/OfflineBanner';
import { InstallPrompt } from '@/components/ui/InstallPrompt';
import { SettingsMenu } from '@/components/ui/SettingsMenu';

/**
 * Hosts client-only overlay UI such as banners and toasts.
 */
export function ClientOverlays() {
  const [isMounted, setIsMounted] = useState(false);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setIsMounted(true);
  }, []);

  if (!isMounted) {
    return null;
  }

  return (
    <>
      <OfflineBanner />
      <InstallPrompt delayMs={3000} showDuringActivity={false} />
      <SettingsMenu position="top-right" />
    </>
  );
}
