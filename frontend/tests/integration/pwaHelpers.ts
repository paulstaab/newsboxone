import { expect, type Page } from '@playwright/test';

export async function dispatchInstallPrompt(
  page: Page,
  outcome: 'accepted' | 'dismissed' = 'accepted',
) {
  await page.getByRole('button', { name: /burger menu/i }).waitFor({ state: 'visible' });
  await page.evaluate((choice) => {
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
  }, outcome);
}

export async function expectInstallPromptVisible(page: Page) {
  await expect(page.getByRole('heading', { name: /install newsboxone/i })).toBeVisible();
}

export async function expectInstallPromptHidden(page: Page) {
  await expect(page.getByRole('heading', { name: /install newsboxone/i })).toHaveCount(0);
}

export async function showInstallPrompt(page: Page) {
  await page.evaluate(() => {
    localStorage.removeItem('pwa-install-dismissed');
  });
  await dispatchInstallPrompt(page);
  await expectInstallPromptVisible(page);
}

export async function seedRememberedSession(page: Page) {
  await page.addInitScript(() => {
    const expiresAt = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString();
    localStorage.setItem(
      'newsboxone:session',
      JSON.stringify({
        username: 'test',
        token: 'test-token',
        expiresAt,
        rememberDevice: true,
      }),
    );
  });
}
