import { promises as fs } from 'node:fs';
import path from 'node:path';

import {
  capturePageShots,
  createAuthenticatedPage,
  resolveCaptureConfig,
  waitForTimelineReady,
} from './capture-authenticated-page-utils.mjs';

const config = await resolveCaptureConfig();
const outputs = {
  full: path.join(config.outputDir, 'feeds-full.png'),
  top: path.join(config.outputDir, 'feeds-top.png'),
  bottom: path.join(config.outputDir, 'feeds-bottom.png'),
  screen: path.join(config.outputDir, 'feeds-screen.png'),
  viewport: path.join(config.outputDir, 'feeds-viewport.png'),
};

const { browser, page } = await createAuthenticatedPage(config);

await waitForTimelineReady(page);
await page.goto(`${config.appBaseUrl}/feeds/`, { waitUntil: 'domcontentloaded' });

try {
  await page.getByRole('heading', { name: /manage subscriptions and folders/i }).waitFor({
    state: 'visible',
    timeout: 15000,
  });
} catch {
  throw new Error(`Feed management page did not render. Current URL: ${page.url()}.`);
}

await page.waitForLoadState('networkidle');
await capturePageShots(page, outputs);
await fs.copyFile(outputs.screen, outputs.viewport);

await browser.close();

console.log('Saved feed management screenshots:');
console.log(outputs.full);
console.log(outputs.top);
console.log(outputs.bottom);
console.log(outputs.screen);
console.log(outputs.viewport);
