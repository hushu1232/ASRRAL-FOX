/**
 * Visual regression tests — Login page.
 *
 * Requires: Next.js dev server running (npm run dev)
 * First run: creates baseline snapshots
 * Update baselines: npm run test:visual -- --updateSnapshot
 */

import { chromium, type Browser, type Page } from 'playwright';

const BASE_URL = process.env.VISUAL_BASE_URL || 'http://localhost:3000';

describe('Login page visual regression', () => {
  let browser: Browser;
  let page: Page;

  beforeAll(async () => {
    // Verify server is reachable
    try {
      await fetch(BASE_URL + '/login', { method: 'HEAD', signal: AbortSignal.timeout(5000) });
    } catch {
      console.warn(`[visual] ${BASE_URL}/login not reachable — start "npm run dev" first`);
    }
    browser = await chromium.launch({ headless: true });
  });

  afterAll(async () => {
    await browser?.close();
  });

  beforeEach(async () => {
    page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
  });

  afterEach(async () => {
    await page?.close();
  });

  it('login page — desktop 1440x900', async () => {
    await page.goto(BASE_URL + '/login', { waitUntil: 'networkidle' }).catch(() => {});
    await page.waitForTimeout(1000);
    const screenshot = await page.screenshot({ fullPage: true });
    expect(screenshot).toMatchImageSnapshot({
      customSnapshotIdentifier: 'login-desktop',
      ...(global as unknown as Record<string, unknown>).visualRegressionOptions as object,
    });
  });

  it('login page — mobile iPhone 12', async () => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto(BASE_URL + '/login', { waitUntil: 'networkidle' }).catch(() => {});
    await page.waitForTimeout(1000);
    const screenshot = await page.screenshot({ fullPage: true });
    expect(screenshot).toMatchImageSnapshot({
      customSnapshotIdentifier: 'login-mobile',
      ...(global as unknown as Record<string, unknown>).visualRegressionOptions as object,
    });
  });
});
