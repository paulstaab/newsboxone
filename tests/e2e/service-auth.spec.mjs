import test from '../../frontend/node_modules/@playwright/test/index.js';
import {
  clearBrowserSession,
  issueAuthHeader,
  loginViaUi,
  resetBackendState,
} from './helpers/newsboxone.mjs';

const { expect } = test;

test.describe('Service startup and authentication e2e scenarios', () => {
  test.beforeEach(async ({ page, request }) => {
    await resetBackendState(request);
    await clearBrowserSession(page);
  });

  test('[TS-SERVICE-001] combined service starts and exposes the public surface', async ({
    page,
    request,
  }) => {
    await page.goto('/');
    await expect(page).toHaveURL(/\/login/);

    const status = await request.get('/api/status');
    expect(status.ok()).toBeTruthy();
    expect(await status.json()).toEqual({ status: 'ok' });

    const version = await request.get('/api/version', {
      headers: {
        Authorization: await issueAuthHeader(request),
      },
    });
    expect(version.ok()).toBeTruthy();
    const payload = await version.json();
    expect(typeof payload.version).toBe('string');
  });

  test('[TS-LOGIN-001] signed-out visitor is routed to login', async ({ page }) => {
    await page.goto('/');
    await expect(page).toHaveURL(/\/login/);
    await page.goto('/timeline');
    await expect(page).toHaveURL(/\/login/);
    await expect(page.getByLabel(/^username$/i)).toBeVisible();
    await expect(page.getByLabel(/^password$/i)).toBeVisible();
  });

  test('[TS-LOGIN-002] valid credentials create a working browser session', async ({ page }) => {
    await loginViaUi(page);
    await expect(page).toHaveURL(/\/timeline/);
    await expect(page.getByRole('heading', { name: /newsboxone/i })).toBeVisible();

    const [sessionValue, localValue] = await page.evaluate(() => [
      sessionStorage.getItem('newsboxone:session'),
      localStorage.getItem('newsboxone:session'),
    ]);
    expect(sessionValue).not.toBeNull();
    expect(localValue).toBeNull();
  });

  test('[TS-LOGIN-003] invalid credentials are rejected safely', async ({ page }) => {
    await page.goto('/login');
    await page.getByLabel(/^username$/i).fill('test');
    await page.getByLabel(/^password$/i).fill('wrong-password');
    await page.getByRole('button', { name: /sign in/i }).click();

    await expect(page).toHaveURL(/\/login/);
    await expect(page.getByLabel(/^username$/i)).toHaveValue('test');
    await expect(page.getByLabel(/^password$/i)).toHaveValue('');
  });

  test('[TS-LOGIN-004] remember-device choice controls storage persistence', async ({ page }) => {
    await loginViaUi(page);
    let storage = await page.evaluate(() => ({
      session: sessionStorage.getItem('newsboxone:session'),
      local: localStorage.getItem('newsboxone:session'),
    }));
    expect(storage.session).not.toBeNull();
    expect(storage.local).toBeNull();

    await clearBrowserSession(page);
    await loginViaUi(page, { rememberDevice: true });
    storage = await page.evaluate(() => ({
      session: sessionStorage.getItem('newsboxone:session'),
      local: localStorage.getItem('newsboxone:session'),
    }));
    expect(storage.session).toBeNull();
    expect(storage.local).not.toBeNull();
  });

  test('[TS-LOGIN-005] signed-out visitor is routed to login from feed management', async ({
    page,
  }) => {
    await page.goto('/feeds');
    await expect(page).toHaveURL(/\/login/);
    await expect(page.getByLabel(/^username$/i)).toBeVisible();
  });
});
