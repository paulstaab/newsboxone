import { expect, test, type Page } from '@playwright/test';

const PROMPT_DELAY_MS = 5_500;

async function dispatchInstallPrompt(page: Page, outcome: 'accepted' | 'dismissed' = 'accepted') {
  await page.evaluate((choice) => {
    const dispatch = () => {
      const event = new Event('beforeinstallprompt', { cancelable: true });
      Object.defineProperties(event, {
        prompt: {
          value: () => Promise.resolve(),
        },
        userChoice: {
          value: Promise.resolve({ outcome: choice }),
        },
      });
      window.dispatchEvent(event);
    };

    window.setTimeout(dispatch, 100);
    window.setTimeout(dispatch, 300);
  }, outcome);
}

async function seedRememberedSession(page: Page) {
  await page.addInitScript(() => {
    localStorage.setItem(
      'newsboxone:session',
      JSON.stringify({
        username: 'test',
        token: 'test-token',
        expiresAt: '2026-04-30T00:00:00.000Z',
        rememberDevice: true,
      }),
    );
  });
}

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
    await page.waitForTimeout(PROMPT_DELAY_MS);
    await expect(page.getByRole('heading', { name: /install newsboxone/i })).toBeVisible();
  });

  test('[TC-APP-006] install prompt dismissal is persisted', async ({ page }) => {
    await dispatchInstallPrompt(page);
    await page.waitForTimeout(PROMPT_DELAY_MS);
    await page.getByRole('button', { name: /not now/i }).evaluate((element) => {
      (element as HTMLButtonElement).click();
    });
    await expect(page.getByRole('heading', { name: /install newsboxone/i })).toHaveCount(0);
    const dismissal = await page.evaluate(() => localStorage.getItem('pwa-install-dismissed'));
    expect(dismissal).toBeTruthy();
  });

  test('[TC-APP-007] install prompt cooldown is enforced', async ({ page }) => {
    await page.evaluate(() => {
      localStorage.setItem('pwa-install-dismissed', Date.now().toString());
    });
    await dispatchInstallPrompt(page);
    await page.waitForTimeout(PROMPT_DELAY_MS);
    await expect(page.getByRole('heading', { name: /install newsboxone/i })).toHaveCount(0);

    const eightDaysAgo = Date.now() - 8 * 24 * 60 * 60 * 1000;
    await page.evaluate((timestamp) => {
      localStorage.setItem('pwa-install-dismissed', timestamp.toString());
    }, eightDaysAgo);
    await page.reload();
    await dispatchInstallPrompt(page);
    await page.waitForTimeout(PROMPT_DELAY_MS);
    await expect(page.getByRole('heading', { name: /install newsboxone/i })).toBeVisible();
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
    await page.waitForTimeout(PROMPT_DELAY_MS);
    await expect(page.getByRole('heading', { name: /install newsboxone/i })).toBeVisible();
    await page.evaluate(() => {
      window.dispatchEvent(new Event('appinstalled'));
    });
    await expect(page.getByRole('heading', { name: /install newsboxone/i })).toHaveCount(0);
  });
});
