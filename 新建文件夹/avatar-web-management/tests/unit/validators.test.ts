import { loginSchema, registerSchema, avatarCreateSchema, avatarUpdateSchema, versionCreateSchema, profileUpdateSchema, assetCreateSchema } from '@/lib/validators';

describe('loginSchema', () => {
  it('accepts valid email + password', () => {
    const result = loginSchema.safeParse({ email: 'user@example.com', password: 'password123' });
    expect(result.success).toBe(true);
  });

  it('rejects invalid email', () => {
    const result = loginSchema.safeParse({ email: 'not-an-email', password: 'password123' });
    expect(result.success).toBe(false);
  });

  it('rejects short password (under 6 chars)', () => {
    const result = loginSchema.safeParse({ email: 'a@b.com', password: '12345' });
    expect(result.success).toBe(false);
  });

  it('rejects password over 128 chars', () => {
    const result = loginSchema.safeParse({ email: 'a@b.com', password: 'x'.repeat(129) });
    expect(result.success).toBe(false);
  });

  it('rejects empty object', () => {
    const result = loginSchema.safeParse({});
    expect(result.success).toBe(false);
  });

  it('accepts password exactly 6 chars', () => {
    const result = loginSchema.safeParse({ email: 'a@b.com', password: '123456' });
    expect(result.success).toBe(true);
  });
});

describe('registerSchema', () => {
  it('accepts valid registration data', () => {
    const result = registerSchema.safeParse({
      email: 'newuser@example.com',
      username: 'newuser123',
      password: 'securepassword',
    });
    expect(result.success).toBe(true);
  });

  it('rejects username shorter than 2 chars', () => {
    const result = registerSchema.safeParse({
      email: 'a@b.com',
      username: 'a',
      password: '12345678',
    });
    expect(result.success).toBe(false);
  });

  it('rejects username with special chars', () => {
    const result = registerSchema.safeParse({
      email: 'a@b.com',
      username: 'user<script>',
      password: '12345678',
    });
    expect(result.success).toBe(false);
  });

  it('accepts Chinese characters in username', () => {
    const result = registerSchema.safeParse({
      email: 'a@b.com',
      username: '用户名测试',
      password: '12345678',
    });
    expect(result.success).toBe(true);
  });

  it('rejects password shorter than 8 chars', () => {
    const result = registerSchema.safeParse({
      email: 'a@b.com',
      username: 'validuser',
      password: 'short',
    });
    expect(result.success).toBe(false);
  });

  it('rejects username longer than 32 chars', () => {
    const result = registerSchema.safeParse({
      email: 'a@b.com',
      username: 'x'.repeat(33),
      password: '12345678',
    });
    expect(result.success).toBe(false);
  });
});

describe('avatarCreateSchema', () => {
  it('accepts valid avatar data', () => {
    const result = avatarCreateSchema.safeParse({
      name: 'My Avatar',
      style: 'anime',
      base_model: 'female',
    });
    expect(result.success).toBe(true);
  });

  it('strips HTML from name', () => {
    const result = avatarCreateSchema.safeParse({
      name: '<b>Cool</b> Avatar',
      style: 'anime',
      base_model: 'male',
    });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.name).toBe('Cool Avatar');
    }
  });

  it('rejects empty name', () => {
    const result = avatarCreateSchema.safeParse({ name: '', style: 'anime' });
    expect(result.success).toBe(false);
  });

  it('rejects name over 64 chars', () => {
    const result = avatarCreateSchema.safeParse({ name: 'x'.repeat(65), style: 'anime' });
    expect(result.success).toBe(false);
  });

  it('defaults style to anime and base_model to female', () => {
    const result = avatarCreateSchema.safeParse({ name: 'Test' });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.style).toBe('anime');
      expect(result.data.base_model).toBe('female');
    }
  });

  it('rejects invalid style', () => {
    const result = avatarCreateSchema.safeParse({ name: 'Test', style: 'invalid' });
    expect(result.success).toBe(false);
  });

  it('rejects invalid base_model', () => {
    const result = avatarCreateSchema.safeParse({ name: 'Test', base_model: 'robot' });
    expect(result.success).toBe(false);
  });

  it('strips all HTML tags including scripts', () => {
    const result = avatarCreateSchema.safeParse({ name: '<script>alert(1)</script>Test' });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.name).toBe('alert(1)Test');
    }
  });

  it('strips deeply nested HTML', () => {
    const result = avatarCreateSchema.safeParse({ name: '<div><span>Clean</span></div>' });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.name).toBe('Clean');
    }
  });
});

describe('avatarUpdateSchema', () => {
  it('accepts empty update (all optional)', () => {
    const result = avatarUpdateSchema.safeParse({});
    expect(result.success).toBe(true);
  });

  it('accepts partial name update', () => {
    const result = avatarUpdateSchema.safeParse({ name: 'New Name' });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.name).toBe('New Name');
    }
  });

  it('strips HTML from name in update', () => {
    const result = avatarUpdateSchema.safeParse({ name: '<b>Bold</b> Name' });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.name).toBe('Bold Name');
    }
  });

  it('accepts style update', () => {
    ['anime', 'realistic', 'lowpoly', 'korean', 'western', 'chibi'].forEach((s) => {
      const result = avatarUpdateSchema.safeParse({ style: s });
      expect(result.success).toBe(true);
    });
  });

  it('rejects invalid style in update', () => {
    const result = avatarUpdateSchema.safeParse({ style: 'invalid' });
    expect(result.success).toBe(false);
  });

  it('accepts status update', () => {
    ['draft', 'published', 'archived'].forEach((s) => {
      const result = avatarUpdateSchema.safeParse({ status: s });
      expect(result.success).toBe(true);
    });
  });

  it('rejects invalid status', () => {
    const result = avatarUpdateSchema.safeParse({ status: 'deleted' });
    expect(result.success).toBe(false);
  });

  it('rejects name over 64 chars', () => {
    const result = avatarUpdateSchema.safeParse({ name: 'x'.repeat(65) });
    expect(result.success).toBe(false);
  });

  it('rejects empty name', () => {
    const result = avatarUpdateSchema.safeParse({ name: '' });
    expect(result.success).toBe(false);
  });
});

