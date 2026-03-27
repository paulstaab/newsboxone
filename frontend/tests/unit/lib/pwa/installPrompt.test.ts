import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

/**
 * Install prompt detection and dismissal tracking tests.
 * Tests PWA install prompt state management and 7-day cooldown logic.
 */
describe('PWA Install Prompt', () => {
  beforeEach(() => {
    // Reset modules to clear module-level state (capturedPromptEvent)
    vi.resetModules();
    // Clear localStorage before each test
    localStorage.clear();
    // Reset timers
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  describe('prompt detection', () => {
    it('should detect beforeinstallprompt event', async () => {
      // Dynamic import to avoid module-level execution
      const { canPromptInstall, captureInstallPromptEvent } =
        await import('@/lib/pwa/installPrompt');

      expect(canPromptInstall()).toBe(false);

      // Simulate beforeinstallprompt event
      const mockEvent = new Event('beforeinstallprompt') as BeforeInstallPromptEvent;
      Object.defineProperty(mockEvent, 'prompt', { value: vi.fn(), writable: true });
      Object.defineProperty(mockEvent, 'userChoice', {
        value: Promise.resolve({ outcome: 'accepted' }),
        writable: true,
      });

      captureInstallPromptEvent(mockEvent);

      expect(canPromptInstall()).toBe(true);
    });

    it('should return false if no event captured', async () => {
      const { canPromptInstall } = await import('@/lib/pwa/installPrompt');
      expect(canPromptInstall()).toBe(false);
    });
  });

  describe('dismissal tracking', () => {
    it('should track dismissal in localStorage', async () => {
      const { recordDismissal, isDismissed } = await import('@/lib/pwa/installPrompt');

      expect(isDismissed()).toBe(false);

      recordDismissal();

      expect(isDismissed()).toBe(true);
      expect(localStorage.getItem('pwa-install-dismissed')).toBeTruthy();
    });

    it('should enforce 7-day cooldown after dismissal', async () => {
      const { recordDismissal, isDismissed } = await import('@/lib/pwa/installPrompt');

      const now = new Date('2025-12-12T12:00:00Z');
      vi.setSystemTime(now);

      recordDismissal();
      expect(isDismissed()).toBe(true);

      // 6 days later - still dismissed
      vi.setSystemTime(new Date('2025-12-18T12:00:00Z'));
      expect(isDismissed()).toBe(true);

      // 7 days later - no longer dismissed
      vi.setSystemTime(new Date('2025-12-19T12:00:01Z'));
      expect(isDismissed()).toBe(false);
    });

    it('should clear dismissal after 7 days', async () => {
      const { recordDismissal, isDismissed } = await import('@/lib/pwa/installPrompt');

      recordDismissal();
      expect(localStorage.getItem('pwa-install-dismissed')).toBeTruthy();

      // Advance time by 8 days
      const eightDaysMs = 8 * 24 * 60 * 60 * 1000;
      vi.advanceTimersByTime(eightDaysMs);

      expect(isDismissed()).toBe(false);
    });
  });

  describe('prompt triggering', () => {
    it('should trigger install prompt when conditions met', async () => {
      const { captureInstallPromptEvent, triggerInstallPrompt } =
        await import('@/lib/pwa/installPrompt');

      const mockPrompt = vi.fn().mockResolvedValue(undefined);
      const mockEvent = {
        prompt: mockPrompt,
        userChoice: Promise.resolve({ outcome: 'accepted' }),
      } as unknown as BeforeInstallPromptEvent;

      captureInstallPromptEvent(mockEvent);

      const result = await triggerInstallPrompt();

      expect(mockPrompt).toHaveBeenCalled();
      expect(result).toBe('accepted');
    });

    it('should return null if no prompt available', async () => {
      const { triggerInstallPrompt } = await import('@/lib/pwa/installPrompt');

      const result = await triggerInstallPrompt();

      expect(result).toBeNull();
    });

    it('should handle user dismissal outcome', async () => {
      const { captureInstallPromptEvent, triggerInstallPrompt } =
        await import('@/lib/pwa/installPrompt');

      const mockEvent = {
        prompt: vi.fn().mockResolvedValue(undefined),
        userChoice: Promise.resolve({ outcome: 'dismissed' }),
      } as unknown as BeforeInstallPromptEvent;

      captureInstallPromptEvent(mockEvent);

      const result = await triggerInstallPrompt();

      expect(result).toBe('dismissed');
    });
  });

  describe('should prompt logic', () => {
    it('should not prompt if dismissed within 7 days', async () => {
      const { recordDismissal, shouldShowPrompt, captureInstallPromptEvent } =
        await import('@/lib/pwa/installPrompt');

      const mockEvent = new Event('beforeinstallprompt') as BeforeInstallPromptEvent;
      captureInstallPromptEvent(mockEvent);

      recordDismissal();

      expect(shouldShowPrompt()).toBe(false);
    });

    it('should not prompt if no install event captured', async () => {
      const { shouldShowPrompt } = await import('@/lib/pwa/installPrompt');

      expect(shouldShowPrompt()).toBe(false);
    });

    it('should prompt if conditions met and not dismissed', async () => {
      const { shouldShowPrompt, captureInstallPromptEvent } =
        await import('@/lib/pwa/installPrompt');

      const mockEvent = new Event('beforeinstallprompt') as BeforeInstallPromptEvent;
      captureInstallPromptEvent(mockEvent);

      expect(shouldShowPrompt()).toBe(true);
    });
  });
});

// Type definition for beforeinstallprompt event
interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
}
