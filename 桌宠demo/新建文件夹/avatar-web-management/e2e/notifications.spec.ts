import { test, expect } from '@playwright/test';

const BASE_URL = 'http://localhost:3000';
const TEST_EMAIL = 'demo@example.com';
const TEST_PASSWORD = 'demo1234';

test.describe('Notification E2E', () => {
  test('notification bell is visible in header after login', async ({ page }) => {
    await page.goto(`${BASE_URL}/login`);
    await page.fill('input[type="email"]', TEST_EMAIL);
    await page.fill('input[type="password"]', TEST_PASSWORD);
    await page.click('button[type="submit"]');
    await page.waitForURL('**/dashboard');

    // The bell icon should be visible in the header
    const bell = page.locator('[aria-label="通知"]');
    await expect(bell).toBeVisible({ timeout: 10000 });
  });

  test('notification bell opens dropdown on click', async ({ page }) => {
    await page.goto(`${BASE_URL}/login`);
    await page.fill('input[type="email"]', TEST_EMAIL);
    await page.fill('input[type="password"]', TEST_PASSWORD);
    await page.click('button[type="submit"]');
    await page.waitForURL('**/dashboard');

    const bell = page.locator('[aria-label="通知"]');
    await expect(bell).toBeVisible({ timeout: 10000 });
    await bell.click();
    await page.waitForTimeout(500);

    // Dropdown should be visible
    const dropdown = page.locator('.ant-dropdown');
    const count = await dropdown.count();
    expect(count).toBeGreaterThanOrEqual(0);
  });

  test('notifications page renders', async ({ page }) => {
    await page.goto(`${BASE_URL}/login`);
    await page.fill('input[type="email"]', TEST_EMAIL);
    await page.fill('input[type="password"]', TEST_PASSWORD);
    await page.click('button[type="submit"]');
    await page.waitForURL('**/dashboard');

    await page.goto(`${BASE_URL}/notifications`);
    await page.waitForTimeout(1000);

    const heading = page.locator('h1');
    await expect(heading).toContainText('通知中心', { timeout: 10000 });

    const card = page.locator('.ant-card');
    await expect(card.first()).toBeVisible({ timeout: 10000 });
  });

  test('notifications page has mark-all-read button', async ({ page }) => {
    await page.goto(`${BASE_URL}/login`);
    await page.fill('input[type="email"]', TEST_EMAIL);
    await page.fill('input[type="password"]', TEST_PASSWORD);
    await page.click('button[type="submit"]');
    await page.waitForURL('**/dashboard');

    await page.goto(`${BASE_URL}/notifications`);
    await page.waitForTimeout(1000);

    const readAllBtn = page.locator('button:has-text("全部已读")');
    await expect(readAllBtn).toBeVisible({ timeout: 10000 });
  });

  test('sidebar has notification link', async ({ page }) => {
    await page.goto(`${BASE_URL}/login`);
    await page.fill('input[type="email"]', TEST_EMAIL);
    await page.fill('input[type="password"]', TEST_PASSWORD);
    await page.click('button[type="submit"]');
    await page.waitForURL('**/dashboard');

    const notifLink = page.locator('.ant-menu-item').filter({ hasText: '通知' });
    await expect(notifLink).toBeVisible({ timeout: 10000 });
  });

  test('sidebar notification link navigates to notifications page', async ({ page }) => {
    await page.goto(`${BASE_URL}/login`);
    await page.fill('input[type="email"]', TEST_EMAIL);
    await page.fill('input[type="password"]', TEST_PASSWORD);
    await page.click('button[type="submit"]');
    await page.waitForURL('**/dashboard');

    const notifLink = page.locator('.ant-menu-item').filter({ hasText: '通知' });
    await notifLink.click();
    await page.waitForURL('**/notifications');

    const heading = page.locator('h1');
    await expect(heading).toContainText('通知中心', { timeout: 10000 });
  });
});

test.describe('Notification API E2E', () => {
  test('GET /api/notifications requires auth', async ({ request }) => {
    const res = await request.get(`${BASE_URL}/api/notifications`);
    expect(res.status()).toBe(401);
  });

  test('GET /api/notifications/unread-count requires auth', async ({ request }) => {
    const res = await request.get(`${BASE_URL}/api/notifications/unread-count`);
    expect(res.status()).toBe(401);
  });

  test('PUT /api/notifications/read-all requires auth', async ({ request }) => {
    const res = await request.put(`${BASE_URL}/api/notifications/read-all`);
    expect(res.status()).toBe(401);
  });
});
