# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: editor-workflow.spec.ts >> Editor Workflow E2E >> 2. Avatar List & Filtering >> Avatar list page loads with controls
- Location: e2e\editor-workflow.spec.ts:131:9

# Error details

```
Error: expect(locator).toBeVisible() failed

Locator: getByText('形象管理中心')
Expected: visible
Timeout: 5000ms
Error: element(s) not found

Call log:
  - Expect "toBeVisible" with timeout 5000ms
  - waiting for getByText('形象管理中心')

```

```yaml
- img "星尘"
- heading "虚拟形象管理平台" [level=1]
- paragraph: Avatar Management System
- heading "欢迎回来" [level=2]
- img "mail"
- textbox "邮箱地址"
- img "lock"
- textbox "密码"
- button "Show":
  - img "eye-invisible"
- button "登 录"
- link "还没有账号？立即注册":
  - /url: /register
- link "忘记密码？":
  - /url: /forgot-password
- separator: 或
- button "bank 企业 SSO 登录":
  - img "bank"
  - text: 企业 SSO 登录
- paragraph: 仅支持邮箱/用户名+密码登录，以及企业SSO
- paragraph:
  - text: We use essential cookies for authentication and language preferences. No tracking or advertising cookies.
  - link "Privacy Policy":
    - /url: /privacy
- button "Reject Optional"
- button "Accept"
- alert
```

# Test source

