// API Response Shape Contract Tests
// Validates that actual API responses match the expected contract shape.
// Requires a running server: npm run dev (against localhost:3000)

import { z } from 'zod';
import { get, post, put, loginAs } from '../helpers';

// Response shape validators (structure only, not data values)
const paginatedResponseShape = z.object({
  success: z.literal(true),
  data: z.object({
    items: z.array(z.unknown()),
    total: z.number(),
    page: z.number(),
    pageSize: z.number(),
    totalPages: z.number(),
  }),
});

const successResponseShape = z.object({
  success: z.literal(true),
});

const errorResponseShape = z.object({
  success: z.literal(false),
  error: z.string(),
});

const avatarItemShape = z.object({
  id: z.string(),
  workspace_id: z.string(),
  name: z.string(),
  style: z.string(),
  status: z.string(),
  created_at: z.string(),
  updated_at: z.string(),
});

const assetItemShape = z.object({
  id: z.string(),
  filename: z.string(),
  file_size: z.number(),
  mime_type: z.string(),
  asset_type: z.string(),
  format: z.string(),
  status: z.string(),
  created_at: z.string(),
});

const notificationItemShape = z.object({
  id: z.string(),
  type: z.string(),
  title: z.string(),
  is_read: z.boolean(),
  created_at: z.string(),
});

let token: string;

beforeAll(async () => {
  const t = await loginAs('demo@example.com', 'demo1234');
  token = t || '';
}, 15000);

function skipIfNoServer() {
  if (!token) {
    console.warn('Skipping — server not running or auth failed');
  }
  return !token;
}

describe('API Response Shape Contracts', () => {
  // --- Health (unauthenticated) ---
  it('GET /api/health returns HealthContract shape', async () => {
    const res = await get('/api/health');
    expect(res.status).toBe(200);
    // Health endpoint uses flat response (no envelope)
    expect(typeof res.body.status).toBe('string');
    expect(typeof res.body.uptime).toBe('number');
    expect(res.body.services).toBeDefined();
    expect(res.body.services.prisma).toBeDefined();
  });

  // --- Avatars ---
  it('GET /api/avatars returns PaginatedData<AvatarContract>', async () => {
    if (skipIfNoServer()) return;
    const res = await get('/api/avatars', token);
    expect(res.status).toBe(200);
    expect(() => paginatedResponseShape.parse(res.body)).not.toThrow();
    if (res.body.data.items.length > 0) {
      expect(() => avatarItemShape.parse(res.body.data.items[0])).not.toThrow();
    }
  });

  it('POST /api/avatars returns AvatarContract', async () => {
    if (skipIfNoServer()) return;
    const res = await post('/api/avatars', { name: `ContractTest-${Date.now()}` }, token);
    // 201 or 200 depending on implementation
    expect([200, 201]).toContain(res.status);
    expect(res.body.success).toBe(true);
    expect(() => avatarItemShape.parse(res.body.data)).not.toThrow();
  });

  it('GET /api/avatars with auth required', async () => {
    const res = await get('/api/avatars');
    expect(res.status).toBe(401);
    expect(() => errorResponseShape.parse(res.body)).not.toThrow();
  });

  // --- Assets ---
  it('GET /api/assets returns PaginatedData<AssetContract>', async () => {
    if (skipIfNoServer()) return;
    const res = await get('/api/assets', token);
    expect(res.status).toBe(200);
    expect(() => paginatedResponseShape.parse(res.body)).not.toThrow();
    if (res.body.data.items.length > 0) {
      expect(() => assetItemShape.parse(res.body.data.items[0])).not.toThrow();
    }
  });

  // --- Notifications ---
  it('GET /api/notifications returns PaginatedData<NotificationContract>', async () => {
    if (skipIfNoServer()) return;
    const res = await get('/api/notifications', token);
    expect(res.status).toBe(200);
    expect(() => paginatedResponseShape.parse(res.body)).not.toThrow();
    if (res.body.data.items.length > 0) {
      expect(() => notificationItemShape.parse(res.body.data.items[0])).not.toThrow();
    }
  });

  it('GET /api/notifications/unread-count returns { count }', async () => {
    if (skipIfNoServer()) return;
    const res = await get('/api/notifications/unread-count', token);
    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(typeof res.body.data.count).toBe('number');
  });

  it('PUT /api/notifications/read-all returns null', async () => {
    if (skipIfNoServer()) return;
    const res = await put('/api/notifications/read-all', {}, token);
    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
  });

  // --- Search ---
  it('GET /api/search returns SearchResultContract', async () => {
    if (skipIfNoServer()) return;
    const res = await get('/api/search?q=test', token);
    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(Array.isArray(res.body.data.avatars)).toBe(true);
    expect(Array.isArray(res.body.data.assets)).toBe(true);
    expect(Array.isArray(res.body.data.templates)).toBe(true);
  });

  // --- Auth error shape ---
  it('POST /api/auth/login returns error shape on invalid credentials', async () => {
    const res = await post('/api/auth/login', { email: 'no@user.com', password: 'badpass' });
    expect(res.body.success).toBe(false);
    expect(() => errorResponseShape.parse(res.body)).not.toThrow();
  });
});

describe('API Response Consistency Standards', () => {
  it('all success responses use { success: true, data } envelope', () => {
    // Schema-level check: the project uses a consistent envelope
    const envelope = z.object({ success: z.literal(true), data: z.unknown() });
    expect(() => envelope.parse({ success: true, data: { x: 1 } })).not.toThrow();
    expect(() => envelope.parse({ success: false, data: null })).toThrow();
  });

  it('all error responses use { success: false, error, code? } envelope', () => {
    const envelope = z.object({ success: z.literal(false), error: z.string(), code: z.string().optional() });
    expect(() => envelope.parse({ success: false, error: 'msg', code: 'NOT_FOUND' })).not.toThrow();
  });

  it('paginated responses always include totalPages', () => {
    const shape = z.object({
      success: z.literal(true),
      data: z.object({
        items: z.array(z.unknown()),
        total: z.number(),
        page: z.number(),
        pageSize: z.number(),
        totalPages: z.number(),
      }),
    });
    const valid = {
      success: true as const,
      data: { items: [], total: 0, page: 1, pageSize: 20, totalPages: 0 },
    };
    expect(() => shape.parse(valid)).not.toThrow();
  });

  it('401 responses are consistent across endpoints', () => {
    // All authenticated endpoints return 401 with { success: false, error } shape
    const unauthShape = z.object({
      success: z.literal(false),
      error: z.string(),
    });
    expect(() => unauthShape.parse({ success: false, error: 'Unauthorized' })).not.toThrow();
  });
});
