'use client';

/**
 * Install Prompt Component.
 * Displays a user-friendly prompt to install the PWA.
 * Respects user dismissals with 7-day cooldown.
 */

import { useEffect, useState } from 'react';
import {
  setupInstallPromptListeners,
  shouldShowPrompt,
  triggerInstallPrompt,
  recordDismissal,
  getCooldownRemaining,
} from '@/lib/pwa/installPrompt';

export interface InstallPromptProps {
  /**
   * Delay before showing the prompt (in milliseconds).
   * Default: 3000ms (3 seconds) to avoid disrupting initial page load.
   */
  delayMs?: number;

  /**
   * Whether to show the prompt during scrolling/active reading.
   * Default: false (waits for user to be idle).
   */
  showDuringActivity?: boolean;
}

/**
 * Shows the PWA install prompt when eligible.
 */
export function InstallPrompt({ delayMs = 3000, showDuringActivity = false }: InstallPromptProps) {
  const [show, setShow] = useState(false);
  const [isInstalling, setIsInstalling] = useState(false);

  useEffect(() => {
    // Setup event listeners
    const cleanup = setupInstallPromptListeners();
    const handleInstalled = () => {
      setShow(false);
      setIsInstalling(false);
    };
    window.addEventListener('appinstalled', handleInstalled);

    let idleTimer: NodeJS.Timeout | null = null;

    // Check if we should show the prompt after delay
    const timer = setTimeout(() => {
      if (shouldShowPrompt()) {
        // If we care about activity, wait for idle
        if (!showDuringActivity) {
          // Wait a bit more to ensure user isn't actively reading
          idleTimer = setTimeout(() => {
            setShow(true);
          }, 2000);
        } else {
          setShow(true);
        }
      }
    }, delayMs);

    return () => {
      clearTimeout(timer);
      if (idleTimer) clearTimeout(idleTimer);
      window.removeEventListener('appinstalled', handleInstalled);
      cleanup();
    };
  }, [delayMs, showDuringActivity]);

  const handleInstall = async () => {
    setIsInstalling(true);

    const outcome = await triggerInstallPrompt();

    if (outcome === 'accepted') {
      // User accepted, hide the prompt
      setShow(false);
    } else if (outcome === 'dismissed') {
      // User dismissed, record it and hide
      setShow(false);
    }

    setIsInstalling(false);
  };

  const handleDismiss = () => {
    recordDismissal();
    setShow(false);
  };

  if (!show) {
    return null;
  }

  const cooldownRemaining = getCooldownRemaining();
  const daysRemaining = Math.ceil(cooldownRemaining / (24 * 60 * 60 * 1000));

  return (
    <div
      className="fixed bottom-4 left-4 right-4 z-50 md:left-auto md:right-4 md:max-w-md"
      role="dialog"
      aria-labelledby="install-prompt-title"
      aria-describedby="install-prompt-description"
    >
      <div className="rounded-lg bg-[hsl(var(--color-surface-elevated))] p-4 shadow-lg ring-1 ring-[hsl(var(--color-border))]">
        <div className="flex items-start gap-3">
          {/* App Icon */}
          <div className="flex-shrink-0">
            <svg
              className="h-10 w-10 text-[hsl(var(--color-primary))]"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
              aria-hidden="true"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M12 18h.01M8 21h8a2 2 0 002-2V5a2 2 0 00-2-2H8a2 2 0 00-2 2v14a2 2 0 002 2z"
              />
            </svg>
          </div>

          {/* Content */}
          <div className="flex-1 min-w-0">
            <h3
              id="install-prompt-title"
              className="text-sm font-semibold text-[hsl(var(--color-text))]"
            >
              Install NewsBoxOne
            </h3>
            <p
              id="install-prompt-description"
              className="mt-1 text-sm text-[hsl(var(--color-text-secondary))]"
            >
              Add to your home screen for quick access and offline reading.
            </p>

            {/* Actions */}
            <div className="mt-3 flex gap-2">
              <button
                type="button"
                onClick={() => {
                  void handleInstall();
                }}
                disabled={isInstalling}
                className="rounded-md bg-[hsl(var(--color-primary))] px-3 py-1.5 text-sm font-medium text-white hover:bg-[hsl(var(--color-primary-hover))] focus:outline-none focus:ring-2 focus:ring-[hsl(var(--color-primary))] focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed"
                aria-label="Install NewsBoxOne app"
              >
                {isInstalling ? 'Installing...' : 'Install'}
              </button>
              <button
                type="button"
                onClick={handleDismiss}
                disabled={isInstalling}
                className="rounded-md px-3 py-1.5 text-sm font-medium text-[hsl(var(--color-text-secondary))] hover:bg-[hsl(var(--color-surface-hover))] focus:outline-none focus:ring-2 focus:ring-[hsl(var(--color-border))] focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed"
                aria-label="Not now"
              >
                Not now
              </button>
            </div>
          </div>

          {/* Close button */}
          <button
            type="button"
            onClick={handleDismiss}
            disabled={isInstalling}
            className="flex-shrink-0 rounded-md p-1 text-[hsl(var(--color-text-secondary))] hover:bg-[hsl(var(--color-surface-hover))] focus:outline-none focus:ring-2 focus:ring-[hsl(var(--color-border))] disabled:opacity-50 disabled:cursor-not-allowed"
            aria-label="Close install prompt"
          >
            <svg
              className="h-5 w-5"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
              aria-hidden="true"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M6 18L18 6M6 6l12 12"
              />
            </svg>
          </button>
        </div>

        {/* Debug info (only in development) */}
        {process.env.NODE_ENV === 'development' && cooldownRemaining > 0 && (
          <div className="mt-2 text-xs text-[hsl(var(--color-text-tertiary))]">
            Cooldown: {daysRemaining} day{daysRemaining !== 1 ? 's' : ''} remaining
          </div>
        )}
      </div>
    </div>
  );
}

export default InstallPrompt;
