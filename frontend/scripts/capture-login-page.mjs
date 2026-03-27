import { chromium } from '@playwright/test';
import { promises as fs } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT_DIR = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const appBaseUrl = process.env.APP_BASE_URL ?? 'http://127.0.0.1:3000';
const outputDir = path.join(ROOT_DIR, 'screenshots');

const outputs = {
  normal: path.join(outputDir, 'login-normal.png'),
  plain: path.join(outputDir, 'login-plain.png'),
};

await fs.mkdir(outputDir, { recursive: true });

const browser = await chromium.launch();
const context = await browser.newContext({ viewport: { width: 1280, height: 720 } });
const page = await context.newPage();

await page.goto(`${appBaseUrl}/login/`, { waitUntil: 'domcontentloaded' });
await page.getByRole('heading', { name: /welcome to newsboxone/i }).waitFor();
await page.screenshot({ path: outputs.normal, fullPage: true });

await page.goto(`${appBaseUrl}/login/?plain=1`, { waitUntil: 'domcontentloaded' });
await page.getByRole('heading', { name: /welcome to newsboxone/i }).waitFor();
await page.screenshot({ path: outputs.plain, fullPage: true });

await browser.close();

console.log('Saved login screenshots:');
console.log(outputs.normal);
console.log(outputs.plain);
