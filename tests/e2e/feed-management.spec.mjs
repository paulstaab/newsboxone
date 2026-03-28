import test from '../../frontend/node_modules/@playwright/test/index.js';
import {
  FEED_URLS,
  addFeedViaUi,
  clearBrowserSession,
  createFolderViaUi,
  loginViaUi,
  resetBackendState,
} from './helpers/newsboxone.mjs';

const { expect } = test;

test.describe('Feed onboarding and management e2e scenarios', () => {
  test.beforeEach(async ({ page, request }) => {
    await resetBackendState(request);
    await clearBrowserSession(page);
    await loginViaUi(page);
    await page.goto('/feeds');
    await expect(
      page.getByRole('heading', { name: /manage subscriptions and folders/i }),
    ).toBeVisible();
  });

  test('[TS-FEED-MGMT-001] reader adds feeds and receives initial items', async ({ page }) => {
    await addFeedViaUi(page, FEED_URLS.engineering);
    await addFeedViaUi(page, FEED_URLS.design);

    await page.goto('/timeline');
    await expect(page.getByRole('link', { name: /open engineering launch brief/i })).toBeVisible();
  });

  test('[TS-FEED-MGMT-002] reader adds feeds into a folder', async ({ page }) => {
    await createFolderViaUi(page, 'Engineering');
    await addFeedViaUi(page, FEED_URLS.engineering, 'Engineering');
    await addFeedViaUi(page, FEED_URLS.design);

    await page.goto('/feeds');
    await expect(page.getByRole('heading', { name: 'Engineering', exact: true })).toBeVisible();
    await expect(page.getByRole('heading', { name: 'Uncategorized' })).toBeVisible();

    await page.goto('/timeline');
    await expect(page.getByTestId('active-folder-name')).toHaveText(/engineering/i);
  });

  test('[TS-FEED-MGMT-003] duplicate feed add is prevented', async ({ page }) => {
    await addFeedViaUi(page, FEED_URLS.engineering);

    const dialog = page.getByRole('dialog');
    await page.getByRole('button', { name: /add feed/i }).click();
    await expect(dialog).toBeVisible();
    await page.getByLabel(/^feed url$/i).fill(FEED_URLS.engineering);
    await page.getByRole('button', { name: /^subscribe$/i }).click();

    await expect(page.getByText(/api error 409: conflict/i)).toBeVisible();
    await expect(page.getByRole('heading', { name: 'Engineering Daily' })).toHaveCount(1);
  });

  test('[TS-FEED-MGMT-004] reader reorganizes subscriptions', async ({ page }) => {
    await createFolderViaUi(page, 'Engineering');
    await createFolderViaUi(page, 'Archive');
    await addFeedViaUi(page, FEED_URLS.engineering, 'Engineering');

    await page.getByRole('button', { name: /rename folder engineering/i }).click();
    await page.getByLabel(/^folder name$/i).fill('Platform');
    await page.getByRole('button', { name: /^save$/i }).first().click();
    await expect(page.getByRole('heading', { name: 'Platform' })).toBeVisible();

    await page.getByRole('button', { name: /rename feed engineering daily/i }).click();
    await page.getByLabel(/feed name for engineering daily/i).fill('Platform Digest');
    await page.getByRole('button', { name: /^save$/i }).last().click();
    await expect(page.getByRole('heading', { name: 'Platform Digest', exact: true })).toBeVisible();

    await page.getByRole('button', { name: /move platform digest to another folder/i }).click();
    await page.getByLabel(/^target folder$/i).selectOption({ label: 'Archive' });
    await page.getByRole('button', { name: /^move feed$/i }).click();
    await expect(page.getByRole('heading', { name: 'Archive' })).toBeVisible();

    await page.getByRole('button', { name: /move platform digest to another folder/i }).click();
    await page.getByLabel(/^target folder$/i).selectOption({ label: 'Uncategorized' });
    await page.getByRole('button', { name: /^move feed$/i }).click();
    await expect(page.getByRole('heading', { name: 'Uncategorized' })).toBeVisible();
  });

  test('[TS-FEED-MGMT-005] reader deletes a feed and its items', async ({ page }) => {
    await addFeedViaUi(page, FEED_URLS.engineering);

    await page.goto('/timeline');
    await expect(page.getByRole('link', { name: /open engineering launch brief/i })).toBeVisible();

    await page.goto('/feeds');
    page.once('dialog', (dialog) => dialog.accept());
    await page.getByRole('button', { name: /delete feed engineering daily/i }).click();
    await expect(page.getByRole('heading', { name: 'Engineering Daily' })).toHaveCount(0);

    await page.goto('/timeline');
    await page.getByRole('button', { name: /^refresh$/i }).click();
    await expect(page.getByRole('link', { name: /open engineering launch brief/i })).toHaveCount(0);
    await expect(page.getByRole('heading', { name: /all caught up/i })).toBeVisible();
  });

  test('[TS-FEED-MGMT-006] reader deletes a folder and cascades assigned feeds', async ({
    page,
  }) => {
    await createFolderViaUi(page, 'Engineering');
    await addFeedViaUi(page, FEED_URLS.engineering, 'Engineering');
    await addFeedViaUi(page, FEED_URLS.design);

    page.once('dialog', (dialog) => dialog.accept());
    await page.getByRole('button', { name: /delete folder engineering/i }).click();

    await expect(page.getByRole('heading', { name: 'Engineering' })).toHaveCount(0);
    await expect(page.getByText('Engineering Daily')).toHaveCount(0);
    await expect(page.getByText('Design Weekly')).toBeVisible();
  });
});
