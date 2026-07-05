import { test, expect } from '@playwright/test';
import { VIEWPORTS } from '../integration/constants';
import { setupApiMocks } from '../integration/mocks';
import { seedRememberedSession } from '../integration/pwaHelpers';

const LOGIN_VIEWPORTS = [
  ['mobile', VIEWPORTS.mobile],
  ['tablet', VIEWPORTS.tablet],
  ['desktop', VIEWPORTS.desktop],
  ['wide', VIEWPORTS.largeDesktop],
] as const;

test.describe('Visual: Current Login', () => {
  for (const [name, viewport] of LOGIN_VIEWPORTS) {
    test(`login form at ${name}`, async ({ page }) => {
      await page.setViewportSize(viewport);
      await page.goto('/login');
      await expect(page.getByRole('heading', { name: /welcome to newsboxone/i })).toBeVisible();
      await expect(page.getByLabel(/username/i)).toBeVisible();
      await expect(page).toHaveScreenshot(`login-current-${name}.png`, {
        fullPage: true,
        animations: 'disabled',
        maxDiffPixelRatio: 0.05,
      });
    });
  }
});

test.describe('Visual: Mocked Timeline', () => {
  test.beforeEach(async ({ page }) => {
    await setupApiMocks(page);
    await seedRememberedSession(page);
  });

  for (const [name, viewport] of LOGIN_VIEWPORTS) {
    test(`timeline at ${name}`, async ({ page }) => {
      await page.setViewportSize(viewport);
      await page.goto('/timeline');
      await expect(page.getByRole('region', { name: /timeline/i })).toBeVisible();
      await expect(page.locator('[data-article-id]').first()).toBeVisible();
      await expect(page).toHaveScreenshot(`timeline-current-${name}.png`, {
        fullPage: true,
        animations: 'disabled',
        maxDiffPixelRatio: 0.05,
      });
    });
  }

  test('article popout at tablet', async ({ page }) => {
    await page.setViewportSize(VIEWPORTS.tablet);
    await page.goto('/timeline');
    await expect(page.locator('[data-article-id]').first()).toBeVisible();
    await page.getByRole('option').first().click();
    await expect(page.getByRole('dialog')).toBeVisible();
    await expect(page).toHaveScreenshot('timeline-current-article-popout-tablet.png', {
      fullPage: false,
      animations: 'disabled',
    });
  });
});
