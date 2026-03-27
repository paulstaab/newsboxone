import { expect, test } from '@playwright/test';
import { setupApiMocks } from './mocks';

const TEST_SERVER_URL = 'https://rss.example.com';
const storageStatePath = 'tests/e2e/.auth/user.json';

test.describe('Feed Management Page', () => {
  test('redirects unauthenticated users to login', async ({ page }) => {
    await setupApiMocks(page, TEST_SERVER_URL);
    await page.goto('/feeds');
    await page.waitForURL(/\/login/);
    await expect(page).toHaveURL(/\/login/);
  });

  test.describe('authenticated flows', () => {
    test.use({ storageState: storageStatePath });

    test.beforeEach(async ({ page }) => {
      await setupApiMocks(page, TEST_SERVER_URL);
    });

    test('burger menu lists timeline before feed management and still links to feed management', async ({
      page,
    }) => {
      await page.goto('/timeline');
      const menuButton = page.getByRole('button', { name: /burger menu/i });
      await menuButton.evaluate((element) => {
        (element as HTMLButtonElement).click();
      });
      await expect(page.getByRole('menuitem').first()).toHaveText(/timeline/i);
      await expect(page.getByRole('menuitem').nth(1)).toHaveText(/feed management/i);
      await page.getByRole('menuitem', { name: /feed management/i }).evaluate((element) => {
        (element as HTMLAnchorElement).click();
      });

      await page.waitForURL(/\/feeds/);
      await expect(
        page.getByRole('heading', { name: /manage subscriptions and folders/i }),
      ).toBeVisible();
    });

    test('floating add button and plus hotkey open the add-feed modal', async ({ page }) => {
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

    test('supports feed and folder management flows', async ({ page }) => {
      await page.goto('/feeds');
      await expect(
        page.getByRole('heading', { name: /manage subscriptions and folders/i }),
      ).toBeVisible();

      await expect(page.getByText(/feed #101/i)).toBeVisible();
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
      await expect(lastArticleValue).toHaveAttribute(
        'title',
        /\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}/,
      );
      await expect(nextUpdateValue).toHaveAttribute('title', /\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}/);
      await expect(podStackRow.getByText('https://podcasts.example.com/rss')).toBeVisible();
      await expect(podStackRow.getByLabel(/update error: connection timeout/i)).toHaveAttribute(
        'title',
        'Connection timeout',
      );
      await expect(feedTable.getByLabel('Feed healthy').first()).toBeVisible();

      await page.getByRole('button', { name: /new folder/i }).click();
      await page.getByLabel(/new folder name/i).fill('Announcements');
      await page.getByRole('button', { name: /^create folder$/i }).click();
      await expect(page.getByText(/created folder announcements/i)).toBeVisible();

      await page.getByRole('button', { name: /add feed/i }).click();
      await page.getByLabel(/^feed url$/i).fill('https://alerts.example.com/rss.xml');
      await page.getByLabel(/^destination folder$/i).selectOption({ label: 'Announcements' });
      await page.getByRole('button', { name: /^subscribe$/i }).click();

      const announcementsRow = feedTable.getByRole('row', { name: /^announcements/i });
      await expect(announcementsRow).toBeVisible();
      await expect(feedTable.getByRole('row', { name: /alerts\.example\.com/i })).toBeVisible();

      await announcementsRow.getByRole('button', { name: /rename folder/i }).click();
      await page.getByLabel(/^folder name$/i).fill('Briefings');
      await page
        .getByRole('button', { name: /^save$/i })
        .first()
        .click();
      await expect(page.getByRole('heading', { name: 'Briefings' })).toBeVisible();

      const briefingsRow = feedTable.getByRole('row', { name: /^briefings/i });
      await expect(briefingsRow).toBeVisible();
      const alphaRadarRow = feedTable.getByRole('row', { name: /alerts\.example\.com/i });

      await alphaRadarRow.getByRole('button', { name: /rename feed/i }).evaluate((element) => {
        (element as HTMLButtonElement).click();
      });
      await page.getByLabel(/feed name for alerts\.example\.com/i).fill('Alpha Radar');
      await page
        .getByRole('button', { name: /^save$/i })
        .last()
        .click();
      const renamedFeedRow = feedTable.getByRole('row', { name: /alpha radar/i });
      await expect(renamedFeedRow.getByText('Alpha Radar')).toBeVisible();
      await expect(renamedFeedRow.getByText('https://alerts.example.com/rss.xml')).toBeVisible();

      await renamedFeedRow
        .getByRole('button', { name: /move alpha radar to another folder/i })
        .click();
      await page.getByLabel(/^target folder$/i).selectOption({ label: 'Uncategorized' });
      await page.getByRole('button', { name: /^move feed$/i }).click();
      const uncategorizedRow = feedTable.getByRole('row', { name: /uncategorized/i });
      await expect(uncategorizedRow).toBeVisible();
      const uncategorizedFeedRow = feedTable.getByRole('row', { name: /alpha radar/i });
      await expect(uncategorizedFeedRow).toBeVisible();

      page.once('dialog', (dialog) => dialog.accept());
      await uncategorizedFeedRow.getByRole('button', { name: /delete feed/i }).click();
      await expect(feedTable.getByText('Alpha Radar')).not.toBeVisible();

      await page.keyboard.press('+');
      await page.getByLabel(/^feed url$/i).fill('https://briefings.example.com/feed.xml');
      await page.getByLabel(/^destination folder$/i).selectOption({ label: 'Briefings' });
      await page.getByRole('button', { name: /^subscribe$/i }).click();
      const briefingsFeedRow = feedTable.getByRole('row', { name: /briefings\.example\.com/i });
      await expect(briefingsFeedRow).toBeVisible();

      page.once('dialog', async (dialog) => {
        expect(dialog.message()).toContain('unsubscribe 1 feed');
        await dialog.accept();
      });
      await briefingsRow.getByRole('button', { name: /delete folder/i }).click();

      await expect(page.getByRole('heading', { name: 'Briefings', exact: true })).not.toBeVisible();
      await expect(feedTable.getByText('briefings.example.com')).not.toBeVisible();
    });
  });
});
