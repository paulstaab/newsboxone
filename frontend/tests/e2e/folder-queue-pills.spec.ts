import { expect, test } from './fixtures';
import { getMockItems, mockFolders, setupApiMocks } from './mocks';

const TEST_SERVER_URL = 'https://rss.example.com';
const storageStatePath = 'tests/e2e/.auth/user.json';

test.describe('Folder queue pills', () => {
  test.use({ storageState: storageStatePath });

  test.beforeEach(async ({ page }) => {
    await setupApiMocks(page, TEST_SERVER_URL);
    await page.goto('/timeline');
  });

  test('renders pills in unread order and highlights the active folder', async ({ page }) => {
    const pills = page.locator('[role="tablist"] button');
    await expect(pills).toHaveCount(3);

    const texts = await pills.allTextContents();
    expect(texts[0]).toMatch(/Engineering Updates\s*\(3\)/);
    expect(texts[1]).toMatch(/Design Inspiration\s*\(2\)/);
    expect(texts[2]).toMatch(/Podcasts\s*\(1\)/);

    await expect(pills.nth(0)).toHaveAttribute('aria-selected', 'true');
  });

  test('selects a pill, pins it first, and filters the timeline list', async ({ page }) => {
    const pills = page.locator('[role="tablist"] button');
    await pills.nth(1).click();

    await expect(pills.nth(0)).toContainText(/Design Inspiration/);
    await expect(pills.nth(0)).toHaveAttribute('aria-selected', 'true');

    await expect(page.getByText('Color Systems for 2025')).toBeVisible();
    await expect(page.getByText('Ship It Saturday: Folder Queue')).toHaveCount(0);
  });

  test('mark-all-read removes the active pill and advances the queue', async ({ page }) => {
    const apiBase = `${TEST_SERVER_URL}/api`;
    let folderRead = false;

    await page.unroute(`${apiBase}/items**`);
    await page.route(`${apiBase}/items**`, async (route) => {
      const unreadItems = getMockItems().filter((item) => item.unread);
      const remainingItems = folderRead
        ? unreadItems.filter((item) => item.folderId !== 10)
        : unreadItems;

      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ items: remainingItems }),
      });
    });

    await page.route(`${apiBase}/items/read/multiple`, async (route) => {
      folderRead = true;
      await route.fulfill({ status: 200 });
    });

    await page.getByRole('button', { name: /mark all read/i }).click();

    await expect(page.getByTestId('active-folder-name')).toHaveText(
      new RegExp(mockFolders[1]?.name ?? 'Design Inspiration', 'i'),
    );
    await expect(page.getByTestId('folder-pill-10')).toHaveCount(0);
  });

  test('skip moves the active folder pill to the end', async ({ page }) => {
    await page.getByRole('button', { name: /^skip$/i }).click();

    const pills = page.locator('[role="tablist"] button');
    const texts = await pills.allTextContents();
    expect(texts[0]).toMatch(/Design Inspiration/);
    expect(texts[2]).toMatch(/Engineering Updates/);
  });
});
