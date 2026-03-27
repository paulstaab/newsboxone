import { test, expect, type Page } from '@playwright/test';
import { setupApiMocks } from '../integration/mocks';

const TEST_USERNAME = 'test';
const TEST_PASSWORD = 'test';

const BREAKPOINTS = [
  { name: 'mobile', width: 320, height: 568 },
  { name: 'tablet', width: 768, height: 1024 },
  { name: 'desktop', width: 1024, height: 768 },
];

async function completeLogin(page: Page) {
  await page.goto('/login');
  await page.waitForLoadState('networkidle');
  await page.getByLabel(/username/i).fill(TEST_USERNAME);
  await page.getByLabel(/password/i).fill(TEST_PASSWORD);
  await page.getByRole('button', { name: /log.*in|sign.*in/i }).click();
  await page.waitForURL(/\/timeline/, { timeout: 10_000 });
}

test.describe('Visual: Timeline Folders', () => {
  test.beforeEach(async ({ page }) => {
    await setupApiMocks(page);
    await page.goto('/');
    await page.waitForURL(/\/login/);
    await page.evaluate(() => {
      sessionStorage.clear();
      localStorage.clear();
    });
  });

  for (const breakpoint of BREAKPOINTS) {
    test(`should match baseline at ${breakpoint.name} (${String(breakpoint.width)}px)`, async ({
      page,
    }) => {
      await page.setViewportSize({ width: breakpoint.width, height: breakpoint.height });
      await completeLogin(page);

      // 1. Default Folder View (Header, Mark Read, Skip, Articles)
      await expect(page.getByTestId('active-folder-name')).toBeVisible();
      // Wait for articles to load
      await expect(page.getByText('Ship It Saturday: Folder Queue')).toBeVisible();

      await expect(page).toHaveScreenshot(`timeline-folder-default-${breakpoint.name}.png`, {
        fullPage: true,
        animations: 'disabled',
        mask: [page.getByTestId('active-folder-unread')], // Mask dynamic counts if needed, but they should be stable with mocks
      });
    });
  }

  test('all-read state visual', async ({ page }) => {
    await page.route('**/api/items**', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ items: [] }),
      });
    });

    await page.setViewportSize({ width: 375, height: 667 }); // Mobile view for this state
    await completeLogin(page);

    await expect(page.getByRole('heading', { name: 'All caught up!' })).toBeVisible();

    await expect(page).toHaveScreenshot('timeline-all-caught-up-mobile.png', {
      fullPage: true,
      animations: 'disabled',
    });
  });
});
