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
    const podStackRow = feedTable.getByRole('row', { name: /#301: the pod stack/i });

    await expect(feedTable.getByRole('columnheader', { name: /feed name/i })).toBeVisible();
    await expect(feedTable.getByRole('columnheader', { name: /last article/i })).toBeVisible();
    await expect(feedTable.getByRole('columnheader', { name: /status/i })).toBeVisible();
    await expect(feedTable.getByRole('columnheader', { name: /actions/i })).toBeVisible();

    const lastArticleValue = podStackRow.getByText(/hours ago/i);

    await expect(lastArticleValue).toBeVisible();
    await expect(lastArticleValue).toHaveAttribute('title', /\d{4}-\d{2}-\d{2}/);
    await expect(podStackRow.getByText(/#301: the pod stack/i)).toBeVisible();
    await expect(podStackRow.getByLabel(/update error: connection timeout/i)).toHaveAttribute(
      'title',
      'Connection timeout',
    );
    await expect(feedTable.getByLabel('Feed healthy').first()).toBeVisible();
  });

  test('[TC-FEEDS-005] feed settings dialog saves editable feed settings', async ({ page }) => {
    await page.goto('/feeds');

    const feedTable = page.getByRole('table', { name: /feed management table/i });
    const backendRow = feedTable.getByRole('row', { name: /#102: backend briefing/i });

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

    const renamedRow = feedTable.getByRole('row', { name: /#102: backend briefing updated/i });
    await renamedRow
      .getByRole('button', { name: /adjust feed quality for backend briefing updated/i })
      .click();
    await expect(page.getByLabel(/feed title setting/i)).toHaveValue('Backend Briefing Updated');
    await expect(page.getByLabel(/folder setting/i)).toHaveValue('20');
    await expect(page.getByLabel(/extract full text setting/i)).toHaveValue('disabled');
    await expect(page.getByLabel(/create llm summaries setting/i)).toHaveValue('enabled');
  });
});
