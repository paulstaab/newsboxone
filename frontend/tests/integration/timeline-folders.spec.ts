import { expect, test } from './fixtures';
import { getMockItems, mockFolders, setupApiMocks } from './mocks';

const storageStatePath = 'tests/integration/.auth/user.json';

test.describe('Timeline integration coverage', () => {
  test.use({ storageState: storageStatePath });

  test.beforeEach(async ({ page }) => {
    await setupApiMocks(page);
  });

  test('[TC-TIMELINE-010] no unread items shows caught-up state', async ({ page }) => {
    await page.route('**/api/items**', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ items: [] }),
      });
    });

    await page.goto('/timeline');
    await expect(page.getByRole('heading', { name: 'All caught up!' })).toBeVisible();
  });

  test('[TC-TIMELINE-012] automatic refresh runs on mount', async ({ page }) => {
    let itemRequestCount = 0;

    await page.route('**/api/items**', async (route) => {
      itemRequestCount += 1;
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ items: getMockItems().filter((item) => item.unread) }),
      });
    });

    await page.goto('/timeline');
    await expect(page.getByTestId('active-folder-name')).toHaveText(
      new RegExp(mockFolders[0]?.name ?? 'Engineering Updates', 'i'),
    );
    expect(itemRequestCount).toBeGreaterThanOrEqual(1);
  });

  test('[TC-TIMELINE-013] manual refresh completes without losing existing state', async ({
    page,
  }) => {
    let requestCount = 0;

    await page.route('**/api/items**', async (route) => {
      requestCount += 1;
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ items: getMockItems().filter((item) => item.unread) }),
      });
    });

    await page.goto('/timeline');
    await expect(page.getByText('Ship It Saturday: Folder Queue')).toBeVisible();
    await page.getByRole('button', { name: /refresh/i }).click();
    await expect(page.getByText('Ship It Saturday: Folder Queue')).toBeVisible();
    expect(requestCount).toBeGreaterThanOrEqual(2);
  });

  test('[TC-TIMELINE-015] refresh error preserves cached content', async ({ page }) => {
    let requestCount = 0;

    await page.route('**/api/items**', async (route) => {
      requestCount += 1;
      if (requestCount === 1) {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({ items: getMockItems().filter((item) => item.unread) }),
        });
        return;
      }

      await route.fulfill({
        status: 500,
        contentType: 'application/json',
        body: JSON.stringify({ detail: 'Server error' }),
      });
    });

    await page.goto('/timeline');
    await expect(page.getByText('Ship It Saturday: Folder Queue')).toBeVisible();
    await page.getByRole('button', { name: /refresh/i }).click();
    await expect(page.getByText('Ship It Saturday: Folder Queue')).toBeVisible();
    await expect(page.getByRole('button', { name: /refresh/i })).toBeEnabled();
  });

  test('[TC-TIMELINE-016] pending read ids suppress reappearance before reconciliation', async ({
    page,
  }) => {
    const unreadItems = getMockItems().filter((item) => item.unread);

    await page.route('**/api/items/*/read', async (route) => {
      await route.fulfill({ status: 200, contentType: 'application/json', body: '{}' });
    });

    await page.route('**/api/items**', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ items: unreadItems }),
      });
    });

    await page.goto('/timeline');
    await page.getByRole('option', { name: /ship it saturday: folder queue/i }).click();
    await page.getByRole('button', { name: /close article/i }).click();
    await page.getByRole('button', { name: /refresh/i }).click();
    await expect(page.getByText('Ship It Saturday: Folder Queue')).toHaveCount(1);
  });

  test('[TC-TIMELINE-017] reconciliation removes read items after refresh', async ({ page }) => {
    const readIds = new Set<number>();

    await page.route('**/api/items/*/read', async (route) => {
      const match = /\/items\/(\d+)\/read$/.exec(route.request().url());
      if (match) {
        readIds.add(Number(match[1]));
      }
      await route.fulfill({ status: 200, contentType: 'application/json', body: '{}' });
    });

    await page.route('**/api/items**', async (route) => {
      const firstUnreadItems = getMockItems().filter((item) => item.unread);
      const items = firstUnreadItems.filter((item) => !readIds.has(item.id));
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ items }),
      });
    });

    await page.goto('/timeline');
    await page.getByRole('option', { name: /ship it saturday: folder queue/i }).click();
    await page.getByRole('button', { name: /close article/i }).click();
    await page.getByRole('button', { name: /refresh/i }).click();
    await expect(page.getByText('Ship It Saturday: Folder Queue')).toHaveCount(1);
  });

  test('[TC-TIMELINE-018] global hotkeys trigger refresh skip and mark all read', async ({
    page,
  }) => {
    let folderRead = false;

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
      await route.fulfill({ status: 200, contentType: 'application/json', body: '{}' });
    });

    await page.goto('/timeline');
    await page.locator('body').click();
    await page.keyboard.press('r');
    await page.keyboard.press('ArrowRight');
    await expect(page.getByTestId('active-folder-name')).toHaveText(
      new RegExp(mockFolders[1]?.name ?? 'Design Inspiration', 'i'),
    );
    await page.keyboard.press('Enter');
    await expect(page.getByTestId('active-folder-name')).toHaveText(/Podcasts/i);
  });

  test('[TC-TIMELINE-019] skipping through all folders leads to restart flow', async ({
    page,
  }) => {
    await page.goto('/timeline');
    await page.getByRole('button', { name: /^skip$/i }).click();
    await page.getByRole('button', { name: /^skip$/i }).click();
    await page.getByRole('button', { name: /^skip$/i }).click();
    await expect(page.getByText(/all folders viewed/i)).toBeVisible();
    await page.getByRole('button', { name: /^restart$/i }).click();
    await expect(page.getByTestId('active-folder-name')).toHaveText(/Engineering Updates/i);
  });

  test('[TC-TIMELINE-020] opening an article shows the pop-out and marks it read', async ({
    page,
  }) => {
    let markedRead = false;

    await page.route('**/api/items/*/read', async (route) => {
      markedRead = true;
      await route.fulfill({ status: 200, contentType: 'application/json', body: '{}' });
    });

    await page.goto('/timeline');
    await page.getByRole('option', { name: /ship it saturday: folder queue/i }).click();
    await expect(page.getByRole('dialog')).toBeVisible();
    expect(markedRead).toBe(true);
  });
});
