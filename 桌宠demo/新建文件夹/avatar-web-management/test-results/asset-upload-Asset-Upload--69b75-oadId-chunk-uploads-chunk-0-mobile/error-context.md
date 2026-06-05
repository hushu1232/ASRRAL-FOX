# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: asset-upload.spec.ts >> Asset Upload E2E >> Chunk Upload >> PUT /api/assets/upload/:uploadId/chunk uploads chunk 0
- Location: e2e\asset-upload.spec.ts:123:9

# Error details

```
Error: expect(received).toContain(expected) // indexOf

Expected value: 405
Received array: [200, 400]
```

# Test source

```ts
  39  |       expect(body.data.chunkSize).toBeGreaterThan(0);
  40  |       expect(body.data.totalChunks).toBeGreaterThan(0);
  41  |       uploadId = body.data.uploadId;
  42  |     });
  43  | 
  44  |     test('POST /api/assets/upload/init creates upload session for PNG', async ({ request }) => {
  45  |       const res = await request.post(`${BASE_URL}/api/assets/upload/init`, {
  46  |         data: {
  47  |           filename: 'texture.png',
  48  |           fileSize: 2048,
  49  |           contentType: 'image/png',
  50  |         },
  51  |         headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${authToken}` },
  52  |       });
  53  |       expect(res.status()).toBe(200);
  54  |       const body = await res.json();
  55  |       expect(body.success).toBe(true);
  56  |     });
  57  | 
  58  |     test('POST /api/assets/upload/init rejects unsupported extension', async ({ request }) => {
  59  |       const res = await request.post(`${BASE_URL}/api/assets/upload/init`, {
  60  |         data: {
  61  |           filename: 'malware.exe',
  62  |           fileSize: 1024,
  63  |           contentType: 'application/octet-stream',
  64  |         },
  65  |         headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${authToken}` },
  66  |       });
  67  |       expect(res.status()).toBe(400);
  68  |       const body = await res.json();
  69  |       expect(body.success).toBe(false);
  70  |     });
  71  | 
  72  |     test('POST /api/assets/upload/init rejects zero file size', async ({ request }) => {
  73  |       const res = await request.post(`${BASE_URL}/api/assets/upload/init`, {
  74  |         data: {
  75  |           filename: 'empty.glb',
  76  |           fileSize: 0,
  77  |           contentType: 'model/gltf-binary',
  78  |         },
  79  |         headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${authToken}` },
  80  |       });
  81  |       expect(res.status()).toBe(400);
  82  |     });
  83  | 
  84  |     test('POST /api/assets/upload/init rejects oversized file', async ({ request }) => {
  85  |       const res = await request.post(`${BASE_URL}/api/assets/upload/init`, {
  86  |         data: {
  87  |           filename: 'huge.glb',
  88  |           fileSize: 600 * 1024 * 1024, // 600MB > 500MB limit
  89  |           contentType: 'model/gltf-binary',
  90  |         },
  91  |         headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${authToken}` },
  92  |       });
  93  |       expect(res.status()).toBe(400);
  94  |     });
  95  | 
  96  |     test('POST /api/assets/upload/init sanitizes dangerous filename', async ({ request }) => {
  97  |       const res = await request.post(`${BASE_URL}/api/assets/upload/init`, {
  98  |         data: {
  99  |           filename: '../../../etc/passwd.glb',
  100 |           fileSize: 1024,
  101 |           contentType: 'model/gltf-binary',
  102 |         },
  103 |         headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${authToken}` },
  104 |       });
  105 |       expect(res.status()).toBe(200);
  106 |       const body = await res.json();
  107 |       expect(body.success).toBe(true);
  108 |       // Should have sanitized the filename
  109 |     });
  110 | 
  111 |     test('POST /api/assets/upload/init requires auth', async ({ request }) => {
  112 |       const res = await request.post(`${BASE_URL}/api/assets/upload/init`, {
  113 |         data: { filename: 'test.glb', fileSize: 1024 },
  114 |         headers: { 'Content-Type': 'application/json' },
  115 |       });
  116 |       expect(res.status()).toBe(401);
  117 |     });
  118 |   });
  119 | 
  120 |   test.describe('Chunk Upload', () => {
  121 |     const chunkData = Buffer.from('A'.repeat(1024 * 64)); // 64KB mock chunk
  122 | 
  123 |     test('PUT /api/assets/upload/:uploadId/chunk uploads chunk 0', async ({ request }) => {
  124 |       if (!uploadId) {
  125 |         test.skip();
  126 |         return;
  127 |       }
  128 |       const res = await request.put(`${BASE_URL}/api/assets/upload/${uploadId}/chunk`, {
  129 |         data: chunkData,
  130 |         headers: {
  131 |           'Content-Type': 'application/octet-stream',
  132 |           'X-Chunk-Index': '0',
  133 |           'X-Total-Chunks': '1',
  134 |           Authorization: `Bearer ${authToken}`,
  135 |         },
  136 |       });
  137 |       // May return 200 (success) or 400 (if upload session expired)
  138 |       const validStatuses = [200, 400];
> 139 |       expect(validStatuses).toContain(res.status());
      |                             ^ Error: expect(received).toContain(expected) // indexOf
  140 |     });
  141 | 
  142 |     test('PUT /api/assets/upload/:uploadId/chunk requires auth', async ({ request }) => {
  143 |       const res = await request.put(`${BASE_URL}/api/assets/upload/fake-id/chunk`, {
  144 |         data: chunkData,
  145 |         headers: {
  146 |           'Content-Type': 'application/octet-stream',
  147 |           'X-Chunk-Index': '0',
  148 |           'X-Total-Chunks': '1',
  149 |         },
  150 |       });
  151 |       expect(res.status()).toBe(401);
  152 |     });
  153 |   });
  154 | 
  155 |   test.describe('Asset CRUD', () => {
  156 |     test('GET /api/assets returns paginated list', async ({ request }) => {
  157 |       const res = await request.get(`${BASE_URL}/api/assets`, {
  158 |         headers: { Authorization: `Bearer ${authToken}` },
  159 |       });
  160 |       expect(res.status()).toBe(200);
  161 |       const body = await res.json();
  162 |       expect(body.success).toBe(true);
  163 |       expect(body.data.items).toBeDefined();
  164 |       expect(Array.isArray(body.data.items)).toBe(true);
  165 |     });
  166 | 
  167 |     test('GET /api/assets supports type filter', async ({ request }) => {
  168 |       const res = await request.get(`${BASE_URL}/api/assets?type=model`, {
  169 |         headers: { Authorization: `Bearer ${authToken}` },
  170 |       });
  171 |       expect(res.status()).toBe(200);
  172 |       const body = await res.json();
  173 |       expect(body.success).toBe(true);
  174 |     });
  175 | 
  176 |     test('GET /api/assets supports format filter', async ({ request }) => {
  177 |       const res = await request.get(`${BASE_URL}/api/assets?format=glb`, {
  178 |         headers: { Authorization: `Bearer ${authToken}` },
  179 |       });
  180 |       expect(res.status()).toBe(200);
  181 |       const body = await res.json();
  182 |       expect(body.success).toBe(true);
  183 |     });
  184 | 
  185 |     test('GET /api/assets rejects unauthenticated', async ({ request }) => {
  186 |       const res = await request.get(`${BASE_URL}/api/assets`);
  187 |       expect(res.status()).toBe(401);
  188 |     });
  189 | 
  190 |     test('POST /api/assets/batch supports batch operation', async ({ request }) => {
  191 |       const res = await request.post(`${BASE_URL}/api/assets/batch`, {
  192 |         data: { action: 'delete', ids: [] },
  193 |         headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${authToken}` },
  194 |       });
  195 |       // Empty batch should be handled gracefully
  196 |       expect([200, 400]).toContain(res.status());
  197 |     });
  198 |   });
  199 | });
  200 | 
```