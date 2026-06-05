import { hashPassword, verifyPassword } from '@/lib/auth/password';

describe('Password hashing (Argon2id)', () => {
  const password = 'SecurePassword123!';

  it('hashes a password without error', async () => {
    const hash = await hashPassword(password);
    expect(hash).toBeDefined();
    expect(typeof hash).toBe('string');
    expect(hash).toContain('$argon2id$');
  });

  it('verifies correct password against hash', async () => {
    const hash = await hashPassword(password);
    const result = await verifyPassword(hash, password);
    expect(result).toBe(true);
  });

  it('rejects incorrect password against hash', async () => {
    const hash = await hashPassword(password);
    const result = await verifyPassword(hash, 'WrongPassword');
    expect(result).toBe(false);
  });

  it('produces different hashes for same password (random salt)', async () => {
    const hash1 = await hashPassword(password);
    const hash2 = await hashPassword(password);
    expect(hash1).not.toBe(hash2);
    // Both should verify
    expect(await verifyPassword(hash1, password)).toBe(true);
    expect(await verifyPassword(hash2, password)).toBe(true);
  });

  it('verifies password with unicode characters', async () => {
    const unicodePw = '密码测试Password123!';
    const hash = await hashPassword(unicodePw);
    expect(await verifyPassword(hash, unicodePw)).toBe(true);
    expect(await verifyPassword(hash, 'wrong')).toBe(false);
  });

  it('handles empty password', async () => {
    const hash = await hashPassword('');
    expect(hash).toContain('$argon2id$');
    expect(await verifyPassword(hash, '')).toBe(true);
  });

  it('returns false for malformed hash', async () => {
    expect(await verifyPassword('not-a-valid-hash', 'anything')).toBe(false);
  });
});
