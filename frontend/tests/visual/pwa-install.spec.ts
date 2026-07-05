import { test, expect } from '@playwright/test';
import { VIEWPORTS } from '../integration/constants';
import { seedRememberedSession, showInstallPrompt } from '../integration/pwaHelpers';

test.describe('PWA Install Prompt Visual Regression', () => {
  test.beforeEach(async ({ page, context }) => {
    await context.clearCookies();
    await page.goto('/');
  });

  test('install prompt at mobile breakpoint (320px)', async ({ page }) => {
    await page.setViewportSize(VIEWPORTS.mobile);
    await showInstallPrompt(page);
    await expect(page).toHaveScreenshot('install-prompt-mobile-320px.png', { fullPage: true });
  });

  test('install prompt at tablet breakpoint (768px)', async ({ page }) => {
    await page.setViewportSize(VIEWPORTS.tablet);
    await showInstallPrompt(page);
    await expect(page).toHaveScreenshot('install-prompt-tablet-768px.png', { fullPage: true });
  });

  test('install prompt at desktop breakpoint (1024px)', async ({ page }) => {
    await page.setViewportSize(VIEWPORTS.desktop);
    await showInstallPrompt(page);
    await expect(page).toHaveScreenshot('install-prompt-desktop-1024px.png', { fullPage: true });
  });

  test('install prompt at large desktop breakpoint (1440px)', async ({ page }) => {
    await page.setViewportSize(VIEWPORTS.largeDesktop);
    await showInstallPrompt(page);
    await expect(page).toHaveScreenshot('install-prompt-desktop-1440px.png', { fullPage: true });
  });

  test('install prompt hover state', async ({ page }) => {
    await page.setViewportSize(VIEWPORTS.desktop);
    await showInstallPrompt(page);
    await page.getByRole('button', { name: 'Install NewsBoxOne app' }).hover();
    await expect(page).toHaveScreenshot('install-prompt-hover.png', { fullPage: true });
  });

  test('install prompt focus state', async ({ page }) => {
    await page.setViewportSize(VIEWPORTS.desktop);
    await showInstallPrompt(page);
    await page.getByRole('button', { name: 'Install NewsBoxOne app' }).focus();
    await expect(page).toHaveScreenshot('install-prompt-focus.png', { fullPage: true });
  });

  test('install prompt dismissed state', async ({ page }) => {
    await page.setViewportSize(VIEWPORTS.desktop);
    await page.evaluate(() => {
      localStorage.setItem('pwa-install-dismissed', Date.now().toString());
    });
    await page.reload();
    await expect(page.getByRole('heading', { name: /install newsboxone/i })).toHaveCount(0);
    await expect(page).toHaveScreenshot('install-prompt-dismissed.png', { fullPage: true });
  });

  test('install prompt in timeline context', async ({ page }) => {
    await page.setViewportSize(VIEWPORTS.desktop);
    await seedRememberedSession(page);
    await page.goto('/timeline');
    await showInstallPrompt(page);
    await expect(page).toHaveScreenshot('install-prompt-timeline-context.png', { fullPage: false });
  });
});
