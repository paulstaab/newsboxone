import { expect, test } from '@playwright/test';
import { setupApiMocks } from './mocks';

const storageStatePath = 'tests/integration/.auth/user.json';

test.describe('Feed management integration coverage', () => {
  test.use({ storageState: storageStatePath });

  test.beforeEach(async ({ page }) => {
    await setupApiMocks(page);
  });

  test('[TC-FEEDS-002] shared burger menu orders timeline before feed management', async ({
    page,
  }) => {
    await page.goto('/timeline');
    await page.getByRole('button', { name: /burger menu/i }).click();
    await expect(page.getByRole('menuitem').first()).toHaveText(/timeline/i);
    await expect(page.getByRole('menuitem').nth(1)).toHaveText(/feed management/i);
    await page.getByRole('menuitem', { name: /feed management/i }).click();
    await page.waitForURL(/\/feeds/);
    await expect(
      page.getByRole('heading', { name: /manage subscriptions and folders/i }),
    ).toBeVisible();
  });

  test('[TC-FEEDS-003] feed creation entry points open the subscription modal', async ({
    page,
  }) => {
    await page.goto('/feeds');

    await page.getByRole('button', { name: /add feed/i }).click();
    await expect(
      page.getByRole('heading', { name: /add a feed to your reading queue/i }),
    ).toBeVisible();
    await page.getByRole('button', { name: /^cancel$/i }).click();

    await page.keyboard.press('+');
    await expect(
      page.getByRole('heading', { name: /add a feed to your reading queue/i }),
    ).toBeVisible();
  });

  test('[TC-FEEDS-004] feed table shows compact relative metadata and status icons', async ({
    page,
  }) => {
    await page.goto('/feeds');

    const feedTable = page.getByRole('table', { name: /feed management table/i });
    const podStackRow = feedTable.getByRole('row', { name: /the pod stack/i });

    await expect(feedTable.getByRole('columnheader', { name: /feed name/i })).toBeVisible();
    await expect(feedTable.getByRole('columnheader', { name: /last article/i })).toBeVisible();
    await expect(feedTable.getByRole('columnheader', { name: /next update/i })).toBeVisible();
    await expect(feedTable.getByRole('columnheader', { name: /status/i })).toBeVisible();
    await expect(feedTable.getByRole('columnheader', { name: /actions/i })).toBeVisible();

    const lastArticleValue = podStackRow.getByText(/hours ago/i);
    const nextUpdateValue = podStackRow.getByText(/in (?:\d+ )?(?:minute|minutes|hour|hours)/i);

    await expect(lastArticleValue).toBeVisible();
    await expect(nextUpdateValue).toBeVisible();
    await expect(lastArticleValue).toHaveAttribute('title', /\d{4}-\d{2}-\d{2}/);
    await expect(nextUpdateValue).toHaveAttribute('title', /\d{4}-\d{2}-\d{2}/);
    await expect(podStackRow.getByText('https://podcasts.example.com/rss')).toBeVisible();
    await expect(podStackRow.getByLabel(/update error: connection timeout/i)).toHaveAttribute(
      'title',
      'Connection timeout',
    );
    await expect(feedTable.getByLabel('Feed healthy').first()).toBeVisible();
  });
});
