'use client';

/**
 * Service worker registration component.
 * Registers the service worker on mount.
 */

import { useEffect } from 'react';
import { registerServiceWorker } from '@/lib/sw/register';

/**
 * Registers the service worker on client mount.
 */
export function ServiceWorkerRegistration() {
  useEffect(() => {
    // Register SW after hydration
    void registerServiceWorker();
  }, []);

  return null;
}

export default ServiceWorkerRegistration;
