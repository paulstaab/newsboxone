import type { Metadata, Viewport } from 'next';
import type { ReactNode } from 'react';
import '../styles/globals.css';
import { SWRProvider } from '@/lib/swr/provider';
import { AuthProvider } from '@/hooks/useAuth';
import { APP_BASE_PATH } from '@/lib/config/env';
import { SkipLink } from '@/components/ui/SkipLink';
import { ServiceWorkerRegistration } from '@/components/ui/ServiceWorkerRegistration';
import { ClientOverlays } from '@/components/ui/ClientOverlays';

/**
 * App metadata for the root layout.
 */
export const metadata: Metadata = {
  title: 'NewsBoxOne',
  description: 'Static headless RSS reader for Nextcloud News.',
  manifest: `${APP_BASE_PATH}/manifest.json`,
  icons: {
    icon: `${APP_BASE_PATH}/favicon.ico`,
    apple: `${APP_BASE_PATH}/apple-touch-icon.png`,
  },
};

/**
 * Viewport configuration for the root layout.
 */
export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  themeColor: [
    { media: '(prefers-color-scheme: light)', color: '#ffffff' },
    { media: '(prefers-color-scheme: dark)', color: '#1a1a2e' },
  ],
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en" className="scroll-smooth">
      <body className="min-h-screen bg-[hsl(var(--color-surface))] text-[hsl(var(--color-text))] antialiased">
        <SkipLink href="#main-content">Skip to main content</SkipLink>
        <AuthProvider>
          <SWRProvider>
            <div className="flex min-h-screen flex-col">
              {/* Main content area */}
              <main id="main-content" tabIndex={-1} className="flex-1 outline-none">
                {children}
              </main>
            </div>
            <ClientOverlays />
          </SWRProvider>
        </AuthProvider>
        <ServiceWorkerRegistration />
      </body>
    </html>
  );
}
