import {
  loginSchema,
  registerSchema,
  avatarCreateSchema,
  profileUpdateSchema,
} from '@/lib/validators';

describe('loginSchema', () => {
  it('accepts valid email + password', () => {
    const result = loginSchema.safeParse({ email: 'test@example.com', password: 'password123' });
    expect(result.success).toBe(true);
  });

  it('rejects invalid email', () => {
    const result = loginSchema.safeParse({ email: 'not-an-email', password: 'password123' });
    expect(result.success).toBe(false);
  });

  it('rejects short password (<6 chars)', () => {
    const result = loginSchema.safeParse({ email: 'test@example.com', password: '12345' });
    expect(result.success).toBe(false);
  });

  it('rejects missing fields', () => {
    const result = loginSchema.safeParse({ email: 'test@example.com' });
    expect(result.success).toBe(false);
  });
});

describe('registerSchema', () => {
  it('accepts valid registration', () => {
    const result = registerSchema.safeParse({
      email: 'new@example.com',
      username: 'new_user',
      password: 'securepass123',
    });
    expect(result.success).toBe(true);
  });

  it('accepts Chinese characters in username', () => {
    const result = registerSchema.safeParse({
      email: 'cn@example.com',
      username: '用户名测试',
      password: 'securepass123',
    });
    expect(result.success).toBe(true);
  });

  it('rejects XSS in username', () => {
    const result = registerSchema.safeParse({
      email: 'xss@example.com',
      username: '<script>alert(1)</script>',
      password: 'securepass123',
    });
    expect(result.success).toBe(false);
  });

  it('rejects username with spaces', () => {
    const result = registerSchema.safeParse({
      email: 'spaces@example.com',
      username: 'user name',
      password: 'securepass123',
    });
    expect(result.success).toBe(false);
  });

  it('rejects username shorter than 2 chars', () => {
    const result = registerSchema.safeParse({
      email: 'short@example.com',
      username: 'a',
      password: 'securepass123',
    });
    expect(result.success).toBe(false);
  });
});

describe('avatarCreateSchema', () => {
  it('accepts valid avatar creation', () => {
    const result = avatarCreateSchema.safeParse({ name: 'Test Avatar', style: 'anime', base_model: 'female' });
    expect(result.success).toBe(true);
  });

  it('rejects empty name', () => {
    const result = avatarCreateSchema.safeParse({ name: '', style: 'anime', base_model: 'female' });
    expect(result.success).toBe(false);
  });

  it('rejects invalid style', () => {
    const result = avatarCreateSchema.safeParse({ name: 'Test', style: 'invalid_style', base_model: 'female' });
    expect(result.success).toBe(false);
  });

  it('rejects invalid base_model', () => {
    const result = avatarCreateSchema.safeParse({ name: 'Test', style: 'anime', base_model: 'robot' });
    expect(result.success).toBe(false);
  });

  it('uses defaults for optional fields', () => {
    const result = avatarCreateSchema.safeParse({ name: 'Minimal' });
    if (result.success) {
      expect(result.data.style).toBe('anime');
      expect(result.data.base_model).toBe('female');
    }
  });
});

describe('profileUpdateSchema', () => {
  it('accepts valid username update', () => {
    const result = profileUpdateSchema.safeParse({ username: 'validUser123' });
    expect(result.success).toBe(true);
  });

  it('accepts valid bio', () => {
    const result = profileUpdateSchema.safeParse({ bio: 'This is my bio' });
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

  it('accepts empty update (all optional)', () => {
    const result = profileUpdateSchema.safeParse({});
    expect(result.success).toBe(true);
  });
});
