# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: avatar-crud.spec.ts >> Avatar CRUD E2E >> Create >> POST /api/avatars defaults style to anime
- Location: e2e\avatar-crud.spec.ts:56:9

# Error details

```
Error: expect(received).toBe(expected) // Object.is equality

Expected: "female"
Received: "/models/base-female.glb"
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
  17  | test.describe('Avatar CRUD E2E', () => {
  18  |   let createdAvatarId: string;
  19  |   let authToken: string;
  20  | 
  21  |   test.beforeAll(async ({ request }) => {
  22  |     authToken = await getAuthToken(request);
  23  |   });
  24  | 
  25  |   test.describe('Create', () => {
  26  |     test('POST /api/avatars creates avatar with minimal fields', async ({ request }) => {
  27  |       const res = await request.post(`${BASE_URL}/api/avatars`, {
  28  |         data: { name: 'CRUD Create Test', style: 'anime', base_model: 'female' },
  29  |         headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${authToken}` },
  30  |       });
  31  |       expect(res.status()).toBe(201);
  32  |       const body = await res.json();
  33  |       expect(body.success).toBe(true);
  34  |       expect(body.data.id).toBeDefined();
  35  |       expect(body.data.name).toBe('CRUD Create Test');
  36  |       createdAvatarId = body.data.id;
  37  |     });
  38  | 
  39  |     test('POST /api/avatars strips HTML from name', async ({ request }) => {
  40  |       const res = await request.post(`${BASE_URL}/api/avatars`, {
  41  |         data: { name: '<b>HTML</b> Name', style: 'realistic', base_model: 'male' },
  42  |         headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${authToken}` },
  43  |       });
  44  |       expect(res.status()).toBe(201);
  45  |       const body = await res.json();
  46  |       // Name should be sanitized (no HTML tags)
  47  |       expect(body.data.name).not.toContain('<');
  48  |       expect(body.data.name).not.toContain('>');
  49  | 
  50  |       // Clean up
  51  |       await request.delete(`${BASE_URL}/api/avatars/${body.data.id}`, {
  52  |         headers: { Authorization: `Bearer ${authToken}` },
  53  |       });
  54  |     });
  55  | 
  56  |     test('POST /api/avatars defaults style to anime', async ({ request }) => {
  57  |       const res = await request.post(`${BASE_URL}/api/avatars`, {
  58  |         data: { name: 'Default Style Test' },
  59  |         headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${authToken}` },
  60  |       });
  61  |       expect(res.status()).toBe(201);
  62  |       const body = await res.json();
  63  |       expect(body.data.style).toBe('anime');
> 64  |       expect(body.data.base_model).toBe('female');
      |                                    ^ Error: expect(received).toBe(expected) // Object.is equality
  65  | 
  66  |       // Clean up
  67  |       await request.delete(`${BASE_URL}/api/avatars/${body.data.id}`, {
  68  |         headers: { Authorization: `Bearer ${authToken}` },
  69  |       });
  70  |     });
  71  | 
  72  |     test('POST /api/avatars rejects empty name', async ({ request }) => {
  73  |       const res = await request.post(`${BASE_URL}/api/avatars`, {
  74  |         data: { name: '' },
  75  |         headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${authToken}` },
  76  |       });
  77  |       expect(res.status()).toBe(400);
  78  |     });
  79  | 
  80  |     test('POST /api/avatars rejects name over 64 chars', async ({ request }) => {
  81  |       const res = await request.post(`${BASE_URL}/api/avatars`, {
  82  |         data: { name: 'x'.repeat(65) },
  83  |         headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${authToken}` },
  84  |       });
  85  |       expect(res.status()).toBe(400);
  86  |     });
  87  | 
  88  |     test('POST /api/avatars accepts all valid styles', async ({ request }) => {
  89  |       const styles = ['anime', 'realistic', 'lowpoly', 'korean', 'western', 'chibi'];
  90  |       for (const style of styles) {
  91  |         const res = await request.post(`${BASE_URL}/api/avatars`, {
  92  |           data: { name: `Style ${style}`, style },
  93  |           headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${authToken}` },
  94  |         });
  95  |         expect(res.status()).toBe(201);
  96  |         const body = await res.json();
  97  |         expect(body.data.style).toBe(style);
  98  | 
  99  |         // Clean up
  100 |         await request.delete(`${BASE_URL}/api/avatars/${body.data.id}`, {
  101 |           headers: { Authorization: `Bearer ${authToken}` },
  102 |         });
  103 |       }
  104 |     });
  105 |   });
  106 | 
  107 |   test.describe('Read', () => {
  108 |     test('GET /api/avatars returns paginated list', async ({ request }) => {
  109 |       const res = await request.get(`${BASE_URL}/api/avatars`, {
  110 |         headers: { Authorization: `Bearer ${authToken}` },
  111 |       });
  112 |       expect(res.status()).toBe(200);
  113 |       const body = await res.json();
  114 |       expect(body.success).toBe(true);
  115 |       expect(body.data.items).toBeDefined();
  116 |       expect(Array.isArray(body.data.items)).toBe(true);
  117 |       expect(typeof body.data.total).toBe('number');
  118 |       expect(typeof body.data.page).toBe('number');
  119 |       expect(typeof body.data.pageSize).toBe('number');
  120 |       expect(typeof body.data.totalPages).toBe('number');
  121 |     });
  122 | 
  123 |     test('GET /api/avatars supports search param', async ({ request }) => {
  124 |       const res = await request.get(`${BASE_URL}/api/avatars?search=CRUD`, {
  125 |         headers: { Authorization: `Bearer ${authToken}` },
  126 |       });
  127 |       expect(res.status()).toBe(200);
  128 |       const body = await res.json();
  129 |       expect(body.success).toBe(true);
  130 |     });
  131 | 
  132 |     test('GET /api/avatars supports status filter', async ({ request }) => {
  133 |       const res = await request.get(`${BASE_URL}/api/avatars?status=draft`, {
  134 |         headers: { Authorization: `Bearer ${authToken}` },
  135 |       });
  136 |       expect(res.status()).toBe(200);
  137 |       const body = await res.json();
  138 |       expect(body.success).toBe(true);
  139 |     });
  140 | 
  141 |     test('GET /api/avatars/:id returns single avatar', async ({ request }) => {
  142 |       if (!createdAvatarId) {
  143 |         test.skip();
  144 |         return;
  145 |       }
  146 |       const res = await request.get(`${BASE_URL}/api/avatars/${createdAvatarId}`, {
  147 |         headers: { Authorization: `Bearer ${authToken}` },
  148 |       });
  149 |       expect(res.status()).toBe(200);
  150 |       const body = await res.json();
  151 |       expect(body.success).toBe(true);
  152 |       expect(body.data.id).toBe(createdAvatarId);
  153 |       expect(body.data.versions).toBeDefined();
  154 |     });
  155 | 
  156 |     test('GET /api/avatars/:id returns 404 for non-existent id', async ({ request }) => {
  157 |       const res = await request.get(`${BASE_URL}/api/avatars/non-existent-id-12345`, {
  158 |         headers: { Authorization: `Bearer ${authToken}` },
  159 |       });
  160 |       expect(res.status()).toBe(404);
  161 |     });
  162 |   });
  163 | 
  164 |   test.describe('Update', () => {
```