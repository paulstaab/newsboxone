import { chromium } from '@playwright/test';
import { promises as fs } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT_DIR = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

const stripQuotes = (value) => value.replace(/^["']|["']$/g, '');

/**
 * Load simple KEY=VALUE pairs from the repository .env file when present.
 */
export const loadEnvFile = async () => {
  const envPath = path.join(ROOT_DIR, '.env');

  try {
    const raw = await fs.readFile(envPath, 'utf8');
    return raw.split('\n').reduce((acc, line) => {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith('#')) return acc;
      const separatorIndex = trimmed.indexOf('=');
      if (separatorIndex === -1) return acc;
      const key = trimmed.slice(0, separatorIndex).trim();
      const value = stripQuotes(trimmed.slice(separatorIndex + 1).trim());
      if (key) acc[key] = value;
      return acc;
    }, {});
  } catch (error) {
    if (error?.code === 'ENOENT') {
      return {};
    }
    throw error;
  }
};

/**
 * Resolve shared authenticated screenshot configuration from env and .env.
 */
export const resolveCaptureConfig = async () => {
  const envFile = await loadEnvFile();

  const username = process.env.TEST_USER ?? envFile.TEST_USER;
  const password = process.env.TEST_PASSWORD ?? envFile.TEST_PASSWORD;

  if (!username || !password) {
    throw new Error('Missing TEST_USER or TEST_PASSWORD in .env or environment.');
  }

  return {
    appBaseUrl: process.env.APP_BASE_URL ?? envFile.APP_BASE_URL ?? 'http://127.0.0.1:3000',
    outputDir: path.join(ROOT_DIR, 'screenshots'),
    password,
    username,
  };
};

/**
 * Create a browser page, authenticate through the app, and land on /timeline.
 */
export const createAuthenticatedPage = async (config) => {
  await fs.mkdir(config.outputDir, { recursive: true });

  const browser = await chromium.launch();
  const context = await browser.newContext({
    viewport: { width: 1280, height: 720 },
  });
  const page = await context.newPage();

  await page.goto(`${config.appBaseUrl}/login/`, { waitUntil: 'domcontentloaded' });

  const usernameInput = page.getByLabel(/username/i);
  const passwordInput = page.getByLabel(/password/i);
  const errorBox = page.locator('.bg-red-50');

  await Promise.race([
    usernameInput.waitFor({ state: 'visible' }),
    errorBox.waitFor({ state: 'visible' }),
    page.waitForTimeout(15000),
  ]).catch(() => {});

  if (await errorBox.isVisible()) {
    const errorText = await errorBox.innerText();
    throw new Error(`Login form error: ${errorText.trim()}`);
  }

  if (!(await usernameInput.isVisible())) {
    throw new Error('Login form did not render.');
  }

  await usernameInput.fill(config.username);
  await passwordInput.fill(config.password);
  const rememberDeviceToggle = page.getByLabel(/remember device/i);

  if (await rememberDeviceToggle.isVisible().catch(() => false)) {
    await rememberDeviceToggle.check();
  }

  await page.getByRole('button', { name: /log.*in|sign.*in/i }).click();

  try {
    await page.waitForFunction(
      (sessionKey) => {
        return window.localStorage.getItem(sessionKey) || window.sessionStorage.getItem(sessionKey);
      },
      'newsboxone:session',
      { timeout: 20000 },
    );
  } catch {
    throw new Error('Session storage not set after login. Check credentials or server.');
  }

  if (!/\/timeline/.test(page.url())) {
    await page.goto(`${config.appBaseUrl}/timeline/`, { waitUntil: 'domcontentloaded' });
  }

  try {
    await page.waitForURL(/\/timeline/, { timeout: 15000 });
  } catch {
    throw new Error(
      `Failed to reach timeline. Current URL: ${page.url()}. Check TEST_USER/TEST_PASSWORD.`,
    );
  }

  const loginFormVisible = await page
    .getByLabel(/username/i)
    .isVisible()
    .catch(() => false);

  if (loginFormVisible) {
    throw new Error('Redirected back to login; timeline requires authentication.');
  }

  return { browser, context, page };
};

/**
 * Wait until the timeline has rendered either unread tabs, articles, or the empty state.
 */
export const waitForTimelineReady = async (page) => {
  let ready = false;

  try {
    await page
      .locator('[role="tablist"][aria-label="Unread folder queue"]')
      .waitFor({ state: 'visible', timeout: 15000 });
    ready = true;
  } catch {
    ready = false;
  }

  if (ready) {
    return;
  }

  try {
    await page.locator('[role="article"]').first().waitFor({ state: 'visible', timeout: 15000 });
    ready = true;
  } catch {
    ready = false;
  }

  if (ready) {
    return;
  }

  try {
    await page
      .getByRole('heading', { name: /all caught up|all folders viewed/i })
      .waitFor({ state: 'visible', timeout: 15000 });
    ready = true;
  } catch {
    ready = false;
  }

  if (ready) {
    return;
  }

  throw new Error('Timeline did not render expected content.');
};

/**
 * Capture the standard screenshot set for an authenticated page.
 */
export const capturePageShots = async (page, pageOutputs) => {
  const viewport = page.viewportSize() ?? { width: 1280, height: 720 };
  const topHeight = Math.min(600, viewport.height);

  await page.evaluate(() => window.scrollTo(0, 0));
  await page.waitForTimeout(200);
  await page.screenshot({ path: pageOutputs.screen });

  await page.screenshot({
    path: pageOutputs.top,
    clip: { x: 0, y: 0, width: viewport.width, height: topHeight },
  });

  await page.evaluate(() => window.scrollTo(0, document.documentElement.scrollHeight));
  await page.waitForTimeout(200);
  await page.screenshot({ path: pageOutputs.bottom });

  await page.screenshot({ path: pageOutputs.full, fullPage: true });
};
