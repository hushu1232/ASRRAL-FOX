import crypto from 'crypto';
import fs from 'fs';
import path from 'path';
import { createLogger } from '@/lib/logger';

const log = createLogger('auth:keys');

let cachedPrivateKey: string | null = null;
let cachedPublicKey: string | null = null;
let cachedKid: string | null = null;

function getKeysDir(): string {
  return process.env.JWT_KEYS_DIR || path.join(process.cwd(), 'keys');
}

function getPrivateKeyPath(): string {
  return process.env.JWT_PRIVATE_KEY_PATH || path.join(getKeysDir(), 'private.pem');
}

function getPublicKeyPath(): string {
  return process.env.JWT_PUBLIC_KEY_PATH || path.join(getKeysDir(), 'public.pem');
}

export function generateRsaKeyPair(): { publicKey: string; privateKey: string } {
  const { publicKey, privateKey } = crypto.generateKeyPairSync('rsa', {
    modulusLength: 2048,
    publicKeyEncoding: { type: 'spki', format: 'pem' },
    privateKeyEncoding: { type: 'pkcs8', format: 'pem' },
  });
  return { publicKey, privateKey };
}

export function generateAndSaveKeys(): { publicKey: string; privateKey: string; kid: string } {
  const keysDir = getKeysDir();
  if (!fs.existsSync(keysDir)) {
    fs.mkdirSync(keysDir, { recursive: true });
  }

  const { publicKey, privateKey } = generateRsaKeyPair();
  fs.writeFileSync(getPrivateKeyPath(), privateKey, { mode: 0o600 });
  fs.writeFileSync(getPublicKeyPath(), publicKey, { mode: 0o644 });

  const kid = crypto.randomUUID();
  fs.writeFileSync(path.join(keysDir, 'kid'), kid);

  cachedPrivateKey = privateKey;
  cachedPublicKey = publicKey;
  cachedKid = kid;

  log.info('RSA key pair generated and saved to %s', keysDir);
  return { publicKey, privateKey, kid };
}

function loadKeys(): { privateKey: string; publicKey: string; kid: string } | null {
  const privPath = getPrivateKeyPath();
  const pubPath = getPublicKeyPath();
  const kidPath = path.join(getKeysDir(), 'kid');

  if (!fs.existsSync(privPath) || !fs.existsSync(pubPath)) {
    return null;
  }

  const privateKey = fs.readFileSync(privPath, 'utf-8');
  const publicKey = fs.readFileSync(pubPath, 'utf-8');
  const kid = fs.existsSync(kidPath) ? fs.readFileSync(kidPath, 'utf-8').trim() : 'default';

  cachedPrivateKey = privateKey;
  cachedPublicKey = publicKey;
  cachedKid = kid;

  return { privateKey, publicKey, kid };
}

export function getPrivateKey(): string | null {
  if (cachedPrivateKey) return cachedPrivateKey;

  const envKey = process.env.JWT_PRIVATE_KEY;
  if (envKey) {
    cachedPrivateKey = envKey.replace(/\\n/g, '\n');
    if (process.env.JWT_KEY_ID) cachedKid = process.env.JWT_KEY_ID;
    return cachedPrivateKey;
  }

  const loaded = loadKeys();
  if (loaded) return loaded.privateKey;

  if (process.env.NODE_ENV === 'production') {
    throw new Error('FATAL: No RSA private key found. Set JWT_PRIVATE_KEY or run scripts/generate-keys.ts');
  }

  log.warn('No RSA keys found — using HS256 fallback for development');
  return null;
}

export function getPublicKey(): string | null {
  if (cachedPublicKey) return cachedPublicKey;

  const envKey = process.env.JWT_PUBLIC_KEY;
  if (envKey) {
    cachedPublicKey = envKey.replace(/\\n/g, '\n');
    return cachedPublicKey;
  }

  const loaded = loadKeys();
  if (loaded) return loaded.publicKey;

  return null;
}

export function getKeyId(): string {
  if (cachedKid) return cachedKid;
  if (process.env.JWT_KEY_ID) {
    cachedKid = process.env.JWT_KEY_ID;
    return cachedKid;
  }
  const loaded = loadKeys();
  if (loaded) return loaded.kid;
  return 'dev-hs256';
}

export function isRs256Available(): boolean {
  return getPrivateKey() !== null && getPublicKey() !== null;
}

export function getJwtAlgorithm(): 'RS256' | 'HS256' {
  return isRs256Available() ? 'RS256' : 'HS256';
}

export function computeJwkThumbprint(jwk: Record<string, unknown>): string {
  const components: Record<string, string> = {
    kty: jwk.kty as string,
    n: jwk.n as string,
    e: jwk.e as string,
  };
  const payload = JSON.stringify(components);
  return crypto.createHash('sha256').update(payload).digest('base64url');
}

export function exportJwk(): Record<string, unknown> | null {
  const pubKey = getPublicKey();
  if (!pubKey) return null;

  const keyObj = crypto.createPublicKey({ key: pubKey, format: 'pem', type: 'spki' });
  const jwk = keyObj.export({ format: 'jwk' }) as Record<string, unknown>;

  const kid = getKeyId();
  jwk.kid = kid;
  jwk.use = 'sig';
  jwk.alg = 'RS256';

  return jwk;
}
