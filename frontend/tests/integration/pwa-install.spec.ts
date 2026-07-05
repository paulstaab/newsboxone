import { expect, test } from '@playwright/test';
import {
  dispatchInstallPrompt,
  expectInstallPromptHidden,
  expectInstallPromptVisible,
  seedRememberedSession,
} from './pwaHelpers';

test.describe('PWA install integration coverage', () => {
  test.beforeEach(async ({ page, context }) => {
    await context.clearCookies();
    await page.goto('/login');
    await page.evaluate(() => {
      sessionStorage.clear();
      localStorage.clear();
    });
  });

  test('[TC-APP-005] install prompt can appear when install criteria are met', async ({ page }) => {
    await dispatchInstallPrompt(page);
    await expectInstallPromptVisible(page);
  });

  test('[TC-APP-006] install prompt dismissal is persisted', async ({ page }) => {
    await dispatchInstallPrompt(page);
    await expectInstallPromptVisible(page);
    await page.getByRole('button', { name: /not now/i }).click();
    await expectInstallPromptHidden(page);
    const dismissal = await page.evaluate(() => localStorage.getItem('pwa-install-dismissed'));
    expect(dismissal).toBeTruthy();
  });

  test('[TC-APP-007] install prompt cooldown is enforced', async ({ page }) => {
    await page.evaluate(() => {
      localStorage.setItem('pwa-install-dismissed', Date.now().toString());
    });
    await dispatchInstallPrompt(page);
    await expectInstallPromptHidden(page);

    const eightDaysAgo = Date.now() - 8 * 24 * 60 * 60 * 1000;
    await page.evaluate((timestamp) => {
      localStorage.setItem('pwa-install-dismissed', timestamp.toString());
    }, eightDaysAgo);
    await page.reload();
    await dispatchInstallPrompt(page);
    await expectInstallPromptVisible(page);
  });

  test('[TC-APP-008] burger menu exposes manual install entry', async ({ page }) => {
    await seedRememberedSession(page);
    await page.goto('/timeline');
    await dispatchInstallPrompt(page);
    await page.getByRole('button', { name: /burger menu/i }).click();
    await expect(page.getByRole('menuitem', { name: /install/i })).toBeVisible();
  });

  test('[TC-APP-009] install state reacts to appinstalled', async ({ page }) => {
    await dispatchInstallPrompt(page);
    await expectInstallPromptVisible(page);
    await page.evaluate(() => {
      window.dispatchEvent(new Event('appinstalled'));
    });
    await expectInstallPromptHidden(page);
  });
});
