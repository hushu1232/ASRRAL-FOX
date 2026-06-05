# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: notifications.spec.ts >> Notification E2E >> notifications page has mark-all-read button
- Location: e2e\notifications.spec.ts:55:7

# Error details

```
Test timeout of 60000ms exceeded.
```

```
Error: page.fill: Test timeout of 60000ms exceeded.
Call log:
  - waiting for locator('input[type="email"]')

```

# Page snapshot

```yaml
- generic [active] [ref=e1]:
  - generic [ref=e2]:
    - generic [ref=e4]:
      - generic [ref=e5]:
        - img "星尘" [ref=e6]
        - heading "虚拟形象管理平台" [level=1] [ref=e7]
        - paragraph [ref=e8]: Avatar Management System
      - generic [ref=e9]:
        - heading "欢迎回来" [level=2] [ref=e10]
        - generic [ref=e11]:
          - generic [ref=e17]:
            - img "mail" [ref=e19]:
              - img [ref=e20]
            - textbox "邮箱地址" [ref=e22]
          - generic [ref=e28]:
            - img "lock" [ref=e30]:
              - img [ref=e31]
            - textbox "密码" [ref=e33]
            - button "Show" [ref=e35] [cursor=pointer]:
              - img "eye-invisible" [ref=e36]:
                - img [ref=e37]
          - button "登 录" [ref=e45] [cursor=pointer]:
            - generic [ref=e46]: 登 录
          - generic [ref=e47]:
            - link "还没有账号？立即注册" [ref=e48] [cursor=pointer]:
              - /url: /register
            - link "忘记密码？" [ref=e49] [cursor=pointer]:
              - /url: /forgot-password
        - separator [ref=e50]:
          - generic [ref=e52]: 或
        - button "bank 企业 SSO 登录" [ref=e54] [cursor=pointer]:
          - img "bank" [ref=e56]:
            - img [ref=e57]
          - generic [ref=e59]: 企业 SSO 登录
      - paragraph [ref=e60]: 仅支持邮箱/用户名+密码登录，以及企业SSO
    - generic [ref=e62]:
      - paragraph [ref=e63]:
        - text: We use essential cookies for authentication and language preferences. No tracking or advertising cookies.
        - link "Privacy Policy" [ref=e64] [cursor=pointer]:
          - /url: /privacy
      - generic [ref=e65]:
        - button "Reject Optional" [ref=e66] [cursor=pointer]:
          - generic [ref=e67]: Reject Optional
        - button "Accept" [ref=e68] [cursor=pointer]:
          - generic [ref=e69]: Accept
  - button "Open Next.js Dev Tools" [ref=e75] [cursor=pointer]:
    - img [ref=e76]
  - alert [ref=e80]
```

# Test source

