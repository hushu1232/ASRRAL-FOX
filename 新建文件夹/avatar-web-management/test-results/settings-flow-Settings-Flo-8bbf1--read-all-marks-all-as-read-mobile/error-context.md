# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: settings-flow.spec.ts >> Settings Flow E2E >> Notifications >> POST /api/notifications/read-all marks all as read
- Location: e2e\settings-flow.spec.ts:192:9

# Error details

```
Error: expect(received).toBe(expected) // Object.is equality

Expected: 200
Received: 405
```

# Test source

```ts
  96  |       expect(body.success).toBe(false);
  97  |     });
  98  | 
  99  |     test('PUT /api/settings/profile with missing newPassword is handled', async ({ request }) => {
  100 |       const res = await request.put(`${BASE_URL}/api/settings/profile`, {
  101 |         data: { currentPassword: TEST_PASSWORD },
  102 |         headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${authToken}` },
  103 |       });
  104 |       // Should succeed (password change skipped when newPassword is missing)
  105 |       expect(res.status()).toBe(200);
  106 |     });
  107 |   });
  108 | 
  109 |   test.describe('Login History', () => {
  110 |     test('GET /api/settings/login-history requires auth', async ({ request }) => {
  111 |       const res = await request.get(`${BASE_URL}/api/settings/login-history`);
  112 |       expect(res.status()).toBe(401);
  113 |     });
  114 | 
  115 |     test('GET /api/settings/login-history returns history', async ({ request }) => {
  116 |       const res = await request.get(`${BASE_URL}/api/settings/login-history`, {
  117 |         headers: { Authorization: `Bearer ${authToken}` },
  118 |       });
  119 |       expect(res.status()).toBe(200);
  120 |       const body = await res.json();
  121 |       expect(body.success).toBe(true);
  122 |     });
  123 |   });
  124 | 
  125 |   test.describe('API Keys', () => {
  126 |     let createdKeyId: string;
  127 | 
  128 |     test('GET /api/settings/api-keys lists keys', async ({ request }) => {
  129 |       const res = await request.get(`${BASE_URL}/api/settings/api-keys`, {
  130 |         headers: { Authorization: `Bearer ${authToken}` },
  131 |       });
  132 |       expect(res.status()).toBe(200);
  133 |       const body = await res.json();
  134 |       expect(body.success).toBe(true);
  135 |       expect(body.data).toBeDefined();
  136 |     });
  137 | 
  138 |     test('POST /api/settings/api-keys creates new API key', async ({ request }) => {
  139 |       const res = await request.post(`${BASE_URL}/api/settings/api-keys`, {
  140 |         data: { name: `E2E Test Key ${Date.now()}`, scopes: ['read'] },
  141 |         headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${authToken}` },
  142 |       });
  143 |       expect(res.status()).toBe(201);
  144 |       const body = await res.json();
  145 |       expect(body.success).toBe(true);
  146 |       expect(body.data.id).toBeDefined();
  147 |       expect(body.data.key).toBeDefined();
  148 |       createdKeyId = body.data.id;
  149 |     });
  150 | 
  151 |     test('DELETE /api/settings/api-keys/:id deletes API key', async ({ request }) => {
  152 |       if (!createdKeyId) {
  153 |         test.skip();
  154 |         return;
  155 |       }
  156 |       const res = await request.delete(`${BASE_URL}/api/settings/api-keys/${createdKeyId}`, {
  157 |         headers: { Authorization: `Bearer ${authToken}` },
  158 |       });
  159 |       expect(res.status()).toBe(200);
  160 |       const body = await res.json();
  161 |       expect(body.success).toBe(true);
  162 |     });
  163 | 
  164 |     test('DELETE /api/settings/api-keys/:id returns 404 for non-existent', async ({ request }) => {
  165 |       const res = await request.delete(`${BASE_URL}/api/settings/api-keys/non-existent-key`, {
  166 |         headers: { Authorization: `Bearer ${authToken}` },
  167 |       });
  168 |       expect(res.status()).toBe(404);
  169 |     });
  170 |   });
  171 | 
  172 |   test.describe('Notifications', () => {
  173 |     test('GET /api/notifications returns notifications list', async ({ request }) => {
  174 |       const res = await request.get(`${BASE_URL}/api/notifications`, {
  175 |         headers: { Authorization: `Bearer ${authToken}` },
  176 |       });
  177 |       expect(res.status()).toBe(200);
  178 |       const body = await res.json();
  179 |       expect(body.success).toBe(true);
  180 |     });
  181 | 
  182 |     test('GET /api/notifications/unread-count returns count', async ({ request }) => {
  183 |       const res = await request.get(`${BASE_URL}/api/notifications/unread-count`, {
  184 |         headers: { Authorization: `Bearer ${authToken}` },
  185 |       });
  186 |       expect(res.status()).toBe(200);
  187 |       const body = await res.json();
  188 |       expect(body.success).toBe(true);
  189 |       expect(typeof body.data.count).toBe('number');
  190 |     });
  191 | 
  192 |     test('POST /api/notifications/read-all marks all as read', async ({ request }) => {
  193 |       const res = await request.post(`${BASE_URL}/api/notifications/read-all`, {
  194 |         headers: { Authorization: `Bearer ${authToken}` },
  195 |       });
> 196 |       expect(res.status()).toBe(200);
      |                            ^ Error: expect(received).toBe(expected) // Object.is equality
  197 |       const body = await res.json();
  198 |       expect(body.success).toBe(true);
  199 |     });
  200 | 
  201 |     test('GET /api/notifications requires auth', async ({ request }) => {
  202 |       const res = await request.get(`${BASE_URL}/api/notifications`);
  203 |       expect(res.status()).toBe(401);
  204 |     });
  205 |   });
  206 | 
  207 |   test.describe('Dashboard', () => {
  208 |     test('GET /api/dashboard/stats returns user stats', async ({ request }) => {
  209 |       const res = await request.get(`${BASE_URL}/api/dashboard/stats`, {
  210 |         headers: { Authorization: `Bearer ${authToken}` },
  211 |       });
  212 |       expect(res.status()).toBe(200);
  213 |       const body = await res.json();
  214 |       expect(body.success).toBe(true);
  215 |     });
  216 | 
  217 |     test('GET /api/dashboard/stats requires auth', async ({ request }) => {
  218 |       const res = await request.get(`${BASE_URL}/api/dashboard/stats`);
  219 |       expect(res.status()).toBe(401);
  220 |     });
  221 |   });
  222 | 
  223 |   test.describe('2FA Settings', () => {
  224 |     test('GET /api/settings/2fa returns 2FA status', async ({ request }) => {
  225 |       const res = await request.get(`${BASE_URL}/api/settings/2fa`, {
  226 |         headers: { Authorization: `Bearer ${authToken}` },
  227 |       });
  228 |       // May return 200 or not yet implemented
  229 |       expect([200, 404, 405]).toContain(res.status());
  230 |     });
  231 |   });
  232 | });
  233 | 
```