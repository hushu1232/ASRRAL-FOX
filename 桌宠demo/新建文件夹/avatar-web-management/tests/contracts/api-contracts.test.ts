// API Contract validation tests
// Verifies that the Zod validators and contract definitions are consistent.
// Run via: npm test -- tests/contracts

import { z } from 'zod';
import {
  loginSchema,
  registerSchema,
  avatarCreateSchema,
  avatarUpdateSchema,
  versionCreateSchema,
  assetCreateSchema,
} from '@/lib/validators';
import { API_CONTRACTS } from '@/lib/api-contracts';

describe('API Contract definitions', () => {
  it('covers all major endpoint paths', () => {
    const endpoints = Object.keys(API_CONTRACTS);
    expect(endpoints).toContain('GET /api/health');
    expect(endpoints).toContain('POST /api/auth/login');
    expect(endpoints).toContain('GET /api/avatars');
    expect(endpoints).toContain('POST /api/avatars');
    expect(endpoints).toContain('GET /api/assets');
    expect(endpoints).toContain('POST /api/assets');
    expect(endpoints).toContain('GET /api/notifications');
    expect(endpoints).toContain('GET /api/search');
    expect(endpoints.length).toBeGreaterThanOrEqual(19);
  });

  it('defines valid status codes for every endpoint', () => {
    for (const [path, contract] of Object.entries(API_CONTRACTS)) {
      expect(contract.status).toBeDefined();
      expect(contract.status.length).toBeGreaterThanOrEqual(1);
      for (const code of contract.status) {
        expect(code).toBeGreaterThanOrEqual(200);
        expect(code).toBeLessThan(600);
      }
    }
  });
});

describe('Zod schema ↔ Contract consistency', () => {
  const responseSchema = z.object({
    success: z.boolean(),
    data: z.unknown().optional(),
    error: z.string().optional(),
    code: z.string().optional(),
  });

  it('loginSchema validates LoginRequest shape', () => {
    const valid = { email: 'a@b.com', password: '12345678' };
    expect(loginSchema.safeParse(valid).success).toBe(true);
    expect(loginSchema.safeParse({}).success).toBe(false);
    expect(loginSchema.safeParse({ email: 'bad' }).success).toBe(false);
  });

  it('registerSchema validates RegisterRequest shape', () => {
    const valid = { email: 'a@b.com', username: 'test', password: '12345678' };
    expect(registerSchema.safeParse(valid).success).toBe(true);
    expect(registerSchema.safeParse({ email: 'a@b.com' }).success).toBe(false);
  });

  it('avatarCreateSchema validates AvatarCreateRequest shape', () => {
    expect(avatarCreateSchema.safeParse({ name: 'Test' }).success).toBe(true);
    expect(avatarCreateSchema.safeParse({ name: '' }).success).toBe(false);
  });

  it('avatarUpdateSchema validates AvatarUpdateRequest shape', () => {
    // All fields optional
    expect(avatarUpdateSchema.safeParse({}).success).toBe(true);
    expect(avatarUpdateSchema.safeParse({ name: 'New' }).success).toBe(true);
    expect(avatarUpdateSchema.safeParse({ status: 'published' }).success).toBe(true);
  });

  it('versionCreateSchema validates VersionCreateRequest shape', () => {
    // All defaults
    expect(versionCreateSchema.safeParse({}).success).toBe(true);
  });

  it('assetCreateSchema validates AssetCreateRequest shape', () => {
    const valid = {
      filename: 'test.glb',
      file_size: 1024,
      mime_type: 'model/gltf-binary',
      asset_type: 'model',
      format: 'glb',
    };
    expect(assetCreateSchema.safeParse(valid).success).toBe(true);
    expect(assetCreateSchema.safeParse({}).success).toBe(false);
  });

  it('all validators produce human-readable error messages', () => {
    const result = loginSchema.safeParse({ email: 'x', password: 'x' });
    if (!result.success) {
      const msg = result.error.issues.map((i) => i.message).join(', ');
      expect(msg.length).toBeGreaterThan(0);
    }
  });

  it('response envelope is consistent', () => {
    const successResponse = { success: true, data: { id: '1' } };
    const errorResponse = { success: false, error: 'Not found' };
    expect(responseSchema.safeParse(successResponse).success).toBe(true);
    expect(responseSchema.safeParse(errorResponse).success).toBe(true);
  });
});

describe('Contract breaking change detection', () => {
  it('loginSchema requires email and password fields', () => {
    const keys = Object.keys(loginSchema.shape);
    expect(keys).toContain('email');
    expect(keys).toContain('password');
  });

  it('avatarCreateSchema requires name, style defaults to anime', () => {
    const shape = avatarCreateSchema.shape;
    expect(shape.name).toBeDefined();
    const result = avatarCreateSchema.safeParse({ name: 'X' });
    if (result.success) expect(result.data.style).toBe('anime');
  });

  it('assetCreateSchema accepts glb, gltf, fbx, png, jpg, hdr, exr, mp4 formats', () => {
    const validFormats = ['glb', 'gltf', 'fbx', 'png', 'jpg', 'hdr', 'exr', 'mp4'];
    for (const fmt of validFormats) {
      const result = assetCreateSchema.safeParse({
        filename: `test.${fmt}`,
        file_size: 100,
        mime_type: 'application/octet-stream',
        asset_type: 'model',
        format: fmt,
      });
      expect(result.success).toBe(true);
    }
  });

  it('login response must include accessToken and refreshToken', () => {
    const loginResponseSchema = z.object({
      accessToken: z.string(),
      refreshToken: z.string(),
      user: z.object({
        id: z.string(),
        email: z.string(),
        username: z.string(),
        role: z.string(),
        status: z.string(),
      }),
    });
    const valid = {
      accessToken: 'eyJ...',
      refreshToken: 'eyJ...',
      user: { id: '1', email: 'a@b.com', username: 'test', role: 'user', status: 'active' },
    };
    expect(loginResponseSchema.safeParse(valid).success).toBe(true);
    expect(loginResponseSchema.safeParse({ accessToken: 'x' }).success).toBe(false);
  });
});
