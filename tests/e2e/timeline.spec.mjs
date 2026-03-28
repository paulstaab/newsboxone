import test from '../../frontend/node_modules/@playwright/test/index.js';
import {
  clearBrowserSession,
  loginViaUi,
  resetBackendState,
  seedTimelineFeeds,
} from './helpers/newsboxone.mjs';

const { expect } = test;

test.describe('Timeline and reading workflow e2e scenarios', () => {
  test.beforeEach(async ({ page, request }) => {
    await resetBackendState(request);
    await clearBrowserSession(page);
  });

  test('[TS-TIMELINE-001] highest-priority folder is shown first', async ({ page, request }) => {
    await seedTimelineFeeds(request);
    await loginViaUi(page);
    await expect(page.getByTestId('active-folder-name')).toHaveText(/engineering/i);
    await expect(page.getByRole('link', { name: /open engineering launch brief/i })).toBeVisible();
    await expect(page.getByText(/design systems review/i)).toHaveCount(0);
  });

  test('[TS-TIMELINE-002] reader marks a folder read and advances', async ({
    page,
    request,
  }) => {
    await seedTimelineFeeds(request);
    await loginViaUi(page);
    await page.getByRole('button', { name: /mark all read/i }).click();
    await expect(page.getByTestId('active-folder-name')).toHaveText(/design/i);
  });

  test('[TS-TIMELINE-003] reader skips folders and restarts the queue', async ({
    page,
    request,
  }) => {
    await seedTimelineFeeds(request);
    await loginViaUi(page);
    await page.getByRole('button', { name: /^skip$/i }).click();
    await page.getByRole('button', { name: /^skip$/i }).click();
    await expect(page.getByText(/all folders viewed/i)).toBeVisible();
    await page.getByRole('button', { name: /restart/i }).click();
    await expect(page.getByTestId('active-folder-name')).toHaveText(/engineering/i);
  });

  test('[TS-TIMELINE-004] reader opens an article without losing place', async ({
    page,
    request,
  }) => {
    await seedTimelineFeeds(request);
    await loginViaUi(page);
    await page.getByRole('option', { name: /engineering launch brief/i }).click();
    const articleDialog = page.getByRole('dialog');
    await expect(articleDialog).toBeVisible();
    await expect(articleDialog.getByText(/engineering launch brief summary/i)).toBeVisible();
    await page.getByRole('button', { name: /close article/i }).click();
    await expect(page.getByRole('link', { name: /open engineering launch brief/i })).toBeVisible();
  });

  test('[TS-TIMELINE-005] keyboard shortcuts drive refresh, skip, and mark all read', async ({
    page,
    request,
  }) => {
    await seedTimelineFeeds(request);
    await loginViaUi(page);
    await expect(page.getByTestId('active-folder-name')).toHaveText(/engineering/i);
    await expect(page.getByRole('dialog')).toHaveCount(0);
    await page.evaluate(() => {
      const activeElement = document.activeElement;
      if (activeElement instanceof HTMLElement) {
        activeElement.blur();
      }
      window.focus();
    });
    await page.keyboard.press('r');
    const refreshButton = page.getByRole('button', { name: /refresh/i });
    await expect(refreshButton).toBeDisabled();
    await expect(refreshButton).toBeEnabled();
    await page.keyboard.press('ArrowRight');
    await expect(page.getByTestId('active-folder-name')).toHaveText(/design/i);
    await page.keyboard.press('Enter');
    await expect(page.getByRole('heading', { name: /all folders viewed/i })).toBeVisible();
  });

  test('[TS-TIMELINE-006] queue progress survives reload', async ({ page, request }) => {
    await seedTimelineFeeds(request);
    await loginViaUi(page);
    await page.getByRole('button', { name: /^skip$/i }).click();
    await expect(page.getByTestId('active-folder-name')).toHaveText(/design/i);
    await page.reload();
    await expect(page.getByTestId('active-folder-name')).toHaveText(/design/i);
  });

  test('[TS-TIMELINE-007] no unread items yields the caught-up state', async ({ page }) => {
    await loginViaUi(page);
    await expect(page.getByRole('heading', { name: /all caught up/i })).toBeVisible();
  });

  test('[TS-TIMELINE-008] refresh failure preserves the current view', async ({
    page,
    request,
  }) => {
    await seedTimelineFeeds(request);
    await loginViaUi(page);
    await expect(page.getByRole('link', { name: /open engineering launch brief/i })).toBeVisible();

    let failedOnce = false;
    await page.route('**/api/items**', async (route) => {
      if (!failedOnce) {
        failedOnce = true;
        await route.fulfill({
          status: 500,
          contentType: 'application/json',
          body: JSON.stringify({ detail: 'forced refresh failure' }),
        });
        return;
      }

      await route.fallback();
    });

    await page.getByRole('button', { name: /refresh/i }).click();
    await expect(page.getByRole('link', { name: /open engineering launch brief/i })).toBeVisible();
    await expect(page.getByRole('button', { name: /refresh/i })).toBeEnabled();
  });
});
