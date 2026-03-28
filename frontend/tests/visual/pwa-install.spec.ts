import { test, expect } from '@playwright/test';

/**
 * Visual regression tests for PWA install prompt UI.
 * Captures baselines at different breakpoints and states.
 */
test.describe('PWA Install Prompt Visual Regression', () => {
  test.beforeEach(async ({ page, context }) => {
    await context.clearCookies();
    await page.goto('/');
  });

  test('install prompt at mobile breakpoint (320px)', async ({ page }) => {
    await page.setViewportSize({ width: 320, height: 568 });
    await page.waitForLoadState('networkidle');

    // Force prompt to show for screenshot
    await page.evaluate(() => {
      localStorage.removeItem('pwa-install-dismissed');
    });

    // Wait for any animations
    await page.waitForTimeout(500);

    await expect(page).toHaveScreenshot('install-prompt-mobile-320px.png', {
      fullPage: true,
    });
  });

  test('install prompt at tablet breakpoint (768px)', async ({ page }) => {
    await page.setViewportSize({ width: 768, height: 1024 });
    await page.waitForLoadState('networkidle');

    await page.evaluate(() => {
      localStorage.removeItem('pwa-install-dismissed');
    });

    await page.waitForTimeout(500);

    await expect(page).toHaveScreenshot('install-prompt-tablet-768px.png', {
      fullPage: true,
    });
  });

  test('install prompt at desktop breakpoint (1024px)', async ({ page }) => {
    await page.setViewportSize({ width: 1024, height: 768 });
    await page.waitForLoadState('networkidle');

    await page.evaluate(() => {
      localStorage.removeItem('pwa-install-dismissed');
    });

    await page.waitForTimeout(500);

    await expect(page).toHaveScreenshot('install-prompt-desktop-1024px.png', {
      fullPage: true,
    });
  });

  test('install prompt at large desktop breakpoint (1440px)', async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.waitForLoadState('networkidle');

    await page.evaluate(() => {
      localStorage.removeItem('pwa-install-dismissed');
    });

    await page.waitForTimeout(500);

    await expect(page).toHaveScreenshot('install-prompt-desktop-1440px.png', {
      fullPage: true,
    });
  });

  test('install prompt hover state', async ({ page }) => {
    await page.setViewportSize({ width: 1024, height: 768 });
    await page.waitForLoadState('networkidle');

    await page.evaluate(() => {
      localStorage.removeItem('pwa-install-dismissed');
    });

    const installButton = page.getByRole('button', { name: /install|add to home screen/i });
    const isVisible = await installButton.isVisible().catch(() => false);

    if (isVisible) {
      await installButton.hover();
      await page.waitForTimeout(200);

      await expect(page).toHaveScreenshot('install-prompt-hover.png', {
        fullPage: true,
      });
    }
  });

  test('install prompt focus state', async ({ page }) => {
    await page.setViewportSize({ width: 1024, height: 768 });
    await page.waitForLoadState('networkidle');

    await page.evaluate(() => {
      localStorage.removeItem('pwa-install-dismissed');
    });

    const installButton = page.getByRole('button', { name: /install|add to home screen/i });
    const isVisible = await installButton.isVisible().catch(() => false);

    if (isVisible) {
      await installButton.focus();
      await page.waitForTimeout(200);

      await expect(page).toHaveScreenshot('install-prompt-focus.png', {
        fullPage: true,
      });
    }
  });

  test('install prompt dismissed state', async ({ page }) => {
    await page.setViewportSize({ width: 1024, height: 768 });
    await page.waitForLoadState('networkidle');

    await page.evaluate(() => {
      localStorage.setItem('pwa-install-dismissed', Date.now().toString());
    });

    await page.reload();
    await page.waitForLoadState('networkidle');

    // Should not show prompt
    await expect(page).toHaveScreenshot('install-prompt-dismissed.png', {
      fullPage: true,
    });
  });

  test('install prompt in timeline context', async ({ page }) => {
    await page.setViewportSize({ width: 1024, height: 768 });

    // Navigate to timeline
    await page.goto('/timeline');
    await page.waitForLoadState('networkidle');

    await page.evaluate(() => {
      localStorage.removeItem('pwa-install-dismissed');
    });

    await page.waitForTimeout(500);

    // Capture how prompt appears in context of timeline
    await expect(page).toHaveScreenshot('install-prompt-timeline-context.png', {
      fullPage: false, // Just viewport to show positioning
    });
  });
});
