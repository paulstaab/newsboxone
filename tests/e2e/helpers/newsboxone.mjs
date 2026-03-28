import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import test from '../../../frontend/node_modules/@playwright/test/index.js';

const { expect } = test;

const ROOT_DIR = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../..');
const DATABASE_CANDIDATES = [
  path.join(ROOT_DIR, 'data', 'headless-rss.sqlite3'),
  path.join(ROOT_DIR, 'data', 'newsboxone-e2e.sqlite3'),
  path.join(ROOT_DIR, 'frontend', 'data', 'headless-rss.sqlite3'),
  path.join(ROOT_DIR, 'frontend', 'data', 'newsboxone-e2e.sqlite3'),
];

export const AUTH_HEADER = 'Basic dGVzdDp0ZXN0';
export const BACKEND_ORIGIN = 'http://127.0.0.1:8000';
export const FEED_FIXTURE_ORIGIN = 'http://127.0.0.1:4100';
export const FEED_URLS = {
  engineering: `${FEED_FIXTURE_ORIGIN}/feeds/engineering.xml`,
  design: `${FEED_FIXTURE_ORIGIN}/feeds/design.xml`,
  missing: `${FEED_FIXTURE_ORIGIN}/feeds/missing.xml`,
};

function resolveDatabasePath() {
  for (const candidate of DATABASE_CANDIDATES) {
    if (!fs.existsSync(candidate)) {
      continue;
    }

    try {
      const tables = execFileSync('sqlite3', [candidate, '.tables'], {
        cwd: ROOT_DIR,
        encoding: 'utf8',
      });
      if (tables.includes('feed')) {
        return candidate;
      }
    } catch {
      // Try the next candidate.
    }
  }

  return DATABASE_CANDIDATES[0];
}

async function apiJson(request, url, init = {}) {
  const response = await request.fetch(`${BACKEND_ORIGIN}${url}`, {
    ...init,
    headers: {
      Authorization: AUTH_HEADER,
      'Content-Type': 'application/json',
      ...(init.headers ?? {}),
    },
  });
  expect(response.ok(), `${response.status()} ${response.statusText()} for ${url}`).toBeTruthy();
  return response.json();
}

export async function clearBrowserSession(page) {
  await page.context().clearCookies();
  await page.goto('/login');
  await page.evaluate(() => {
    sessionStorage.clear();
    localStorage.clear();
  });
}

export async function loginViaUi(page, options = {}) {
  const { password = 'test', rememberDevice = false } = options;
  await page.goto('/login');
  await page.getByLabel(/^username$/i).fill('test');
  await page.getByLabel(/^password$/i).fill(password);
  if (rememberDevice) {
    await page.getByLabel(/remember this device/i).check();
  }
  await page.getByRole('button', { name: /sign in/i }).click();
  await page.waitForURL(/\/timeline/);
}

export async function resetBackendState(request) {
  const feedsResponse = await apiJson(request, '/api/feeds');
  for (const feed of feedsResponse.feeds) {
    const response = await request.fetch(`${BACKEND_ORIGIN}/api/feeds/${String(feed.id)}`, {
      method: 'DELETE',
      headers: {
        Authorization: AUTH_HEADER,
      },
    });
    expect(response.ok(), `failed deleting feed ${String(feed.id)}`).toBeTruthy();
  }

  const foldersResponse = await apiJson(request, '/api/folders');
  for (const folder of foldersResponse.folders) {
    const response = await request.fetch(`${BACKEND_ORIGIN}/api/folders/${String(folder.id)}`, {
      method: 'DELETE',
      headers: {
        Authorization: AUTH_HEADER,
      },
    });
    expect(response.ok(), `failed deleting folder ${String(folder.id)}`).toBeTruthy();
  }
}

export async function createFolderByApi(request, name) {
  const response = await apiJson(request, '/api/folders', {
    method: 'POST',
    data: { name },
  });
  return response.folders[0];
}

export async function createFeedByApi(request, url, folderId = null) {
  const response = await apiJson(request, '/api/feeds', {
    method: 'POST',
    data: { url, folderId },
  });
  return response.feeds[0];
}

export function runBackendUpdate() {
  const databasePath = resolveDatabasePath();
  fs.mkdirSync(path.dirname(databasePath), { recursive: true });
  execFileSync('cargo', ['run', '--manifest-path', 'backend/Cargo.toml', '--', 'update'], {
    cwd: ROOT_DIR,
    env: {
      ...process.env,
      DATABASE_PATH: databasePath,
      USERNAME: 'test',
      PASSWORD: 'test',
      TESTING_MODE: 'true',
      FEED_UPDATE_FREQUENCY_MIN: '60',
    },
    stdio: 'inherit',
  });
}

export function markFeedsDue() {
  const databasePath = resolveDatabasePath();
  fs.mkdirSync(path.dirname(databasePath), { recursive: true });
  execFileSync('sqlite3', [databasePath, "UPDATE feed SET next_update_time = 0;"], {
    cwd: ROOT_DIR,
    stdio: 'inherit',
  });
}

export async function createFolderViaUi(page, name) {
  await page.getByRole('button', { name: /new folder/i }).click();
  await page.getByLabel(/new folder name/i).fill(name);
  await page.getByRole('button', { name: /^create folder$/i }).click();
  await expect(page.getByText(new RegExp(`created folder ${name}`, 'i'))).toBeVisible();
}

export async function addFeedViaUi(page, url, folderName) {
  const dialog = page.getByRole('dialog');
  await page.getByRole('button', { name: /add feed/i }).click();
  await expect(dialog).toBeVisible();
  await page.getByLabel(/^feed url$/i).fill(url);
  if (folderName) {
    await page.getByLabel(/^destination folder$/i).selectOption({ label: folderName });
  }
  await page.getByRole('button', { name: /^subscribe$/i }).click();
  await expect(dialog).toBeHidden();
}

export async function seedTimelineFeeds(request) {
  await resetBackendState(request);
  const engineeringFolder = await createFolderByApi(request, 'Engineering');
  const designFolder = await createFolderByApi(request, 'Design');
  await createFeedByApi(request, FEED_URLS.engineering, engineeringFolder.id);
  await createFeedByApi(request, FEED_URLS.design, designFolder.id);
  return { engineeringFolder, designFolder };
}
