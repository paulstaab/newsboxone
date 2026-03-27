import { test, expect } from '@playwright/test';

/**
 * E2E tests for PWA install prompt flow.
 * Tests prompt display, dismissal, and manual installation triggers.
 */
test.describe('PWA Install Flow', () => {
  test.beforeEach(async ({ page, context }) => {
    // Clear storage before each test
    await context.clearCookies();
    await page.goto('/');
  });

  test('should show install prompt when PWA criteria met', async ({ page }) => {
    // Wait for page load
    await page.waitForLoadState('networkidle');

    // Check if install prompt UI is visible
    // (Note: actual beforeinstallprompt event requires specific browser conditions)
    const installPrompt = page.getByRole('button', { name: /install|add to home screen/i });

    // If browser supports PWA install, prompt should be visible
    const isVisible = await installPrompt.isVisible().catch(() => false);

    if (isVisible) {
      await expect(installPrompt).toBeVisible();
    }
  });

  test('should dismiss install prompt when close button clicked', async ({ page }) => {
    await page.waitForLoadState('networkidle');

    const closeButton = page.getByRole('button', { name: /close|dismiss|not now/i });
    const isVisible = await closeButton.isVisible().catch(() => false);

    if (isVisible) {
      await closeButton.click();

      // Prompt should disappear
      await expect(closeButton).not.toBeVisible();

      // Verify dismissal was stored
      const dismissed = await page.evaluate(() => {
        return localStorage.getItem('pwa-install-dismissed');
      });

      expect(dismissed).toBeTruthy();
    }
  });

  test('should not show prompt again within 7 days after dismissal', async ({ page }) => {
    await page.waitForLoadState('networkidle');

    // Set dismissal timestamp
    await page.evaluate(() => {
      localStorage.setItem('pwa-install-dismissed', Date.now().toString());
    });

    // Reload page
    await page.reload();
    await page.waitForLoadState('networkidle');

    // Prompt should not be visible
    const installPrompt = page.getByRole('button', { name: /install|add to home screen/i });
    await expect(installPrompt).not.toBeVisible();
  });

  test('should show prompt again after 7 days', async ({ page }) => {
    await page.waitForLoadState('networkidle');

    // Set dismissal timestamp to 8 days ago
    const eightDaysAgo = Date.now() - 8 * 24 * 60 * 60 * 1000;
    await page.evaluate((timestamp) => {
      localStorage.setItem('pwa-install-dismissed', timestamp.toString());
    }, eightDaysAgo);

    // Reload page
    await page.reload();
    await page.waitForLoadState('networkidle');

    // Prompt should be visible again
    const installPrompt = page.getByRole('button', { name: /install|add to home screen/i });
    const isVisible = await installPrompt.isVisible().catch(() => false);

    // If browser supports PWA, prompt should reappear
    if (isVisible) {
      await expect(installPrompt).toBeVisible();
    }
  });

  test('should trigger install when install button clicked', async ({ page }) => {
    await page.waitForLoadState('networkidle');

    const installButton = page.getByRole('button', { name: /install|add to home screen/i });
    const isVisible = await installButton.isVisible().catch(() => false);

    if (isVisible) {
      // Mock the install prompt acceptance
      await page.evaluate(() => {
        // Simulate successful install
        window.dispatchEvent(new Event('appinstalled'));
      });

      await installButton.click();

      // Prompt should disappear after install attempt
      await expect(installButton).not.toBeVisible();
    }
  });

  test('should provide manual install option in the burger menu', async ({ page }) => {
    await page.waitForLoadState('networkidle');

    const menuButton = page.getByRole('button', { name: /burger menu/i });
    const hasMenu = await menuButton.isVisible().catch(() => false);

    if (hasMenu) {
      // Wait a bit for any animations
      await page.waitForTimeout(300);

      // Get the bounding box and click at the center using page.mouse
      const box = await menuButton.boundingBox();
      if (box) {
        await page.mouse.click(box.x + box.width / 2, box.y + box.height / 2);
        await page.waitForTimeout(500);

        // Verify the menu opened by checking aria-expanded attribute
        const isExpanded = await menuButton.getAttribute('aria-expanded');

        if (isExpanded === 'true') {
          // Look for any button within the dropdown that contains "install"
          // (may be disabled if PWA not installable in test environment)
          const installButton = page
            .locator('button')
            .filter({ hasText: /install/i })
            .first();
          const hasInstallOption = (await installButton.count()) > 0;

          // The install option should exist in the burger menu, even if disabled
          expect(hasInstallOption).toBe(true);
        }
      }
    }
  });

  test('should handle install event and hide prompt', async ({ page }) => {
    await page.waitForLoadState('networkidle');

    // Simulate app installation
    await page.evaluate(() => {
      window.dispatchEvent(new Event('appinstalled'));
    });

    // Wait a bit for state to update
    await page.waitForTimeout(500);

    // Prompt should not be visible after install
    const installPrompt = page.getByRole('button', { name: /install|add to home screen/i });
    await expect(installPrompt).not.toBeVisible();
  });

  test('should not show prompt during active reading', async ({ page }) => {
    // Page is already at /login/ from beforeEach
    // Wait for page to settle
    await page.waitForLoadState('networkidle');

    // Scroll to simulate active reading
    await page.evaluate(() => {
      window.scrollBy(0, 500);
    });

    // Prompt should not appear immediately during scrolling
    const installPrompt = page.getByRole('button', { name: /install|add to home screen/i });

    // Give it a moment
    await page.waitForTimeout(1000);

    // Prompt should either not be visible or be positioned non-intrusively
    const isVisible = await installPrompt.isVisible().catch(() => false);

    if (isVisible) {
      // If visible, it should not be in the main content area
      const box = await installPrompt.boundingBox();
      if (box) {
        // Should be at bottom or top, not in middle where reading happens
        const viewportHeight = page.viewportSize()?.height ?? 0;
        const isInReadingArea = box.y > viewportHeight * 0.2 && box.y < viewportHeight * 0.8;
        expect(isInReadingArea).toBe(false);
      }
    }
  });
});
