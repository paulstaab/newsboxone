'use client';

import { APP_BASE_PATH } from '@/lib/config/env';

// Service worker registration utilities.

/**
 * Registration status for the service worker.
 */
export interface ServiceWorkerStatus {
  isSupported: boolean;
  isRegistered: boolean;
  isWaiting: boolean;
  registration: ServiceWorkerRegistration | null;
}

/**
 * Check if service workers are supported.
 */
export function isServiceWorkerSupported(): boolean {
  return typeof window !== 'undefined' && 'serviceWorker' in navigator;
}

/**
 * Register the service worker.
 */
export async function registerServiceWorker(): Promise<ServiceWorkerRegistration | null> {
  if (!isServiceWorkerSupported()) {
    console.warn('Service workers are not supported in this browser');
    return null;
  }

  try {
    const basePath = APP_BASE_PATH || '';
    const scope = `${basePath}/`.replace(/\/\/+$/, '/');
    const registration = await navigator.serviceWorker.register(`${basePath}/sw.js`, {
      scope,
    });

    // Handle updates
    registration.addEventListener('updatefound', () => {
      const newWorker = registration.installing;
      if (newWorker) {
        newWorker.addEventListener('statechange', () => {
          if (newWorker.state === 'installed' && navigator.serviceWorker.controller) {
            // New service worker available
            console.info('New service worker available');
          }
        });
      }
    });

    console.info('Service worker registered:', registration.scope);
    return registration;
  } catch (error) {
    console.error('Service worker registration failed:', error);
    return null;
  }
}

/**
 * Unregister the service worker.
 */
export async function unregisterServiceWorker(): Promise<boolean> {
  if (!isServiceWorkerSupported()) {
    return false;
  }

  try {
    const registration = await navigator.serviceWorker.ready;
    const success = await registration.unregister();
    console.info('Service worker unregistered:', success);
    return success;
  } catch (error) {
    console.error('Service worker unregistration failed:', error);
    return false;
  }
}

/**
 * Skip waiting and activate new service worker.
 */
export function skipWaiting(): void {
  if (!isServiceWorkerSupported()) {
    return;
  }

  void navigator.serviceWorker.ready.then((registration) => {
    if (registration.waiting) {
      registration.waiting.postMessage('skipWaiting');
    }
  });
}

/**
 * Get current service worker status.
 */
export async function getServiceWorkerStatus(): Promise<ServiceWorkerStatus> {
  const status: ServiceWorkerStatus = {
    isSupported: isServiceWorkerSupported(),
    isRegistered: false,
    isWaiting: false,
    registration: null,
  };

  if (!status.isSupported) {
    return status;
  }

  try {
    const registration = await navigator.serviceWorker.getRegistration();
    if (registration) {
      status.isRegistered = true;
      status.isWaiting = !!registration.waiting;
      status.registration = registration;
    }
  } catch (error) {
    console.error('Failed to get service worker status:', error);
  }

  return status;
}
