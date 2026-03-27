'use client';

/**
 * PWA Install Prompt State Management.
 * Handles beforeinstallprompt event detection, dismissal tracking,
 * and 7-day cooldown logic.
 */

const DISMISSAL_KEY = 'pwa-install-dismissed';
const COOLDOWN_DAYS = 7;
const COOLDOWN_MS = COOLDOWN_DAYS * 24 * 60 * 60 * 1000;

// Global state for captured prompt event
let capturedPromptEvent: BeforeInstallPromptEvent | null = null;
let isAppInstalled = false;

/**
 * Type definition for beforeinstallprompt event
 */
export interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
}

/**
 * Capture the beforeinstallprompt event for later use.
 */
export function captureInstallPromptEvent(event: BeforeInstallPromptEvent): void {
  capturedPromptEvent = event;
}

/**
 * Check if we have a captured install prompt event.
 */
export function canPromptInstall(): boolean {
  return capturedPromptEvent !== null && !isAppInstalled;
}

/**
 * Record that the user dismissed the install prompt.
 */
export function recordDismissal(): void {
  if (typeof window === 'undefined') return;

  const now = Date.now();
  localStorage.setItem(DISMISSAL_KEY, now.toString());
}

/**
 * Check if the prompt was dismissed within the cooldown period.
 */
export function isDismissed(): boolean {
  if (typeof window === 'undefined') return false;

  const dismissedAt = localStorage.getItem(DISMISSAL_KEY);
  if (!dismissedAt) return false;

  const dismissalTime = parseInt(dismissedAt, 10);
  const now = Date.now();
  const timeSinceDismissal = now - dismissalTime;

  // If cooldown has expired, clear the dismissal
  if (timeSinceDismissal >= COOLDOWN_MS) {
    localStorage.removeItem(DISMISSAL_KEY);
    return false;
  }

  return true;
}

/**
 * Trigger the install prompt if available.
 * Returns the user's choice or null if no prompt is available.
 */
export async function triggerInstallPrompt(): Promise<'accepted' | 'dismissed' | null> {
  if (!capturedPromptEvent) {
    return null;
  }

  try {
    // Show the install prompt
    await capturedPromptEvent.prompt();

    // Wait for the user's choice
    const choiceResult = await capturedPromptEvent.userChoice;

    if (choiceResult.outcome === 'dismissed') {
      recordDismissal();
    }

    return choiceResult.outcome;
  } catch (error) {
    console.error('Error triggering install prompt:', error);
    return null;
  }
}

/**
 * Check if we should show the install prompt to the user.
 * Returns true if:
 * - We have a captured prompt event
 * - The app is not already installed
 * - The prompt was not dismissed within the cooldown period
 */
export function shouldShowPrompt(): boolean {
  return canPromptInstall() && !isDismissed();
}

/**
 * Mark the app as installed (hides future prompts).
 */
export function markAppInstalled(): void {
  isAppInstalled = true;
  capturedPromptEvent = null;

  // Clear any dismissal tracking
  if (typeof window !== 'undefined') {
    localStorage.removeItem(DISMISSAL_KEY);
  }
}

/**
 * Get time remaining in dismissal cooldown (in milliseconds).
 * Returns 0 if not dismissed or cooldown has expired.
 */
export function getCooldownRemaining(): number {
  if (!isDismissed()) return 0;

  const dismissedAt = localStorage.getItem(DISMISSAL_KEY);
  if (!dismissedAt) return 0;

  const dismissalTime = parseInt(dismissedAt, 10);
  const now = Date.now();
  const elapsed = now - dismissalTime;
  const remaining = COOLDOWN_MS - elapsed;

  return Math.max(0, remaining);
}

/**
 * Setup install prompt event listeners.
 * Should be called once when the app initializes.
 */
export function setupInstallPromptListeners(): () => void {
  if (typeof window === 'undefined') {
    return () => {
      // No-op for server-side rendering
    };
  }

  const handleBeforeInstallPrompt = (event: Event) => {
    // Prevent the mini-infobar from appearing on mobile
    event.preventDefault();

    // Capture the event for later use
    captureInstallPromptEvent(event as BeforeInstallPromptEvent);
  };

  const handleAppInstalled = () => {
    markAppInstalled();
  };

  window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
  window.addEventListener('appinstalled', handleAppInstalled);

  // Return cleanup function
  return () => {
    window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
    window.removeEventListener('appinstalled', handleAppInstalled);
  };
}
