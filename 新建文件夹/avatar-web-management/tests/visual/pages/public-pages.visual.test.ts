/**
 * Visual regression tests — Public pages (register, forgot-password, reset-password).
 *
 * Requires: Next.js dev server running (npm run dev)
 */

import { chromium, type Browser, type Page } from 'playwright';

const BASE_URL = process.env.VISUAL_BASE_URL || 'http://localhost:3000';

describe('Public pages visual regression', () => {
  let browser: Browser;
  let page: Page;

  beforeAll(async () => {
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

  const snapshot = async (identifier: string) => {
    const screenshot = await page.screenshot({ fullPage: true });
    expect(screenshot).toMatchImageSnapshot({
      customSnapshotIdentifier: identifier,
      ...(global as unknown as Record<string, unknown>).visualRegressionOptions as object,
    });
  };

  it('register page — desktop', async () => {
    await page.goto(BASE_URL + '/register', { waitUntil: 'networkidle' }).catch(() => {});
    await page.waitForTimeout(1000);
    await snapshot('register-desktop');
  });

  it('forgot-password page — desktop', async () => {
    await page.goto(BASE_URL + '/forgot-password', { waitUntil: 'networkidle' }).catch(() => {});
    await page.waitForTimeout(1000);
    await snapshot('forgot-password-desktop');
  });

  it('reset-password page — desktop', async () => {
    await page.goto(BASE_URL + '/reset-password?token=test', { waitUntil: 'networkidle' }).catch(() => {});
    await page.waitForTimeout(1000);
    await snapshot('reset-password-desktop');
  });
});
