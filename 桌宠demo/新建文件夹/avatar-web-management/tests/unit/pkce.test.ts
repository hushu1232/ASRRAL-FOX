import { sealPkceSession, unsealPkceSession } from '@/lib/auth/pkce-store';

describe('PKCE Session Store', () => {
  const data = {
    codeVerifier: 'test-code-verifier-string',
    nonce: 'random-nonce-value',
    state: 'csrf-state-value',
  };

  it('seals and unseals PKCE data', () => {
    const sealed = sealPkceSession(data);
    expect(sealed).toBeDefined();
    expect(sealed.name).toBe('pkce_session');
    expect(sealed.value).toBeDefined();
    expect(typeof sealed.value).toBe('string');
    expect(sealed.maxAge).toBe(600); // 10 minutes

    const unsealed = unsealPkceSession(sealed.value);
    expect(unsealed).not.toBeNull();
    expect(unsealed!.codeVerifier).toBe(data.codeVerifier);
    expect(unsealed!.nonce).toBe(data.nonce);
    expect(unsealed!.state).toBe(data.state);
  });

  it('returns null for tampered ciphertext', () => {
    const sealed = sealPkceSession(data);
    const tampered = sealed.value.substring(0, 10) + 'X' + sealed.value.substring(11);
    expect(unsealPkceSession(tampered)).toBeNull();
  });

  it('returns null for empty string', () => {
    expect(unsealPkceSession('')).toBeNull();
  });

  it('returns null for garbage input', () => {
    expect(unsealPkceSession('not-valid-base64')).toBeNull();
  });

  it('produces different output for different input', () => {
    const sealed1 = sealPkceSession(data);
    const sealed2 = sealPkceSession({ ...data, nonce: 'different-nonce' });
    expect(sealed1.value).not.toBe(sealed2.value);
  });

  it('produces different output for same data (random nonce)', () => {
    const sealed1 = sealPkceSession(data);
    const sealed2 = sealPkceSession(data);
    expect(sealed1.value).not.toBe(sealed2.value); // Different IV
    // But both should decrypt correctly
    expect(unsealPkceSession(sealed1.value)).not.toBeNull();
    expect(unsealPkceSession(sealed2.value)).not.toBeNull();
  });
});
