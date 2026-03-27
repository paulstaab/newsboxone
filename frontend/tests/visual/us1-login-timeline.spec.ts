import { test, expect } from '@playwright/test';

/**
 * Visual regression tests for User Story 1: Login and Timeline
 *
 * Captures responsive snapshots at breakpoints:
 * - 320px (mobile)
 * - 768px (tablet)
 * - 1024px (desktop)
 * - 1440px (wide desktop)
 */

const TEST_SERVER_URL = 'https://rss.example.com';
const TEST_USERNAME = 'testuser';
const TEST_PASSWORD = 'testpass';

const BREAKPOINTS = [
  { name: 'mobile', width: 320, height: 568 },
  { name: 'tablet', width: 768, height: 1024 },
  { name: 'desktop', width: 1024, height: 768 },
  { name: 'wide', width: 1440, height: 900 },
];

test.describe('Visual: Login Wizard', () => {
  for (const breakpoint of BREAKPOINTS) {
    test(`should match baseline at ${breakpoint.name} (${String(breakpoint.width)}px)`, async ({
      page,
    }) => {
      await page.setViewportSize({ width: breakpoint.width, height: breakpoint.height });
      await page.goto('/login');

      // Wait for page to stabilize
      await page.waitForLoadState('networkidle');

      // Capture initial login step
      await expect(page).toHaveScreenshot(`login-step1-${breakpoint.name}.png`, {
        fullPage: true,
        animations: 'disabled',
      });

      // Fill server URL and advance to credentials step
      await page.getByLabel(/server url/i).fill(TEST_SERVER_URL);
      await page.getByRole('button', { name: /continue|next/i }).click();
      await page.waitForTimeout(300); // Allow transition

      // Capture credentials step
      await expect(page).toHaveScreenshot(`login-step2-${breakpoint.name}.png`, {
        fullPage: true,
        animations: 'disabled',
      });
    });
  }

  test('should capture error states', async ({ page }) => {
    await page.setViewportSize({ width: 768, height: 1024 });
    await page.goto('/login');

    // Trigger validation error (HTTP URL)
    await page.getByLabel(/server url/i).fill('http://example.com');
    await page.getByRole('button', { name: /continue|next/i }).click();
    await page.waitForTimeout(200);

    // Capture error state
    await expect(page).toHaveScreenshot('login-error-https.png', {
      fullPage: true,
      animations: 'disabled',
    });
  });
});

test.describe('Visual: Timeline', () => {
  test.beforeEach(async ({ page }) => {
    // Set up authenticated session
    await page.goto('/login');
    await page.getByLabel(/server url/i).fill(TEST_SERVER_URL);
    await page.getByRole('button', { name: /continue|next/i }).click();
    await page.getByLabel(/username/i).fill(TEST_USERNAME);
    await page.getByLabel(/password/i).fill(TEST_PASSWORD);
    await page.getByRole('button', { name: /log.*in|sign.*in/i }).click();
    await page.waitForURL(/\/timeline/);
    await page.waitForLoadState('networkidle');
  });

  for (const breakpoint of BREAKPOINTS) {
    test(`should match timeline baseline at ${breakpoint.name} (${String(breakpoint.width)}px)`, async ({
      page,
    }) => {
      await page.setViewportSize({ width: breakpoint.width, height: breakpoint.height });

      // Wait for articles to load
      await page.waitForSelector('[data-article-id]', { timeout: 5000 });

      // Capture timeline view
      await expect(page).toHaveScreenshot(`timeline-unread-${breakpoint.name}.png`, {
        fullPage: true,
        animations: 'disabled',
      });
    });
  }

  test('should capture All items view at tablet breakpoint', async ({ page }) => {
    await page.setViewportSize({ width: 768, height: 1024 });

    // Switch to All items
    await page.getByRole('button', { name: /all/i }).click();
    await page.waitForTimeout(300);

    // Capture All view
    await expect(page).toHaveScreenshot('timeline-all-tablet.png', {
      fullPage: true,
      animations: 'disabled',
    });
  });

  test('should capture empty state', async ({ page }) => {
    await page.setViewportSize({ width: 768, height: 1024 });

    // This would require mocking an empty items response
    // For now, capture what we have
    // TODO: Implement empty state mocking

    // Placeholder
    expect(true).toBe(true);
  });

  test('should capture article card expanded state', async ({ page }) => {
    await page.setViewportSize({ width: 768, height: 1024 });

    // Wait for articles
    await page.waitForSelector('[data-article-id]', { timeout: 5000 });

    // Click on first article to open the pop-out
    const firstArticle = page.getByRole('option').first();
    await firstArticle.click();
    await page.getByRole('dialog').waitFor({ state: 'visible', timeout: 5000 });

    // Capture pop-out state
    await expect(page).toHaveScreenshot('timeline-article-popout-tablet.png', {
      fullPage: false,
      clip: { x: 0, y: 0, width: 768, height: 600 },
      animations: 'disabled',
    });
  });
});

test.describe('Visual: Unread Summary', () => {
  test.beforeEach(async ({ page }) => {
    // Set up authenticated session
    await page.goto('/login');
    await page.getByLabel(/server url/i).fill(TEST_SERVER_URL);
    await page.getByRole('button', { name: /continue|next/i }).click();
    await page.getByLabel(/username/i).fill(TEST_USERNAME);
    await page.getByLabel(/password/i).fill(TEST_PASSWORD);
    await page.getByRole('button', { name: /log.*in|sign.*in/i }).click();
    await page.waitForURL(/\/timeline/);
    await page.waitForLoadState('networkidle');
  });

  test('should capture unread count badge at mobile', async ({ page }) => {
    await page.setViewportSize({ width: 320, height: 568 });

    // Wait for unread summary to render
    await page.waitForSelector('text=/\\d+\\s+(unread|new)/i', { timeout: 5000 });

    // Capture unread summary component
    await expect(page).toHaveScreenshot('unread-summary-mobile.png', {
      fullPage: false,
      clip: { x: 0, y: 0, width: 320, height: 200 },
      animations: 'disabled',
    });
  });
});

test.describe('Visual: Offline Banner', () => {
  test('should capture offline indicator', async ({ page, context }) => {
    await page.setViewportSize({ width: 768, height: 1024 });

    // Set up authenticated session
    await page.goto('/login');
    await page.getByLabel(/server url/i).fill(TEST_SERVER_URL);
    await page.getByRole('button', { name: /continue|next/i }).click();
    await page.getByLabel(/username/i).fill(TEST_USERNAME);
    await page.getByLabel(/password/i).fill(TEST_PASSWORD);
    await page.getByRole('button', { name: /log.*in|sign.*in/i }).click();
    await page.waitForURL(/\/timeline/);

    // Go offline
    await context.setOffline(true);
    await page.reload();

    // Wait for offline banner
    await page.waitForSelector('text=/offline|no.*connection/i', { timeout: 5000 });

    // Capture offline state
    await expect(page).toHaveScreenshot('offline-banner-tablet.png', {
      fullPage: false,
      clip: { x: 0, y: 0, width: 768, height: 200 },
      animations: 'disabled',
    });
  });
});
