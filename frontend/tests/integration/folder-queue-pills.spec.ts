import { expect, test } from './fixtures';
import { getMockItems, mockFolders, setupApiMocks } from './mocks';

const storageStatePath = 'tests/integration/.auth/user.json';

test.describe('Timeline folder-pill integration coverage', () => {
  test.use({ storageState: storageStatePath });

  test.beforeEach(async ({ page }) => {
    await setupApiMocks(page);
    await page.goto('/timeline');
  });

  test('[TC-TIMELINE-005] folder pills render in unread-priority order', async ({ page }) => {
    const pills = page.locator('[role="tablist"] button');
    await expect(pills).toHaveCount(3);

    const texts = await pills.allTextContents();
    expect(texts[0]).toMatch(/Engineering Updates\s*\(3\)/);
    expect(texts[1]).toMatch(/Design Inspiration\s*\(2\)/);
    expect(texts[2]).toMatch(/Podcasts\s*\(1\)/);
    await expect(pills.nth(0)).toHaveAttribute('aria-selected', 'true');
  });

  test('[TC-TIMELINE-006] selecting a folder pill pins it first and filters cards', async ({
    page,
  }) => {
    const pills = page.locator('[role="tablist"] button');
    await pills.nth(1).click();

    await expect(pills.nth(0)).toContainText(/Design Inspiration/);
    await expect(pills.nth(0)).toHaveAttribute('aria-selected', 'true');
    await expect(page.getByText('Color Systems for 2025')).toBeVisible();
    await expect(page.getByText('Ship It Saturday: Folder Queue')).toHaveCount(0);
  });

  test('[TC-TIMELINE-007] mark all read removes the active pill and advances the queue', async ({
    page,
  }) => {
    let folderRead = false;

    await page.unroute('**/api/items**');
    await page.route('**/api/items**', async (route) => {
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

    await page.route('**/api/items/read/multiple', async (route) => {
      folderRead = true;
      await route.fulfill({ status: 200 });
    });

    await page.getByRole('button', { name: /mark all read/i }).click();

    await expect(page.getByTestId('active-folder-name')).toHaveText(
      new RegExp(mockFolders[1]?.name ?? 'Design Inspiration', 'i'),
    );
    await expect(page.getByTestId('folder-pill-10')).toHaveCount(0);
  });

  test('[TC-TIMELINE-008] skip moves the active folder pill to the end', async ({ page }) => {
    await page.getByRole('button', { name: /^skip$/i }).click();

    const pills = page.locator('[role="tablist"] button');
    const texts = await pills.allTextContents();
    expect(texts[0]).toMatch(/Design Inspiration/);
    expect(texts[2]).toMatch(/Engineering Updates/);
  });
});