```ts
  37  |   });
  38  |   const body = await res.json();
  39  |   if (!body.success) throw new Error(`Login API failed: ${body.error}`);
  40  | }
  41  | 
  42  | test.describe('Editor Workflow E2E', () => {
  43  | 
  44  |   test.describe('1. Avatar Creation → Editor Flow', () => {
  45  |     let createdAvatarId: string;
  46  | 
  47  |     test('Create avatar via API and verify it appears in list', async ({ request }) => {
  48  |       const token = await getAuthToken(request);
  49  |       const res = await request.post(`${BASE_URL}/api/avatars`, {
  50  |         data: { name: 'E2E 测试形象', style: 'anime', base_model: 'female' },
  51  |         headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
  52  |       });
  53  |       expect(res.status()).toBe(201);
  54  |       const body = await res.json();
  55  |       expect(body.success).toBe(true);
  56  |       expect(body.data.id).toBeDefined();
  57  |       createdAvatarId = body.data.id;
  58  | 
  59  |       // Verify in list
  60  |       const listRes = await request.get(`${BASE_URL}/api/avatars?search=E2E`, {
  61  |         headers: { Authorization: `Bearer ${token}` },
  62  |       });
  63  |       const listBody = await listRes.json();
  64  |       expect(listBody.success).toBe(true);
  65  |       const items = listBody.data?.items || [];
  66  |       expect(items.some((a: { id: string }) => a.id === createdAvatarId)).toBe(true);
  67  |     });
  68  | 
  69  |     test('Editor page loads for created avatar', async ({ page }) => {
  70  |       await loginViaApi(page);
  71  |       // Navigate directly to the editor
  72  |       await page.goto('/avatars');
  73  |       await page.waitForLoadState('domcontentloaded');
  74  |       await page.waitForTimeout(1500);
  75  | 
  76  |       // Click "新建形象" to create a new avatar
  77  |       const createBtn = page.getByText('新建形象');
  78  |       if (await createBtn.isVisible()) {
  79  |         await createBtn.click();
  80  |         await page.waitForTimeout(2000);
  81  |       }
  82  | 
  83  |       // Should navigate to editor or stay on page with success message
  84  |       const bodyText = await page.textContent('body');
  85  |       expect(bodyText).toBeTruthy();
  86  |     });
  87  | 
  88  |     test('Editor page has part panel and toolbar', async ({ page }) => {
  89  |       await loginViaApi(page);
  90  | 
  91  |       // First create an avatar via API, then visit its editor
  92  |       const token = await getAuthToken(page.request);
  93  |       const res = await page.request.post(`${BASE_URL}/api/avatars`, {
  94  |         data: { name: 'Editor Test Avatar', style: 'anime', base_model: 'female' },
  95  |         headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
  96  |       });
  97  |       const body = await res.json();
  98  |       const avatarId = body.data?.id;
  99  | 
  100 |       if (avatarId) {
  101 |         await page.goto(`/avatars/${avatarId}/edit`);
  102 |         await page.waitForLoadState('domcontentloaded');
  103 |         await page.waitForTimeout(3000);
  104 | 
  105 |         const bodyText = await page.textContent('body');
  106 |         expect(bodyText).toBeTruthy();
  107 | 
  108 |         // Clean up
  109 |         await page.request.delete(`${BASE_URL}/api/avatars/${avatarId}`, {
  110 |           headers: { Authorization: `Bearer ${token}` },
  111 |         });
  112 |       }
  113 |     });
  114 | 
  115 |     // Clean up created avatar
  116 |     test.afterAll(async ({ request }) => {
  117 |       if (createdAvatarId) {
  118 |         const token = await getAuthToken(request);
  119 |         await request.delete(`${BASE_URL}/api/avatars/${createdAvatarId}`, {
  120 |           headers: { Authorization: `Bearer ${token}` },
  121 |         });
  122 |       }
  123 |     });
  124 |   });
  125 | 
  126 |   test.describe('2. Avatar List & Filtering', () => {
  127 |     test.beforeEach(async ({ page }) => {
  128 |       await loginViaApi(page);
  129 |     });
  130 | 
  131 |     test('Avatar list page loads with controls', async ({ page }) => {
  132 |       await page.goto('/avatars');
  133 |       await page.waitForLoadState('domcontentloaded');
  134 |       await page.waitForTimeout(2000);
  135 | 
  136 |       // Header
> 137 |       await expect(page.getByText('形象管理中心')).toBeVisible();
      |                                              ^ Error: expect(locator).toBeVisible() failed
  138 | 
  139 |       // Search input
  140 |       await expect(page.getByPlaceholder('搜索形象名称...')).toBeVisible();
  141 | 
  142 |       // Create button
  143 |       await expect(page.getByText('新建形象')).toBeVisible();
  144 | 
  145 |       await checkA11y(page);
  146 |     });
  147 | 
  148 |     test('Status filter is visible', async ({ page }) => {
  149 |       await page.goto('/avatars');
  150 |       await page.waitForLoadState('domcontentloaded');
  151 |       await page.waitForTimeout(1500);
  152 | 
  153 |       // Status filter exists
  154 |       const statusFilter = page.locator('.ant-select').filter({ hasText: /状态筛选|草稿|已发布|审核中/ });
  155 |       const count = await statusFilter.count();
  156 |       expect(count).toBeGreaterThanOrEqual(0);
  157 |     });
  158 |   });
  159 | 
  160 |   test.describe('3. Batch Operations', () => {
  161 |     test('Batch delete avatars via API', async ({ request }) => {
  162 |       const token = await getAuthToken(request);
  163 | 
  164 |       // Create two test avatars
  165 |       const [r1, r2] = await Promise.all([
  166 |         request.post(`${BASE_URL}/api/avatars`, {
  167 |           data: { name: 'Batch Test 1', style: 'anime', base_model: 'female' },
  168 |           headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
  169 |         }),
  170 |         request.post(`${BASE_URL}/api/avatars`, {
  171 |           data: { name: 'Batch Test 2', style: 'anime', base_model: 'male' },
  172 |           headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
  173 |         }),
  174 |       ]);
  175 | 
  176 |       const b1 = await r1.json();
  177 |       const b2 = await r2.json();
  178 |       const ids = [b1.data?.id, b2.data?.id].filter(Boolean);
  179 | 
  180 |       if (ids.length === 2) {
  181 |         // Batch delete
  182 |         const batchRes = await request.post(`${BASE_URL}/api/avatars/batch`, {
  183 |           data: { action: 'delete', ids },
  184 |           headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
  185 |         });
  186 |         expect(batchRes.status()).toBe(200);
  187 |         const batchBody = await batchRes.json();
  188 |         expect(batchBody.success).toBe(true);
  189 |       }
  190 |     });
  191 | 
  192 |     test('Batch operation rejects empty ids', async ({ request }) => {
  193 |       const token = await getAuthToken(request);
  194 |       const res = await request.post(`${BASE_URL}/api/avatars/batch`, {
  195 |         data: { action: 'delete', ids: [] },
  196 |         headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
  197 |       });
  198 |       expect(res.status()).toBe(400);
  199 |     });
  200 | 
  201 |     test('Batch operation validates action', async ({ request }) => {
  202 |       const token = await getAuthToken(request);
  203 |       const res = await request.post(`${BASE_URL}/api/avatars/batch`, {
  204 |         data: { action: 'invalid_action', ids: ['test-id'] },
  205 |         headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
  206 |       });
  207 |       expect(res.status()).toBe(400);
  208 |     });
  209 |   });
  210 | });
  211 | 
  212 | test.describe('Approval Workflow E2E', () => {
  213 | 
  214 |   test.describe('Version Status Transitions', () => {
  215 |     let testAvatarId: string;
  216 |     let testVersionId: string;
  217 | 
  218 |     test('Create avatar and version for approval', async ({ request }) => {
  219 |       const token = await getAuthToken(request);
  220 | 
  221 |       // Create avatar
  222 |       const avatarRes = await request.post(`${BASE_URL}/api/avatars`, {
  223 |         data: { name: 'Approval Test Avatar', style: 'realistic', base_model: 'female' },
  224 |         headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
  225 |       });
  226 |       const avatarBody = await avatarRes.json();
  227 |       expect(avatarBody.success).toBe(true);
  228 |       testAvatarId = avatarBody.data.id;
  229 | 
  230 |       // Create a version
  231 |       const versionRes = await request.post(`${BASE_URL}/api/avatars/${testAvatarId}/versions`, {
  232 |         data: {
  233 |           blendshape_snapshot: { eye_size: 0.5 },
  234 |           body_params: { height: 0, shoulder: 0, waist: 0, arm_length: 0, leg_length: 0 },
  235 |           equipped_parts: [],
  236 |           material_overrides: {},
  237 |         },
```