describe('versionCreateSchema', () => {
  it('accepts empty version (all defaults)', () => {
    const result = versionCreateSchema.safeParse({});
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.blendshape_snapshot).toEqual({});
      expect(result.data.body_params).toEqual({
        height: 0, shoulder: 0, waist: 0, arm_length: 0, leg_length: 0,
      });
      expect(result.data.equipped_parts).toEqual([]);
      expect(result.data.material_overrides).toEqual({});
    }
  });

  it('accepts full version payload', () => {
    const result = versionCreateSchema.safeParse({
      blendshape_snapshot: { eye_size: 0.5, jaw_width: -0.3 },
      body_params: { height: 0.8, shoulder: -0.2, waist: 0.1, arm_length: 0, leg_length: 0.5 },
      equipped_parts: [{ slot: 'Head', part_id: 'hair_01' }],
      material_overrides: { 'part_1': { albedo: '#ff0000', roughness: 0.5, metallic: 0 } },
    });
    expect(result.success).toBe(true);
  });

  it('rejects body_params out of range (-1 to 1)', () => {
    const result = versionCreateSchema.safeParse({
      body_params: { height: 1.5, shoulder: 0, waist: 0, arm_length: 0, leg_length: 0 },
    });
    expect(result.success).toBe(false);
  });

  it('rejects material roughness out of range', () => {
    const result = versionCreateSchema.safeParse({
      material_overrides: { 'part_1': { albedo: '#fff', roughness: 2, metallic: 0.5 } },
    });
    expect(result.success).toBe(false);
  });
});

describe('profileUpdateSchema', () => {
  it('accepts valid profile update', () => {
    const result = profileUpdateSchema.safeParse({ username: 'new_name', bio: 'Hello world' });
    expect(result.success).toBe(true);
  });

  it('accepts partial update (username only)', () => {
    const result = profileUpdateSchema.safeParse({ username: 'new_name' });
    expect(result.success).toBe(true);
  });

  it('rejects XSS in username', () => {
    const result = profileUpdateSchema.safeParse({ username: '<img src=x onerror=alert(1)>' });
    expect(result.success).toBe(false);
  });

  it('rejects bio over 500 chars', () => {
    const result = profileUpdateSchema.safeParse({ bio: 'x'.repeat(501) });
    expect(result.success).toBe(false);
  });

  it('accepts bio exactly 500 chars', () => {
    const result = profileUpdateSchema.safeParse({ bio: 'x'.repeat(500) });
    expect(result.success).toBe(true);
  });
});

describe('assetCreateSchema', () => {
  const validAsset = {
    filename: 'model.glb',
    file_size: 1024000,
    mime_type: 'model/gltf-binary',
    asset_type: 'model',
    format: 'glb',
  };

  it('accepts valid asset data', () => {
    const result = assetCreateSchema.safeParse(validAsset);
    expect(result.success).toBe(true);
  });

  it('defaults license to cc_by', () => {
    const result = assetCreateSchema.safeParse(validAsset);
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.license).toBe('cc_by');
    }
  });

  it('defaults tags to empty array', () => {
    const result = assetCreateSchema.safeParse(validAsset);
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.tags).toEqual([]);
    }
  });

  it('accepts all asset types', () => {
    const types = ['model', 'texture', 'animation', 'vfx', 'hdri'];
    types.forEach((t) => {
      const result = assetCreateSchema.safeParse({ ...validAsset, asset_type: t });
      expect(result.success).toBe(true);
    });
  });

  it('accepts all formats', () => {
    const formats = ['gltf', 'glb', 'fbx', 'png', 'jpg', 'hdr', 'exr', 'mp4'];
    formats.forEach((f) => {
      const result = assetCreateSchema.safeParse({ ...validAsset, format: f });
      expect(result.success).toBe(true);
    });
  });

  it('rejects negative file_size', () => {
    const result = assetCreateSchema.safeParse({ ...validAsset, file_size: -1 });
    expect(result.success).toBe(false);
  });

  it('rejects empty filename', () => {
    const result = assetCreateSchema.safeParse({ ...validAsset, filename: '' });
    expect(result.success).toBe(false);
  });

  it('rejects invalid asset_type', () => {
    const result = assetCreateSchema.safeParse({ ...validAsset, asset_type: 'invalid' });
    expect(result.success).toBe(false);
  });

  it('rejects invalid format', () => {
    const result = assetCreateSchema.safeParse({ ...validAsset, format: 'pdf' });
    expect(result.success).toBe(false);
  });

  it('rejects invalid license', () => {
    const result = assetCreateSchema.safeParse({ ...validAsset, license: 'gpl' });
    expect(result.success).toBe(false);
  });

  it('accepts tags array', () => {
    const result = assetCreateSchema.safeParse({ ...validAsset, tags: ['character', 'base'] });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.tags).toEqual(['character', 'base']);
    }
  });
});

