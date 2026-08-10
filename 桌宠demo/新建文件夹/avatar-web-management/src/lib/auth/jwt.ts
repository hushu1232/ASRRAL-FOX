import crypto from 'crypto';
import jwt from 'jsonwebtoken';
import { v4 as uuidv4 } from 'uuid';
import { getPrisma } from '@/lib/db';
import { JWT_ACCESS_EXPIRY, JWT_REFRESH_EXPIRY_DAYS } from '@/lib/constants';
import { createLogger } from '@/lib/logger';
import { getPrivateKey, getPublicKey, getJwtAlgorithm, getKeyId } from './keys';

const log = createLogger('auth:jwt');

function hashRefreshToken(token: string): string {
  return crypto.createHash('sha256').update(token).digest('hex');
}

function getHs256Secret(): string {
  const secret = process.env.JWT_SECRET;
  if (!secret) {
    if (process.env.NODE_ENV === 'production') {
      throw new Error('FATAL: JWT_SECRET environment variable is required in production when no RSA keys are configured');
    }
    log.warn('Using HS256 dev fallback. Generate RSA keys for production.');
    return 'dev-fallback-do-not-use-in-production';
  }
  return secret;
}

const HS256_SECRET = getHs256Secret();
const JWT_ACCESS_EXPIRY_FINAL = process.env.JWT_ACCESS_EXPIRY || JWT_ACCESS_EXPIRY;
const JWT_REFRESH_EXPIRY_DAYS_FINAL = parseInt(process.env.JWT_REFRESH_EXPIRY_DAYS || String(JWT_REFRESH_EXPIRY_DAYS), 10);

export interface TokenPayload {
  sub: string;
  email: string;
  role: string;
  ws: string;
}

function getSignKey(): { key: string; algorithm: jwt.Algorithm } {
  const algorithm = getJwtAlgorithm();
  if (algorithm === 'RS256') {
    const privateKey = getPrivateKey();
    if (!privateKey) {
      throw new Error('RSA signing is configured but no private key is available');
    }
    return { key: privateKey, algorithm };
  }
  return { key: HS256_SECRET, algorithm };
}

export function signAccessToken(payload: TokenPayload): string {
  const { key, algorithm } = getSignKey();
  const options: Record<string, unknown> = {
    algorithm,
    expiresIn: JWT_ACCESS_EXPIRY_FINAL,
  };
  if (algorithm === 'RS256') options.keyid = getKeyId();
  return jwt.sign(payload, key, options as jwt.SignOptions);
}

export async function signRefreshToken(userId: string): Promise<{ token: string; id: string; expiresAt: string }> {
  const id = uuidv4();
  const expiresAt = new Date(Date.now() + JWT_REFRESH_EXPIRY_DAYS_FINAL * 24 * 60 * 60 * 1000).toISOString();

  const { key, algorithm } = getSignKey();
  const options: Record<string, unknown> = {
    algorithm,
    expiresIn: `${JWT_REFRESH_EXPIRY_DAYS_FINAL}d`,
  };
  if (algorithm === 'RS256') options.keyid = getKeyId();
  const token = jwt.sign({ sub: userId, jti: id }, key, options as jwt.SignOptions);

  await getPrisma().refreshToken.create({
    data: {
      id,
      userId,
      tokenHash: hashRefreshToken(token),
      expiresAt: new Date(expiresAt),
    },
  });

  return { token, id, expiresAt };
}

export function verifyAccessToken(token: string): TokenPayload | null {
  return verifyWithConfiguredAlgorithm(token) as TokenPayload | null;
}

export async function verifyRefreshToken(token: string): Promise<{ sub: string; jti: string } | null> {
  const payload = verifyWithConfiguredAlgorithm(token) as { sub: string; jti: string } | null;
  if (!payload) return null;

  const row = await getPrisma().refreshToken.findFirst({
    where: {
      OR: [
        { tokenHash: hashRefreshToken(token) },
        { tokenHash: token },
      ],
      revoked: false,
    },
    select: { id: true, expiresAt: true },
  });
  if (!row || new Date(row.expiresAt) < new Date()) return null;
  return payload;
}

function verifyWithConfiguredAlgorithm(token: string): Record<string, unknown> | null {
  const algorithm = getJwtAlgorithm();
  const key = algorithm === 'RS256' ? getPublicKey() : HS256_SECRET;
  if (!key) return null;

  try {
    return jwt.verify(token, key, { algorithms: [algorithm] }) as Record<string, unknown>;
  } catch {
    return null;
  }
}

export async function revokeRefreshToken(token: string): Promise<void> {
  await getPrisma().refreshToken.updateMany({
    where: { tokenHash: { in: [hashRefreshToken(token), token] } },
    data: { revoked: true },
  });
}

export function getCurrentAlgorithm(): string {
  return getJwtAlgorithm();
}
