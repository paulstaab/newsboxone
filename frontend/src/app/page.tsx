'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/hooks/useAuth';
import { FullscreenStatus } from '@/components/ui/FullscreenStatus';

/**
 * Home page that redirects to timeline or login based on auth state.
 */
export default function HomePage() {
  const router = useRouter();
  const { isAuthenticated, isInitializing } = useAuth();

  useEffect(() => {
    if (isInitializing) {
      return;
    }

    if (isAuthenticated) {
      router.push('/timeline');
    } else {
      router.push('/login');
    }
  }, [isAuthenticated, isInitializing, router]);

  return <FullscreenStatus message="Loading NewsBoxOne..." className="bg-transparent" />;
}