```ts
  1   | import { test, expect } from '@playwright/test';
  2   | 
  3   | const BASE_URL = 'http://localhost:3000';
  4   | const TEST_EMAIL = 'demo@example.com';
  5   | const TEST_PASSWORD = 'demo1234';
  6   | 
  7   | test.describe('Notification E2E', () => {
  8   |   test('notification bell is visible in header after login', async ({ page }) => {
  9   |     await page.goto(`${BASE_URL}/login`);
  10  |     await page.fill('input[type="email"]', TEST_EMAIL);
  11  |     await page.fill('input[type="password"]', TEST_PASSWORD);
  12  |     await page.click('button[type="submit"]');
  13  |     await page.waitForURL('**/dashboard');
  14  | 
  15  |     // The bell icon should be visible in the header
  16  |     const bell = page.locator('[aria-label="通知"]');
  17  |     await expect(bell).toBeVisible({ timeout: 10000 });
  18  |   });
  19  | 
  20  |   test('notification bell opens dropdown on click', async ({ page }) => {
  21  |     await page.goto(`${BASE_URL}/login`);
  22  |     await page.fill('input[type="email"]', TEST_EMAIL);
  23  |     await page.fill('input[type="password"]', TEST_PASSWORD);
  24  |     await page.click('button[type="submit"]');
  25  |     await page.waitForURL('**/dashboard');
  26  | 
  27  |     const bell = page.locator('[aria-label="通知"]');
  28  |     await expect(bell).toBeVisible({ timeout: 10000 });
  29  |     await bell.click();
  30  |     await page.waitForTimeout(500);
  31  | 
  32  |     // Dropdown should be visible
  33  |     const dropdown = page.locator('.ant-dropdown');
  34  |     const count = await dropdown.count();
  35  |     expect(count).toBeGreaterThanOrEqual(0);
  36  |   });
  37  | 
  38  |   test('notifications page renders', async ({ page }) => {
  39  |     await page.goto(`${BASE_URL}/login`);
  40  |     await page.fill('input[type="email"]', TEST_EMAIL);
  41  |     await page.fill('input[type="password"]', TEST_PASSWORD);
  42  |     await page.click('button[type="submit"]');
  43  |     await page.waitForURL('**/dashboard');
  44  | 
  45  |     await page.goto(`${BASE_URL}/notifications`);
  46  |     await page.waitForTimeout(1000);
  47  | 
  48  |     const heading = page.locator('h1');
  49  |     await expect(heading).toContainText('通知中心', { timeout: 10000 });
  50  | 
  51  |     const card = page.locator('.ant-card');
  52  |     await expect(card.first()).toBeVisible({ timeout: 10000 });
  53  |   });
  54  | 
  55  |   test('notifications page has mark-all-read button', async ({ page }) => {
  56  |     await page.goto(`${BASE_URL}/login`);
> 57  |     await page.fill('input[type="email"]', TEST_EMAIL);
      |                ^ Error: page.fill: Test timeout of 60000ms exceeded.
  58  |     await page.fill('input[type="password"]', TEST_PASSWORD);
  59  |     await page.click('button[type="submit"]');
  60  |     await page.waitForURL('**/dashboard');
  61  | 
  62  |     await page.goto(`${BASE_URL}/notifications`);
  63  |     await page.waitForTimeout(1000);
  64  | 
  65  |     const readAllBtn = page.locator('button:has-text("全部已读")');
  66  |     await expect(readAllBtn).toBeVisible({ timeout: 10000 });
  67  |   });
  68  | 
  69  |   test('sidebar has notification link', async ({ page }) => {
  70  |     await page.goto(`${BASE_URL}/login`);
  71  |     await page.fill('input[type="email"]', TEST_EMAIL);
  72  |     await page.fill('input[type="password"]', TEST_PASSWORD);
  73  |     await page.click('button[type="submit"]');
  74  |     await page.waitForURL('**/dashboard');
  75  | 
  76  |     const notifLink = page.locator('.ant-menu-item').filter({ hasText: '通知' });
  77  |     await expect(notifLink).toBeVisible({ timeout: 10000 });
  78  |   });
  79  | 
  80  |   test('sidebar notification link navigates to notifications page', async ({ page }) => {
  81  |     await page.goto(`${BASE_URL}/login`);
  82  |     await page.fill('input[type="email"]', TEST_EMAIL);
  83  |     await page.fill('input[type="password"]', TEST_PASSWORD);
  84  |     await page.click('button[type="submit"]');
  85  |     await page.waitForURL('**/dashboard');
  86  | 
  87  |     const notifLink = page.locator('.ant-menu-item').filter({ hasText: '通知' });
  88  |     await notifLink.click();
  89  |     await page.waitForURL('**/notifications');
  90  | 
  91  |     const heading = page.locator('h1');
  92  |     await expect(heading).toContainText('通知中心', { timeout: 10000 });
  93  |   });
  94  | });
  95  | 
  96  | test.describe('Notification API E2E', () => {
  97  |   test('GET /api/notifications requires auth', async ({ request }) => {
  98  |     const res = await request.get(`${BASE_URL}/api/notifications`);
  99  |     expect(res.status()).toBe(401);
  100 |   });
  101 | 
  102 |   test('GET /api/notifications/unread-count requires auth', async ({ request }) => {
  103 |     const res = await request.get(`${BASE_URL}/api/notifications/unread-count`);
  104 |     expect(res.status()).toBe(401);
  105 |   });
  106 | 
  107 |   test('PUT /api/notifications/read-all requires auth', async ({ request }) => {
  108 |     const res = await request.put(`${BASE_URL}/api/notifications/read-all`);
  109 |     expect(res.status()).toBe(401);
  110 |   });
  111 | });
  112 | 
```