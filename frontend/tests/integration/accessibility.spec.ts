import { type Page, type Route } from '@playwright/test';
import { expect, test } from './fixtures';
import { setupApiMocks } from './mocks';

async function setupAccessibilityMocks(page: Page) {
  await setupApiMocks(page);
  await page.route('**/api/items**', async (route: Route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ items: [] }),
    });
  });
}

async function seedRememberedSession(page: Page) {
  await page.addInitScript(() => {
    localStorage.setItem(
      'newsboxone:session',
      JSON.stringify({
        username: 'test',
        credentials: 'dGVzdDp0ZXN0',
        rememberDevice: true,
      }),
    );
  });
}

test.describe('Accessibility integration coverage', () => {
  test.beforeEach(async ({ page }) => {
    await setupAccessibilityMocks(page);
  });

  test('[TC-APP-001] skip link is reachable from the keyboard', async ({ page }) => {
    await page.goto('/login');
    await page.waitForLoadState('networkidle');
    const skipLink = page.getByRole('link', { name: /skip to main content/i });
    await skipLink.focus();
    await expect(skipLink).toBeFocused();
    await page.keyboard.press('Enter');
    await expect(page.locator('#main-content')).toBeFocused();
  });

  test('[TC-APP-002] login page has no axe violations', async ({ page, makeAxeBuilder }) => {
    await page.goto('/login');
    const results = await makeAxeBuilder()
      .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'])
      .analyze();

    expect(results.violations).toEqual([]);
  });

  test('[TC-APP-003] empty logged-in timeline has no axe violations', async ({
    page,
    makeAxeBuilder,
  }) => {
    await seedRememberedSession(page);
    await page.goto('/timeline', { waitUntil: 'networkidle' });
    await expect(page.getByRole('heading', { name: 'All caught up!' })).toBeVisible();

    const results = await makeAxeBuilder()
      .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'])
      .analyze();

    expect(results.violations).toEqual([]);
  });

  test('[TC-APP-004] form controls and iconography meet baseline accessibility rules', async ({
    page,
    makeAxeBuilder,
  }) => {
    await page.goto('/login');
    const loginRules = await makeAxeBuilder()
      .withRules(['label', 'label-content-name-mismatch', 'color-contrast'])
      .analyze();

    expect(loginRules.violations).toEqual([]);

    await seedRememberedSession(page);
    await page.goto('/timeline');
    const iconRules = await makeAxeBuilder().withRules(['image-alt', 'svg-img-alt']).analyze();
    expect(iconRules.violations).toEqual([]);
  });
});
