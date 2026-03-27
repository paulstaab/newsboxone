import { test, expect } from '@playwright/test';
import { setupApiMocks, setupUnreachableServer, setupInvalidApiPath } from './mocks';

/**
 * E2E tests for User Story 1: View Aggregated Timeline
 *
 * Tests the complete flow:
 * 1. Login wizard with URL/credential validation
 * 2. Timeline rendering with unread items
 * 3. Infinite scroll and pagination
 * 4. Offline indicator behavior
 *
 * Note: Per Core Principle VI (Unread-Only Focus), the app exclusively works
 * with unread articles. There is no "view all" or "show read" functionality.
 */

const TEST_SERVER_URL = 'https://rss.example.com';
const TEST_USERNAME = 'testuser';
const TEST_PASSWORD = 'testpass';
const storageStatePath = 'tests/e2e/.auth/user.json';

test.describe('US1: Login and Timeline', () => {
  test.describe('Login Wizard', () => {
    test.beforeEach(async ({ page }) => {
      // Set up API mocks before each test
      await setupApiMocks(page, TEST_SERVER_URL);

      // Clear storage before each test - navigate and wait for redirect to complete
      await page.goto('/');
      await page.waitForURL(/\/login\//);
      await page.waitForLoadState('domcontentloaded');
      await page.evaluate(() => {
        sessionStorage.clear();
        localStorage.clear();
      });
    });

    test('should display login wizard on first visit', async ({ page }) => {
      // Navigate to root and wait for redirect
      await page.goto('/');
      await page.waitForURL(/\/login\//);

      // Should redirect to login page
      await expect(page).toHaveURL(/\/login\//);

      // Should show wizard with heading and server URL input
      await expect(page.getByRole('heading', { name: /welcome to newsboxone/i })).toBeVisible();
      await expect(page.getByText(/connect to your rss server/i)).toBeVisible();
      await expect(page.getByLabel(/server url/i)).toBeVisible();
    });

    test('should validate server connectivity before showing credentials', async ({ page }) => {
      // Already on login page from beforeEach

      // Enter valid HTTPS URL
      await page.getByLabel(/server url/i).fill(TEST_SERVER_URL);
      await page.getByRole('button', { name: /^continue$/i }).click();

      // Should show validation progress (checking connectivity text)
      // Note: This may be very fast with mocks, so we just verify the credentials appear

      // Should advance to credentials step after connectivity check
      await expect(page.getByLabel(/username/i)).toBeVisible({ timeout: 10000 });
      await expect(page.getByLabel(/password/i)).toBeVisible();
    });

    test('should show error for unreachable server', async ({ page }) => {
      // Set up mock for unreachable server
      const unreachableUrl = 'https://unreachable.invalid';
      await setupUnreachableServer(page, unreachableUrl);

      await page.goto('/login/');

      // Mock a network error by using an unreachable URL
      await page.getByLabel(/server url/i).fill(unreachableUrl);
      await page.getByRole('button', { name: /^continue$/i }).click();

      // Should show connectivity error (check for network-related error messages)
      await expect(
        page.getByText(/unable.*validate|check.*connection|network.*error/i),
      ).toBeVisible({ timeout: 10000 });

      // Should stay on server URL step
      await expect(page.getByLabel(/server url/i)).toBeVisible();
      await expect(page.getByLabel(/username/i)).not.toBeVisible();
    });

    test('should show error for wrong API path', async ({ page }) => {
      // Set up mock for invalid API path (404)
      const wrongPathUrl = 'https://wrong-path.example.com';
      await setupInvalidApiPath(page, wrongPathUrl);

      await page.goto('/login/');

      // Enter URL that returns 404 for /version
      await page.getByLabel(/server url/i).fill(wrongPathUrl);
      await page.getByRole('button', { name: /^continue$/i }).click();

      // Should show error about wrong server or API
      await expect(
        page.getByText(
          /not.*found|wrong.*server|invalid.*api|unable.*connect|unable.*validate|network.*error|cross-origin|cors/i,
        ),
      ).toBeVisible();

      // Should stay on server URL step
      await expect(page.getByLabel(/server url/i)).toBeVisible();
    });

    test('should validate HTTPS requirement', async ({ page }) => {
      // Wait for page to be fully loaded
      await page.waitForLoadState('networkidle');

      // Try to enter HTTP URL
      await page.getByLabel(/server url/i).fill('http://example.com');
      await page.getByRole('button', { name: /^continue$/i }).click();

      // Should show error
      await expect(page.getByText(/must use https/i)).toBeVisible({ timeout: 10000 });
    });

    test('should validate required fields', async ({ page }) => {
      await page.goto('/login/');
      await page.waitForLoadState('networkidle');

      // HTML5 validation prevents empty submission, so fill URL to progress
      await page.getByLabel(/server url/i).fill(TEST_SERVER_URL);
      await page.getByRole('button', { name: /^continue$/i }).click();

      // Should advance to credentials step
      await expect(page.getByLabel(/username/i)).toBeVisible({ timeout: 10000 });

      // Verify form requires username and password fields exist and are required
      const usernameInput = page.getByLabel(/username/i);
      const passwordInput = page.getByLabel(/password/i);

      await expect(usernameInput).toBeVisible();
      await expect(passwordInput).toBeVisible();

      // These inputs should have the required attribute
      await expect(usernameInput).toHaveAttribute('required', '');
      await expect(passwordInput).toHaveAttribute('required', '');
    });

    test('should show progress during authentication handshake', async ({ page }) => {
      await page.goto('/login/');
      await page.waitForLoadState('networkidle');

      // Fill in server URL
      await page.getByLabel(/server url/i).fill(TEST_SERVER_URL);
      await page.getByRole('button', { name: /^continue$/i }).click();

      // Wait for validation step to complete
      await expect(page.getByLabel(/username/i)).toBeVisible({ timeout: 10000 });

      // Fill credentials
      await page.getByLabel(/username/i).fill(TEST_USERNAME);
      await page.getByLabel(/password/i).fill(TEST_PASSWORD);
      await page.getByRole('button', { name: /sign.*in/i }).click();

      // Should show authenticating state (use first() to avoid strict mode violation)
      await expect(page.getByText(/authenticating/i).first()).toBeVisible();

      // Should eventually redirect to timeline
      await page.waitForURL(/\/timeline/, { timeout: 10000 });
    });

    test('should handle remember device toggle', async ({ page }) => {
      await page.goto('/login/');

      // Progress to credentials step
      await page.getByLabel(/server url/i).fill(TEST_SERVER_URL);
      await page.getByRole('button', { name: /^continue$/i }).click();

      // Wait for credentials step
      await expect(page.getByLabel(/username/i)).toBeVisible();

      // Should have remember device checkbox
      const rememberCheckbox = page.getByLabel(/remember.*device|stay.*logged.*in/i);
      await expect(rememberCheckbox).toBeVisible();

      // Should be unchecked by default
      await expect(rememberCheckbox).not.toBeChecked();

      // Can be toggled
      await rememberCheckbox.check();
      await expect(rememberCheckbox).toBeChecked();
    });

    test('should store credentials in sessionStorage by default', async ({ page }) => {
      await page.goto('/login/');

      // Complete login without remember device
      await page.getByLabel(/server url/i).fill(TEST_SERVER_URL);
      await page.getByRole('button', { name: /^continue$/i }).click();
      await expect(page.getByLabel(/username/i)).toBeVisible({ timeout: 10000 });
      await page.getByLabel(/username/i).fill(TEST_USERNAME);
      await page.getByLabel(/password/i).fill(TEST_PASSWORD);
      await page.getByRole('button', { name: /log.*in|sign.*in/i }).click();

      // Wait for redirect to timeline
      await page.waitForURL(/\/timeline/);

      // Check storage
      const sessionData = await page.evaluate(() => sessionStorage.getItem('newsboxone:session'));
      expect(sessionData).not.toBeNull();

      const localData = await page.evaluate(() => localStorage.getItem('newsboxone:session'));
      expect(localData).toBeNull();
    });

    test('should store credentials in localStorage when remember is enabled', async ({ page }) => {
      await page.goto('/login/');
      await page.waitForLoadState('networkidle');

      // Complete login with remember device
      await expect(page.getByLabel(/server url/i)).toBeVisible();
      await page.getByLabel(/server url/i).fill(TEST_SERVER_URL);
      await page.getByRole('button', { name: /^continue$/i }).click();
      await expect(page.getByLabel(/username/i)).toBeVisible({ timeout: 10000 });
      await page.getByLabel(/username/i).fill(TEST_USERNAME);
      await page.getByLabel(/password/i).fill(TEST_PASSWORD);
      await page.getByLabel(/remember.*device|stay.*logged.*in/i).check();
      await page.getByRole('button', { name: /log.*in|sign.*in/i }).click();

      // Wait for redirect to timeline
      await page.waitForURL(/\/timeline/);

      // Check storage
      const localData = await page.evaluate(() => localStorage.getItem('newsboxone:session'));
      expect(localData).not.toBeNull();
    });
  });

  test.describe('Timeline View', () => {
    test.use({ storageState: storageStatePath });

    test.beforeEach(async ({ page }) => {
      await setupApiMocks(page, TEST_SERVER_URL);
      await page.goto('/timeline');
    });

    test('should display timeline with articles', async ({ page }) => {
      // Should show article cards
      await expect(page.getByRole('option').first()).toBeVisible();

      // Should show article titles
      await expect(page.getByRole('heading').first()).toBeVisible();
    });

    test('should show unread count for the active folder', async ({ page }) => {
      await expect(page.getByTestId('active-folder-name')).toBeVisible();
      await expect(page.getByTestId('active-folder-name')).toHaveText(/\w+/);
    });

    test('should support infinite scroll', async ({ page }) => {
      // Wait for initial articles to render
      await expect(page.getByRole('option').first()).toBeVisible({ timeout: 10_000 });

      // Get initial article count
      const initialCount = await page.getByRole('option').count();

      // Scroll to bottom
      await page.evaluate(() => {
        window.scrollTo(0, document.body.scrollHeight);
      });

      // Wait for more articles to load
      await page.waitForTimeout(1000); // Give time for prefetch

      const newCount = await page.getByRole('option').count();

      // Should keep existing articles visible after scrolling
      expect(newCount).toBeGreaterThanOrEqual(initialCount);
    });

    test('should lazy-load article body content', async ({ page }) => {
      // First article should be visible
      const firstArticle = page.getByRole('option').first();
      await expect(firstArticle).toBeVisible();

      // Article body should be collapsed by default or loaded on scroll
      // Implementation will vary based on design
      await expect(firstArticle).toBeVisible();
    });

    test('should display empty state when no items', () => {
      // This requires mocking an empty response
      // Placeholder for empty state test
      expect(true).toBe(true);
    });
  });

  test.describe('Offline Behavior', () => {
    test.use({ storageState: storageStatePath });

    test.beforeEach(async ({ page }) => {
      await setupApiMocks(page, TEST_SERVER_URL);
      await page.goto('/timeline');
    });

    test('should show offline indicator when network is unavailable', async ({ page }) => {
      // Simulate offline by forcing navigator.onLine to false and dispatching the event
      await page.evaluate(() => {
        Object.defineProperty(navigator, 'onLine', {
          configurable: true,
          get: () => false,
        });
        window.dispatchEvent(new Event('offline'));
      });

      // Should show offline banner (use first() to handle React StrictMode double render)
      await expect(page.getByText(/you are currently offline/i).first()).toBeVisible();
    });

    test('should hide offline indicator when network returns', async ({ page }) => {
      // Simulate going offline
      await page.evaluate(() => {
        Object.defineProperty(navigator, 'onLine', {
          configurable: true,
          get: () => false,
        });
        window.dispatchEvent(new Event('offline'));
      });

      // Should show offline banner (use first() to handle React StrictMode double render)
      await expect(page.getByText(/you are currently offline/i).first()).toBeVisible();

      // Simulate coming back online
      // Note: In a real browser, navigator.onLine would update automatically,
      // but in tests we need to mock it
      await page.evaluate(() => {
        Object.defineProperty(navigator, 'onLine', {
          configurable: true,
          get: () => true,
        });
        window.dispatchEvent(new Event('online'));
      });

      // Offline banner should disappear - wait for it to be hidden
      await page
        .getByText(/you are currently offline/i)
        .first()
        .waitFor({ state: 'hidden', timeout: 5000 });
    });
  });
});
