# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: api.spec.ts >> API E2E >> GET /api/templates returns templates
- Location: e2e\api.spec.ts:76:7

# Error details

```
Error: expect(received).toBe(expected) // Object.is equality

Expected: 200
Received: 401
```

# Test source

```ts
  1  | import { test, expect, type APIRequestContext } from '@playwright/test';
  2  | 
  3  | const BASE_URL = 'http://localhost:3000';
  4  | const TEST_EMAIL = 'demo@example.com';
  5  | const TEST_PASSWORD = 'demo1234';
  6  | 
  7  | async function getAuthToken(request: APIRequestContext) {
  8  |   const res = await request.post(`${BASE_URL}/api/auth/login`, {
  9  |     data: { email: TEST_EMAIL, password: TEST_PASSWORD },
  10 |     headers: { 'Content-Type': 'application/json' },
  11 |   });
  12 |   const body = await res.json();
  13 |   if (!body.success) throw new Error(`Login failed: ${body.error}`);
  14 |   return body.data?.accessToken || '';
  15 | }
  16 | 
  17 | test.describe('API E2E', () => {
  18 |   test('GET /api/health returns ok', async ({ request }) => {
  19 |     const res = await request.get(`${BASE_URL}/api/health`);
  20 |     expect(res.status()).toBe(200);
  21 |     const body = await res.json();
  22 |     expect(body).toHaveProperty('status');
  23 |   });
  24 | 
  25 |   test('POST /api/auth/login with valid credentials', async ({ request }) => {
  26 |     const res = await request.post(`${BASE_URL}/api/auth/login`, {
  27 |       data: { email: TEST_EMAIL, password: TEST_PASSWORD },
  28 |       headers: { 'Content-Type': 'application/json' },
  29 |     });
  30 |     expect(res.status()).toBe(200);
  31 |     const body = await res.json();
  32 |     expect(body.success).toBe(true);
  33 |     expect(body.data).toBeDefined();
  34 |   });
  35 | 
  36 |   test('POST /api/auth/login with bad password returns error', async ({ request }) => {
  37 |     const res = await request.post(`${BASE_URL}/api/auth/login`, {
  38 |       data: { email: TEST_EMAIL, password: 'wrong' },
  39 |       headers: { 'Content-Type': 'application/json' },
  40 |     });
  41 |     const body = await res.json();
  42 |     expect(body.success).toBe(false);
  43 |   });
  44 | 
  45 |   test('GET /api/parts returns 401 without auth', async ({ request }) => {
  46 |     const res = await request.get(`${BASE_URL}/api/parts`);
  47 |     expect(res.status()).toBe(401);
  48 |   });
  49 | 
  50 |   test('GET /api/parts returns parts with auth', async ({ request }) => {
  51 |     const token = await getAuthToken(request);
  52 |     const res = await request.get(`${BASE_URL}/api/parts`, {
  53 |       headers: { Authorization: `Bearer ${token}` },
  54 |     });
  55 |     expect(res.status()).toBe(200);
  56 |     const body = await res.json();
  57 |     expect(body.success).toBe(true);
  58 |     expect(Array.isArray(body.data)).toBe(true);
  59 |   });
  60 | 
  61 |   test('GET /api/avatars returns 401 without auth', async ({ request }) => {
  62 |     const res = await request.get(`${BASE_URL}/api/avatars`);
  63 |     expect(res.status()).toBe(401);
  64 |   });
  65 | 
  66 |   test('GET /api/avatars returns avatars with auth', async ({ request }) => {
  67 |     const token = await getAuthToken(request);
  68 |     const res = await request.get(`${BASE_URL}/api/avatars`, {
  69 |       headers: { Authorization: `Bearer ${token}` },
  70 |     });
  71 |     expect(res.status()).toBe(200);
  72 |     const body = await res.json();
  73 |     expect(body.success).toBe(true);
  74 |   });
  75 | 
  76 |   test('GET /api/templates returns templates', async ({ request }) => {
  77 |     const res = await request.get(`${BASE_URL}/api/templates`);
> 78 |     expect(res.status()).toBe(200);
     |                          ^ Error: expect(received).toBe(expected) // Object.is equality
  79 |     const body = await res.json();
  80 |     expect(body.success).toBe(true);
  81 |   });
  82 | 
  83 |   test('GET /api/assets requires auth', async ({ request }) => {
  84 |     const res = await request.get(`${BASE_URL}/api/assets`);
  85 |     expect(res.status()).toBe(401);
  86 |   });
  87 | 
  88 |   test('GET /api/settings/profile requires auth', async ({ request }) => {
  89 |     const res = await request.get(`${BASE_URL}/api/settings/profile`);
  90 |     expect(res.status()).toBe(401);
  91 |   });
  92 | });
  93 | 
```