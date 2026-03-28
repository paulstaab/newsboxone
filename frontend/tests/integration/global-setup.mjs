import { chromium } from '@playwright/test';
import { promises as fs } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const TEST_USERNAME = 'test';
const TEST_PASSWORD = 'test';

const storageStatePath = fileURLToPath(new URL('./.auth/user.json', import.meta.url));

export default async function globalSetup(config) {
  const baseURL = config.projects?.[0]?.use?.baseURL ?? config.use?.baseURL;
  if (!baseURL) {
    throw new Error('baseURL is required to run the global login setup.');
  }

  await fs.mkdir(path.dirname(storageStatePath), { recursive: true });

  const browser = await chromium.launch();
  const context = await browser.newContext();
  const page = await context.newPage();

  await page.goto(baseURL);

  await page.evaluate(
    ({ username }) => {
      localStorage.setItem(
        'newsboxone:session',
        JSON.stringify({
          username,
          token: 'test-token',
          expiresAt: '2026-04-30T00:00:00.000Z',
          rememberDevice: true,
        }),
      );
    },
    { username: TEST_USERNAME },
  );

  await context.storageState({ path: storageStatePath });
  await browser.close();
}
