import { test, expect, type Page } from '@playwright/test';
import zhCN from '../messages/zh-CN.json';

const BASE_URL = 'http://localhost:3000';
const TEST_EMAIL = 'demo@example.com';
const TEST_PASSWORD = 'demo1234';
const messages = zhCN as typeof zhCN;
const layoutHeader = messages.layout.header;
const layoutSidebar = messages.layout.sidebar;
const notifications = messages.notifications;

async function loginViaApi(page: Page) {
  const res = await page.request.post(`${BASE_URL}/api/auth/login`, {
    data: { email: TEST_EMAIL, password: TEST_PASSWORD },
    headers: { 'Content-Type': 'application/json' },
  });
  const body = await res.json();
  if (!body.success) throw new Error(`Login API failed: ${body.error}`);
}

async function openAuthenticatedPage(page: Page, path = '/dashboard') {
  await loginViaApi(page);
  await page.goto(path, { waitUntil: 'domcontentloaded' });
  await page.waitForLoadState('domcontentloaded');
}

function notificationBell(page: Page) {
  return page.locator('.header__right').getByRole('button', { name: layoutHeader.notifications });
}

async function visibleNotificationMenuItem(page: Page) {
  const item = page.locator('.ant-menu-item').filter({ hasText: layoutSidebar.notifications }).first();
  try {
    await expect(item).toBeVisible({ timeout: 5000 });
    return item;
  } catch {
    // Mobile layout hides the sidebar until the header menu button opens it.
  }

  const menuButton = page.getByRole('button', { name: layoutHeader.menu });
  await expect(menuButton).toBeVisible({ timeout: 30000 });
  await menuButton.click();
  await expect(item).toBeVisible({ timeout: 30000 });
  return item;
}

test.describe('Notification E2E', () => {
  test('notification bell is visible in header after login', async ({ page }) => {
    await openAuthenticatedPage(page);

    await expect(notificationBell(page)).toBeVisible({ timeout: 30000 });
  });

  test('notification bell opens dropdown on click', async ({ page }) => {
    await openAuthenticatedPage(page);

    const bell = notificationBell(page);
    await expect(bell).toBeVisible({ timeout: 30000 });
    await bell.click();

    const dropdown = page.locator('.ant-dropdown').filter({ hasText: notifications.title });
    await expect(dropdown).toBeVisible({ timeout: 30000 });
  });

  test('notifications page renders', async ({ page }) => {
    await openAuthenticatedPage(page, '/notifications');

    await expect(page.locator('h1')).toContainText(notifications.notificationCenter, { timeout: 30000 });
    await expect(page.locator('.ant-card').first()).toBeVisible({ timeout: 30000 });
  });

  test('notifications page has mark-all-read button', async ({ page }) => {
    await openAuthenticatedPage(page, '/notifications');

    await expect(page.getByRole('button', { name: notifications.markAllRead })).toBeVisible({ timeout: 30000 });
  });

  test('sidebar has notification link', async ({ page }) => {
    await openAuthenticatedPage(page);

    await expect(await visibleNotificationMenuItem(page)).toBeVisible({ timeout: 30000 });
  });

  test('sidebar notification link navigates to notifications page', async ({ page }) => {
    await openAuthenticatedPage(page);

    const notifLink = await visibleNotificationMenuItem(page);
    await notifLink.click();
    await page.waitForURL('**/notifications');

    await expect(page.locator('h1')).toContainText(notifications.notificationCenter, { timeout: 30000 });
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
