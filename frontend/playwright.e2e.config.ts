import path from 'node:path';
import { defineConfig, devices } from '@playwright/test';

const ROOT_DIR = path.resolve(__dirname, '..');
const FRONTEND_PORT = 3001;
const BACKEND_PORT = 8000;
const FEED_FIXTURE_PORT = 4100;

const backendOrigin = `http://127.0.0.1:${String(BACKEND_PORT)}`;
const frontendOrigin = `http://127.0.0.1:${String(FRONTEND_PORT)}`;
const feedFixtureOrigin = `http://127.0.0.1:${String(FEED_FIXTURE_PORT)}`;
const e2eDatabasePath = path.join(ROOT_DIR, 'data', 'newsboxone-e2e.sqlite3');

export default defineConfig({
  testDir: '../tests/e2e',
  fullyParallel: false,
  workers: 1,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  reporter: [['list'], ['html', { outputFolder: 'playwright-report-e2e', open: 'never' }]],
  timeout: 60 * 1000,
  expect: {
    timeout: 10 * 1000,
  },
  use: {
    baseURL: frontendOrigin,
    serviceWorkers: 'block',
    trace: 'on-first-retry',
    video: 'on-first-retry',
    screenshot: 'only-on-failure',
  },
  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
  ],
  webServer: [
    {
      command: `node ${path.join(ROOT_DIR, 'tests/e2e/helpers/feed-fixture-server.mjs')}`,
      url: `${feedFixtureOrigin}/health`,
      reuseExistingServer: !process.env.CI,
      timeout: 30 * 1000,
      env: {
        PORT: String(FEED_FIXTURE_PORT),
      },
    },
    {
      command: path.join(ROOT_DIR, 'tests/e2e/helpers/start-backend.sh'),
      url: `${backendOrigin}/api/status`,
      cwd: ROOT_DIR,
      reuseExistingServer: false,
      timeout: 120 * 1000,
      env: {
        DATABASE_PATH: e2eDatabasePath,
        USERNAME: 'test',
        PASSWORD: 'test',
        TESTING_MODE: 'true',
        FEED_UPDATE_FREQUENCY_MIN: '60',
      },
    },
    {
      command: `npm run dev -- --hostname 127.0.0.1 --port ${String(FRONTEND_PORT)}`,
      cwd: path.join(ROOT_DIR, 'frontend'),
      url: frontendOrigin,
      reuseExistingServer: !process.env.CI,
      timeout: 120 * 1000,
      env: {
        NEWSBOXONE_BACKEND_ORIGIN: backendOrigin,
      },
    },
  ],
});
