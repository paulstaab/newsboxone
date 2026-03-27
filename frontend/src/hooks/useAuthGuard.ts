'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/hooks/useAuth';

interface UseAuthGuardOptions {
  requireAuth?: boolean;
  unauthenticatedRedirect?: string;
  authenticatedRedirect?: string;
}

/**
 * Centralizes route-level auth redirects and loading readiness.
 */
export function useAuthGuard(options: UseAuthGuardOptions = {}) {
  const {
    requireAuth = true,
    unauthenticatedRedirect = '/login',
    authenticatedRedirect = '/timeline',
  } = options;
  const router = useRouter();
  const auth = useAuth();

  useEffect(() => {
    if (auth.isInitializing) {
      return;
    }

    if (requireAuth && !auth.isAuthenticated) {
      router.push(unauthenticatedRedirect);
      return;
    }

    if (!requireAuth && auth.isAuthenticated) {
      router.push(authenticatedRedirect);
    }
  }, [
    auth.isAuthenticated,
    auth.isInitializing,
    authenticatedRedirect,
    requireAuth,
    router,
    unauthenticatedRedirect,
  ]);

  return {
    ...auth,
    isReady: !auth.isInitializing && (requireAuth ? auth.isAuthenticated : !auth.isAuthenticated),
  };
}
