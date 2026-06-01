# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: approval-flow.spec.ts >> Approval Flow E2E >> Review List >> GET /api/admin/reviews filters by status
- Location: e2e\approval-flow.spec.ts:86:9

# Error details

```
Error: expect(received).toBe(expected) // Object.is equality

Expected: 200
Received: 403
```

# Test source

```ts
  1   | import { test, expect, type APIRequestContext } from '@playwright/test';
  2   | 
  3   | const BASE_URL = 'http://localhost:3000';
  4   | const TEST_EMAIL = 'demo@example.com';
  5   | const TEST_PASSWORD = 'demo1234';
  6   | 
  7   | async function getAuthToken(request: APIRequestContext) {
  8   |   const res = await request.post(`${BASE_URL}/api/auth/login`, {
  9   |     data: { email: TEST_EMAIL, password: TEST_PASSWORD },
  10  |     headers: { 'Content-Type': 'application/json' },
  11  |   });
  12  |   const body = await res.json();
  13  |   if (!body.success) throw new Error(`Login failed: ${body.error}`);
  14  |   return body.data?.accessToken || '';
  15  | }
  16  | 
  17  | test.describe('Approval Flow E2E', () => {
  18  |   let authToken: string;
  19  |   let testAvatarId: string;
  20  |   let testVersionId: string;
  21  | 
  22  |   test.beforeAll(async ({ request }) => {
  23  |     authToken = await getAuthToken(request);
  24  |   });
  25  | 
  26  |   test.describe('Setup: Create avatar and submit version', () => {
  27  |     test('Create avatar for approval testing', async ({ request }) => {
  28  |       const res = await request.post(`${BASE_URL}/api/avatars`, {
  29  |         data: { name: 'Approval E2E Test', style: 'realistic', base_model: 'female' },
  30  |         headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${authToken}` },
  31  |       });
  32  |       expect(res.status()).toBe(201);
  33  |       const body = await res.json();
  34  |       testAvatarId = body.data.id;
  35  |     });
  36  | 
  37  |     test('Create version for review', async ({ request }) => {
  38  |       if (!testAvatarId) {
  39  |         test.skip();
  40  |         return;
  41  |       }
  42  |       const res = await request.post(`${BASE_URL}/api/avatars/${testAvatarId}/versions`, {
  43  |         data: {
  44  |           blendshape_snapshot: { eye_size: 0.5, jaw_width: -0.3 },
  45  |           body_params: { height: 0, shoulder: 0, waist: 0, arm_length: 0, leg_length: 0 },
  46  |           equipped_parts: [],
  47  |           material_overrides: {},
  48  |         },
  49  |         headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${authToken}` },
  50  |       });
  51  |       expect(res.status()).toBe(201);
  52  | 
  53  |       // Fetch the version ID from the avatar detail
  54  |       const detailRes = await request.get(`${BASE_URL}/api/avatars/${testAvatarId}`, {
  55  |         headers: { Authorization: `Bearer ${authToken}` },
  56  |       });
  57  |       const detailBody = await detailRes.json();
  58  |       if (detailBody.data?.versions?.length > 0) {
  59  |         testVersionId = detailBody.data.versions[0].id;
  60  |       }
  61  |     });
  62  |   });
  63  | 
  64  |   test.describe('Review List', () => {
  65  |     test('GET /api/admin/reviews returns paginated review list', async ({ request }) => {
  66  |       const res = await request.get(`${BASE_URL}/api/admin/reviews?status=pending_review`, {
  67  |         headers: { Authorization: `Bearer ${authToken}` },
  68  |       });
  69  |       expect(res.status()).toBe(200);
  70  |       const body = await res.json();
  71  |       expect(body.success).toBe(true);
  72  |       expect(body.data.items).toBeDefined();
  73  |       expect(Array.isArray(body.data.items)).toBe(true);
  74  |     });
  75  | 
  76  |     test('GET /api/admin/reviews supports pagination', async ({ request }) => {
  77  |       const res = await request.get(`${BASE_URL}/api/admin/reviews?status=pending_review&page=1&pageSize=5`, {
  78  |         headers: { Authorization: `Bearer ${authToken}` },
  79  |       });
  80  |       expect(res.status()).toBe(200);
  81  |       const body = await res.json();
  82  |       expect(body.data.page).toBe(1);
  83  |       expect(body.data.pageSize).toBe(5);
  84  |     });
  85  | 
  86  |     test('GET /api/admin/reviews filters by status', async ({ request }) => {
  87  |       const statuses = ['pending_review', 'approved', 'rejected'];
  88  |       for (const status of statuses) {
  89  |         const res = await request.get(`${BASE_URL}/api/admin/reviews?status=${status}`, {
  90  |           headers: { Authorization: `Bearer ${authToken}` },
  91  |         });
> 92  |         expect(res.status()).toBe(200);
      |                              ^ Error: expect(received).toBe(expected) // Object.is equality
  93  |       }
  94  |     });
  95  | 
  96  |     test('GET /api/admin/reviews rejects non-auditor', async ({ request }) => {
  97  |       // Regular user token should get 403
  98  |       // This test validates that role checking works
  99  |       const res = await request.get(`${BASE_URL}/api/admin/reviews`, {
  100 |         headers: { Authorization: `Bearer ${authToken}` },
  101 |       });
  102 |       // demo user may or may not have auditor role
  103 |       const validStatuses = [200, 403];
  104 |       expect(validStatuses).toContain(res.status());
  105 |     });
  106 |   });
  107 | 
  108 |   test.describe('Review Action', () => {
  109 |     test('PUT /api/admin/reviews/:id rejects invalid action', async ({ request }) => {
  110 |       if (!testVersionId) {
  111 |         test.skip();
  112 |         return;
  113 |       }
  114 |       const res = await request.put(`${BASE_URL}/api/admin/reviews/${testVersionId}`, {
  115 |         data: { action: 'invalid_action' },
  116 |         headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${authToken}` },
  117 |       });
  118 |       // 400 (bad action) or 403 (not auditor) or 404
  119 |       const validStatuses = [400, 403, 404];
  120 |       expect(validStatuses).toContain(res.status());
  121 |     });
  122 | 
  123 |     test('PUT /api/admin/reviews/:id with approve action', async ({ request }) => {
  124 |       if (!testVersionId) {
  125 |         test.skip();
  126 |         return;
  127 |       }
  128 |       const res = await request.put(`${BASE_URL}/api/admin/reviews/${testVersionId}`, {
  129 |         data: { action: 'approved', comment: 'Looks good!' },
  130 |         headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${authToken}` },
  131 |       });
  132 |       // 200 (success), 403 (not auditor), 400 (not pending_review)
  133 |       const validStatuses = [200, 400, 403];
  134 |       expect(validStatuses).toContain(res.status());
  135 |     });
  136 | 
  137 |     test('PUT /api/admin/reviews/:id with reject action', async ({ request }) => {
  138 |       if (!testVersionId) {
  139 |         test.skip();
  140 |         return;
  141 |       }
  142 |       const res = await request.put(`${BASE_URL}/api/admin/reviews/${testVersionId}`, {
  143 |         data: { action: 'rejected', comment: 'Needs improvement' },
  144 |         headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${authToken}` },
  145 |       });
  146 |       const validStatuses = [200, 400, 403];
  147 |       expect(validStatuses).toContain(res.status());
  148 |     });
  149 | 
  150 |     test('PUT /api/admin/reviews/:id returns 404 for non-existent version', async ({ request }) => {
  151 |       const res = await request.put(`${BASE_URL}/api/admin/reviews/non-existent-id-99999`, {
  152 |         data: { action: 'approved' },
  153 |         headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${authToken}` },
  154 |       });
  155 |       const validStatuses = [404, 403];
  156 |       expect(validStatuses).toContain(res.status());
  157 |     });
  158 |   });
  159 | 
  160 |   test.describe('Audit Trail', () => {
  161 |     test('GET /api/admin/audit-logs requires auth', async ({ request }) => {
  162 |       const res = await request.get(`${BASE_URL}/api/admin/audit-logs`);
  163 |       expect(res.status()).toBe(401);
  164 |     });
  165 | 
  166 |     test('GET /api/admin/audit-logs returns logs with auth', async ({ request }) => {
  167 |       const res = await request.get(`${BASE_URL}/api/admin/audit-logs`, {
  168 |         headers: { Authorization: `Bearer ${authToken}` },
  169 |       });
  170 |       const validStatuses = [200, 403];
  171 |       expect(validStatuses).toContain(res.status());
  172 |     });
  173 |   });
  174 | 
  175 |   test.describe('Admin Stats', () => {
  176 |     test('GET /api/admin/stats returns dashboard stats', async ({ request }) => {
  177 |       const res = await request.get(`${BASE_URL}/api/admin/stats`, {
  178 |         headers: { Authorization: `Bearer ${authToken}` },
  179 |       });
  180 |       const validStatuses = [200, 403];
  181 |       expect(validStatuses).toContain(res.status());
  182 |     });
  183 |   });
  184 | 
  185 |   // Clean up
  186 |   test.afterAll(async ({ request }) => {
  187 |     if (testAvatarId) {
  188 |       await request.delete(`${BASE_URL}/api/avatars/${testAvatarId}`, {
  189 |         headers: { Authorization: `Bearer ${authToken}` },
  190 |       });
  191 |     }
  192 |   });
```