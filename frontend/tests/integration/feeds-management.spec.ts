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
    await expect(page.getByText(/^Feed Management$/i)).toBeVisible();
  });

  test('[TC-APP-011] shared burger menu logs out the active session', async ({ page }) => {
    await page.goto('/timeline');

    await page.getByRole('button', { name: /burger menu/i }).click();

    const logoutRequest = page.waitForRequest((request) =>
      request.url().endsWith('/api/auth/logout'),
    );

    await page.getByRole('menuitem', { name: /logout/i }).click();

    await logoutRequest;
    await page.waitForURL(/\/login/);
    await expect(page.getByLabel(/^username$/i)).toBeVisible();
  });

  test('[TC-APP-012] shared burger menu routes to the about page with page metadata', async ({
    page,
  }) => {
    await page.goto('/timeline');

    await page.getByRole('button', { name: /burger menu/i }).click();
    await page.getByRole('menuitem', { name: /about newsboxone/i }).click();

    await page.waitForURL(/\/about/);
    await expect(page).toHaveTitle('About | NewsBoxOne');
    await expect(page.getByRole('heading', { name: /^newsboxone$/i })).toBeVisible();
  });

  test('[TC-FEEDS-003] feed creation entry points open the subscription modal', async ({
    page,
  }) => {
    await page.goto('/feeds');

    await page.getByRole('button', { name: /subscribe to feed/i }).click();
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
    await expect(feedTable.getByRole('columnheader', { name: /status/i })).toBeVisible();
    await expect(feedTable.getByRole('columnheader', { name: /actions/i })).toBeVisible();

    const lastArticleValue = podStackRow.getByText(/hours ago/i);

    await expect(lastArticleValue).toBeVisible();
    await expect(lastArticleValue).toHaveAttribute('title', /\d{4}-\d{2}-\d{2}/);
    await expect(podStackRow.getByText(/the pod stack/i)).toBeVisible();
    await expect(podStackRow.getByLabel(/update error: connection timeout/i)).toHaveAttribute(
      'title',
      'Connection timeout',
    );
    await expect(feedTable.getByLabel('Feed healthy').first()).toBeVisible();
  });

  test('[TC-FEEDS-005] feed settings dialog saves editable feed settings', async ({ page }) => {
    await page.goto('/feeds');

    const feedTable = page.getByRole('table', { name: /feed management table/i });
    const backendRow = feedTable.getByRole('row', { name: /backend briefing/i });

    await backendRow
      .getByRole('button', { name: /adjust feed quality for backend briefing/i })
      .click();

    const qualityDialog = page.getByRole('dialog');
    await expect(qualityDialog.getByRole('heading', { name: /backend briefing/i })).toBeVisible();
    await expect(qualityDialog.getByText(/^Extract Full Text$/i)).toBeVisible();
    await expect(qualityDialog.getByText(/^Create LLM Summaries$/i)).toBeVisible();
    await expect(qualityDialog.getByText('https://backend.example.com/rss')).toBeVisible();
    await expect(page.getByLabel(/feed title setting/i)).toHaveValue('Backend Briefing');
    await expect(page.getByLabel(/folder setting/i)).toHaveValue('10');

    await page.getByLabel(/feed title setting/i).fill('Backend Briefing Updated');
    await page.getByLabel(/folder setting/i).selectOption('20');
    await page.getByLabel(/extract full text setting/i).selectOption('disabled');
    await page.getByLabel(/create llm summaries setting/i).selectOption('enabled');
    await page.getByRole('button', { name: /^save$/i }).click();

    await expect(page.getByText(/updated settings for backend briefing updated/i)).toBeVisible();

    const renamedRow = feedTable.getByRole('row', { name: /backend briefing updated/i });
    await renamedRow
      .getByRole('button', { name: /adjust feed quality for backend briefing updated/i })
      .click();
    await expect(page.getByLabel(/feed title setting/i)).toHaveValue('Backend Briefing Updated');
    await expect(page.getByLabel(/folder setting/i)).toHaveValue('20');
    await expect(page.getByLabel(/extract full text setting/i)).toHaveValue('disabled');
    await expect(page.getByLabel(/create llm summaries setting/i)).toHaveValue('enabled');
  });

  test('[TC-FEEDS-006] confirmed feed deletion removes the row', async ({ page }) => {
    await page.goto('/feeds');

    const feedTable = page.getByRole('table', { name: /feed management table/i });
    const backendRow = feedTable.getByRole('row', { name: /backend briefing/i });
    await expect(backendRow).toBeVisible();

    page.once('dialog', async (dialog) => {
      expect(dialog.message()).toContain('Backend Briefing');
      await dialog.accept();
    });

    await backendRow.getByRole('button', { name: /delete feed backend briefing/i }).click();

    await expect(page.getByText(/unsubscribed from backend briefing/i)).toBeVisible();
    await expect(feedTable.getByRole('row', { name: /backend briefing/i })).toHaveCount(0);
  });

  test('[TC-FEEDS-007] folder creation stays visible and feed creation reports the created feed', async ({
    page,
  }) => {
    await page.goto('/feeds');

    await page.getByRole('button', { name: /add folder/i }).click();
    await page.getByRole('textbox', { name: /new folder name/i }).fill('Science Desk');
    await page.getByRole('button', { name: /create folder/i }).click();

    await expect(page.getByText(/created folder science desk/i)).toBeVisible();
    await expect(page.getByRole('heading', { name: 'Science Desk' })).toBeVisible();

    await page.getByRole('button', { name: /subscribe to feed/i }).click();
    await page
      .getByRole('textbox', { name: /feed url/i })
      .fill('https://planetpython.org/rss20.xml');
    await page.getByRole('combobox', { name: /destination folder/i }).selectOption({
      label: 'Science Desk',
    });
    await page.getByRole('dialog').getByRole('button', { name: 'Subscribe', exact: true }).click();

    await expect(page.getByText(/subscribed to planetpython\.org/i)).toBeVisible();
    await expect(page.getByRole('row', { name: /planetpython\.org/i })).toBeVisible();
  });
});
