// PKCE session cookie — 加密存储 code_verifier + nonce 用于 OIDC 回调验证
import { createCipheriv, createDecipheriv, randomBytes, createHash } from 'crypto';

const ALGORITHM = 'aes-256-gcm';
const COOKIE_NAME = 'pkce_session';
const COOKIE_MAX_AGE = 600; // 10 分钟，足够完成授权流程

function getKey(): Buffer {
  const secret = process.env.JWT_SECRET || 'dev-fallback-do-not-use-in-production';
  return createHash('sha256').update(secret).digest();
}

export function sealPkceSession(data: {
  codeVerifier: string;
  nonce: string;
  state: string;
}): { name: string; value: string; maxAge: number } {
  const key = getKey();
  const iv = randomBytes(16);
  const cipher = createCipheriv(ALGORITHM, key, iv);
  const payload = JSON.stringify({ cv: data.codeVerifier, n: data.nonce, s: data.state, iat: Date.now() });
  const encrypted = Buffer.concat([cipher.update(payload, 'utf-8'), cipher.final()]);
  const authTag = cipher.getAuthTag();
  const value = Buffer.concat([iv, authTag, encrypted]).toString('base64url');
  return { name: COOKIE_NAME, value, maxAge: COOKIE_MAX_AGE };
}

export function unsealPkceSession(value: string): {
  codeVerifier: string;
  nonce: string;
  state: string;
} | null {
  try {
    const key = getKey();
    const buf = Buffer.from(value, 'base64url');
    const iv = buf.subarray(0, 16);
    const authTag = buf.subarray(16, 32);
    const encrypted = buf.subarray(32);
    const decipher = createDecipheriv(ALGORITHM, key, iv);
    decipher.setAuthTag(authTag);
    const decrypted = Buffer.concat([decipher.update(encrypted), decipher.final()]);
    const session = JSON.parse(decrypted.toString('utf-8'));
    if (Date.now() - session.iat > COOKIE_MAX_AGE * 1000) return null;
    return { codeVerifier: session.cv, nonce: session.n, state: session.s };
  } catch {
    return null;
  }
}
