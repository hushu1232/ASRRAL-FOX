import {
  loginSchema,
  registerSchema,
  avatarCreateSchema,
  avatarUpdateSchema,
  versionCreateSchema,
  assetCreateSchema,
  profileUpdateSchema,
} from '@/lib/validators';

describe('loginSchema', () => {
  it('accepts valid login payload', () => {
    const result = loginSchema.safeParse({ email: 'test@example.com', password: 'password123' });
    expect(result.success).toBe(true);
  });

  it('rejects invalid email', () => {
    const result = loginSchema.safeParse({ email: 'not-an-email', password: 'password123' });
    expect(result.success).toBe(false);
  });

  it('rejects short password', () => {
    const result = loginSchema.safeParse({ email: 'test@example.com', password: '12345' });
    expect(result.success).toBe(false);
  });
});

describe('registerSchema', () => {
  it('accepts valid register payload', () => {
    const result = registerSchema.safeParse({
      email: 'test@example.com',
      username: 'testuser',
      password: 'password123',
    });
    expect(result.success).toBe(true);
  });

  it('rejects username with special chars', () => {
    const result = registerSchema.safeParse({
      email: 'test@example.com',
      username: 'test<>user',
      password: 'password123',
    });
    expect(result.success).toBe(false);
  });

  it('accepts Chinese characters in username', () => {
    const result = registerSchema.safeParse({
      email: 'test@example.com',
      username: '测试用户',
      password: 'password123',
    });
    expect(result.success).toBe(true);
  });
});

describe('avatarCreateSchema', () => {
  it('accepts valid create payload with defaults', () => {
    const result = avatarCreateSchema.safeParse({ name: 'My Avatar' });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.style).toBe('anime');
      expect(result.data.base_model).toBe('female');
    }
  });

  it('strips HTML from name', () => {
    const result = avatarCreateSchema.safeParse({ name: '<script>alert("xss")</script>Avatar' });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.name).toBe('alert("xss")Avatar');
    }
  });

  it('rejects empty name', () => {
    const result = avatarCreateSchema.safeParse({ name: '' });
    expect(result.success).toBe(false);
  });

  it('rejects invalid style', () => {
    const result = avatarCreateSchema.safeParse({ name: 'Test', style: 'invalid_style' });
    expect(result.success).toBe(false);
  });
});

describe('avatarUpdateSchema', () => {
  it('accepts partial update', () => {
    const result = avatarUpdateSchema.safeParse({ name: 'Updated Name' });
    expect(result.success).toBe(true);
  });

  it('accepts empty object (all fields optional)', () => {
    const result = avatarUpdateSchema.safeParse({});
    expect(result.success).toBe(true);
  });

  it('rejects invalid status', () => {
    const result = avatarUpdateSchema.safeParse({ status: 'nonexistent' });
    expect(result.success).toBe(false);
  });
});

describe('versionCreateSchema', () => {
  it('accepts defaults for all fields', () => {
    const result = versionCreateSchema.safeParse({});
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.body_params).toEqual({
        height: 0, shoulder: 0, waist: 0, arm_length: 0, leg_length: 0,
      });
      expect(result.data.equipped_parts).toEqual([]);
      expect(result.data.blendshape_snapshot).toEqual({});
    }
  });

  it('rejects body_param out of range', () => {
    const result = versionCreateSchema.safeParse({
      body_params: { height: 2, shoulder: 0, waist: 0, arm_length: 0, leg_length: 0 },
    });
    expect(result.success).toBe(false);
  });

  it('rejects metallic out of range', () => {
    const result = versionCreateSchema.safeParse({
      material_overrides: { mat_01: { albedo: '#ffffff', roughness: 0.5, metallic: 5 } },
    });
    expect(result.success).toBe(false);
  });
});

describe('assetCreateSchema', () => {
  it('accepts valid asset payload', () => {
    const result = assetCreateSchema.safeParse({
      filename: 'model.glb',
      file_size: 1024,
      mime_type: 'model/gltf-binary',
      asset_type: 'model',
      format: 'glb',
    });
    expect(result.success).toBe(true);
  });

  it('defaults license to cc_by', () => {
    const result = assetCreateSchema.safeParse({
      filename: 'texture.png',
      file_size: 512,
      mime_type: 'image/png',
      asset_type: 'texture',
      format: 'png',
    });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.license).toBe('cc_by');
      expect(result.data.tags).toEqual([]);
    }
  });

  it('rejects invalid asset_type', () => {
    const result = assetCreateSchema.safeParse({
      filename: 'file.xyz',
      file_size: 100,
      mime_type: 'application/octet-stream',
      asset_type: 'unknown_type',
      format: 'glb',
    });
    expect(result.success).toBe(false);
  });
});

describe('profileUpdateSchema', () => {
  it('accepts valid username update', () => {
    const result = profileUpdateSchema.safeParse({ username: 'new_user' });
    expect(result.success).toBe(true);
  });

  it('accepts bio update', () => {
    const result = profileUpdateSchema.safeParse({ bio: 'Hello world' });
    expect(result.success).toBe(true);
  });

  it('rejects bio exceeding max length', () => {
    const result = profileUpdateSchema.safeParse({ bio: 'x'.repeat(501) });
    expect(result.success).toBe(false);
  });
});
