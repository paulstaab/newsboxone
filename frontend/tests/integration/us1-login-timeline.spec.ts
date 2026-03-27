import { expect, test } from '@playwright/test';
import { setupApiMocks } from './mocks';

const TEST_USERNAME = 'test';
const TEST_PASSWORD = 'test';

test.describe('Login integration coverage', () => {
  test.beforeEach(async ({ page, context }) => {
    await context.clearCookies();
    await setupApiMocks(page);
    await page.goto('/login');
    await page.evaluate(() => {
      sessionStorage.clear();
      localStorage.clear();
    });
    await page.reload();
    await page.waitForLoadState('networkidle');
  });

  test('[TC-LOGIN-002] credential inputs are required', async ({ page }) => {
    await expect(page.getByLabel(/^username$/i)).toHaveAttribute('required', '');
    await expect(page.getByLabel(/^password$/i)).toHaveAttribute('required', '');
  });

  test('[TC-LOGIN-003] authentication progress is visible', async ({ page }) => {
    await page.getByLabel(/^username$/i).fill(TEST_USERNAME);
    await page.getByLabel(/^password$/i).fill(TEST_PASSWORD);
    await page.getByRole('button', { name: /sign in/i }).click();

    await expect(page.getByText(/authenticating with the newsboxone api/i)).toBeVisible();
    await page.waitForURL(/\/timeline/);
  });

  test('[TC-LOGIN-004] invalid credentials keep the user on the login page', async ({
    page,
  }) => {
    await page.getByLabel(/^username$/i).fill(TEST_USERNAME);
    await page.getByLabel(/^password$/i).fill('wrong-password');
    await page.getByRole('button', { name: /sign in/i }).click();

    await expect(page).toHaveURL(/\/login/);
    await expect(page.getByLabel(/^username$/i)).toHaveValue(TEST_USERNAME);
    await expect(page.getByLabel(/^password$/i)).toHaveValue('');
  });

  test('[TC-LOGIN-005] remember-device toggle is interactive', async ({ page }) => {
    const rememberDevice = page.getByLabel(/remember this device/i);
    await expect(rememberDevice).toBeVisible();
    await expect(rememberDevice).not.toBeChecked();
    await rememberDevice.check();
    await expect(rememberDevice).toBeChecked();
  });

  test('[TC-LOGIN-006] default login persists session storage only', async ({ page }) => {
    await page.getByLabel(/^username$/i).fill(TEST_USERNAME);
    await page.getByLabel(/^password$/i).fill(TEST_PASSWORD);
    await page.getByRole('button', { name: /sign in/i }).click();
    await page.waitForURL(/\/timeline/);

    const [sessionValue, localValue] = await page.evaluate(() => [
      sessionStorage.getItem('newsboxone:session'),
      localStorage.getItem('newsboxone:session'),
    ]);

    expect(sessionValue).not.toBeNull();
    expect(localValue).toBeNull();
  });

  test('[TC-LOGIN-007] remembered login persists local storage', async ({ page }) => {
    await page.getByLabel(/^username$/i).fill(TEST_USERNAME);
    await page.getByLabel(/^password$/i).fill(TEST_PASSWORD);
    await page.getByLabel(/remember this device/i).check();
    await page.getByRole('button', { name: /sign in/i }).click();
    await page.waitForURL(/\/timeline/);

    const [sessionValue, localValue] = await page.evaluate(() => [
      sessionStorage.getItem('newsboxone:session'),
      localStorage.getItem('newsboxone:session'),
    ]);

    expect(sessionValue).toBeNull();
    expect(localValue).not.toBeNull();
  });

  test('[TC-TIMELINE-004] offline state is surfaced', async ({ page, context }) => {
    await page.getByLabel(/^username$/i).fill(TEST_USERNAME);
    await page.getByLabel(/^password$/i).fill(TEST_PASSWORD);
    await page.getByRole('button', { name: /sign in/i }).click();
    await page.waitForURL(/\/timeline/);

    await context.setOffline(true);
    await page.evaluate(() => {
      window.dispatchEvent(new Event('offline'));
    });
    await expect(page.getByText(/you are currently offline/i)).toBeVisible();

    await context.setOffline(false);
    await page.evaluate(() => {
      window.dispatchEvent(new Event('online'));
    });
    await expect(page.getByText(/you are currently offline/i)).toHaveCount(0);
  });
});
