import path from 'node:path';
import {
  capturePageShots,
  createAuthenticatedPage,
  resolveCaptureConfig,
  waitForTimelineReady,
} from './capture-authenticated-page-utils.mjs';

const config = await resolveCaptureConfig();
const outputs = {
  full: path.join(config.outputDir, 'timeline-full.png'),
  top: path.join(config.outputDir, 'timeline-top.png'),
  bottom: path.join(config.outputDir, 'timeline-bottom.png'),
  screen: path.join(config.outputDir, 'timeline-screen.png'),
};

const { browser, page } = await createAuthenticatedPage(config);

await waitForTimelineReady(page);
await page.waitForLoadState('networkidle');
await capturePageShots(page, outputs);

await browser.close();

console.log('Saved timeline screenshots:');
console.log(outputs.full);
console.log(outputs.top);
console.log(outputs.bottom);
console.log(outputs.screen);
