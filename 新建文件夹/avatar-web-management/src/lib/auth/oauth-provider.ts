import crypto from 'crypto';
import jwt from 'jsonwebtoken';
import { getPrisma } from '@/lib/db';
import { getPrivateKey, getPublicKey, getJwtAlgorithm, getKeyId } from './keys';
import { createLogger } from '@/lib/logger';

const log = createLogger('oauth:provider');

const AUTH_CODE_EXPIRY = 600; // 10 minutes
const ACCESS_TOKEN_EXPIRY = '15m';
const ID_TOKEN_EXPIRY = '15m';

interface OAuthClient {
  id: string;
  name: string;
  clientId: string;
  clientSecret: string;
  redirectUris: string[];
  scopes: string[];
  grantTypes: string[];
  isPublic: boolean;
}

interface AuthCodeData {
  code: string;
  clientId: string;
  userId: string;
  redirectUri: string;
  scopes: string[];
  codeChallenge?: string;
  codeChallengeMethod?: 'S256' | 'plain';
  expiresAt: number;
}

const codeStore = new Map<string, AuthCodeData>();

// Clean expired codes every 5 minutes
setInterval(() => {
  const now = Date.now();
  for (const [key, val] of codeStore) {
    if (val.expiresAt < now) codeStore.delete(key);
  }
}, 300000).unref();

export function generateClientCredentials(): { clientId: string; clientSecret: string } {
  const clientId = `avc_${crypto.randomBytes(16).toString('hex')}`;
  const clientSecret = `avs_${crypto.randomBytes(32).toString('hex')}`;
  return { clientId, clientSecret };
}

function hashSecret(secret: string): string {
  return crypto.createHash('sha256').update(secret).digest('hex');
}

export function generateAuthCode(): string {
  return crypto.randomBytes(32).toString('hex');
}

export async function createOAuthClient(data: {
  name: string;
  redirectUris: string[];
  scopes?: string[];
  grantTypes?: string[];
  isPublic?: boolean;
}): Promise<OAuthClient> {
  const prisma = getPrisma();
  const { clientId, clientSecret } = generateClientCredentials();

  const record = await prisma.$queryRawUnsafe<Array<Record<string, unknown>>>(
    `INSERT INTO oauth_clients (id, name, client_id, client_secret, redirect_uris, scopes, grant_types, is_public)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
     RETURNING *`,
    crypto.randomUUID(),
    data.name,
    clientId,
    hashSecret(clientSecret),
    JSON.stringify(data.redirectUris),
    JSON.stringify(data.scopes || ['openid', 'profile', 'email']),
    JSON.stringify(data.grantTypes || ['authorization_code', 'refresh_token']),
    data.isPublic ?? false,
  );

  const row = toCamel(record[0]);
  return {
    ...row,
    clientSecret, // Return the raw secret (only shown once)
    redirectUris: parseJsonArray(row.redirect_uris),
    scopes: parseJsonArray(row.scopes),
    grantTypes: parseJsonArray(row.grant_types),
  } as unknown as OAuthClient;
}

export async function getClientByClientId(clientId: string): Promise<OAuthClient | null> {
  const prisma = getPrisma();
  const rows = await prisma.$queryRawUnsafe<Array<Record<string, unknown>>>(
    'SELECT * FROM oauth_clients WHERE client_id = $1 AND revoked = false',
    clientId,
  );
  if (rows.length === 0) return null;
  const row = toCamel(rows[0]);
  return {
    id: row.id,
    name: row.name,
    clientId: row.client_id,
    clientSecret: row.client_secret,
    redirectUris: parseJsonArray(row.redirect_uris),
    scopes: parseJsonArray(row.scopes),
    grantTypes: parseJsonArray(row.grant_types),
    isPublic: row.is_public,
  } as unknown as OAuthClient;
}

export async function listOAuthClients(): Promise<OAuthClient[]> {
  const prisma = getPrisma();
  const rows = await prisma.$queryRawUnsafe<Array<Record<string, unknown>>>(
    'SELECT * FROM oauth_clients WHERE revoked = false ORDER BY created_at DESC',
  );
  return rows.map((row) => {
    const r = toCamel(row);
    return {
      id: r.id,
      name: r.name,
      clientId: r.client_id,
      clientSecret: r.client_secret,
      redirectUris: parseJsonArray(r.redirect_uris),
      scopes: parseJsonArray(r.scopes),
      grantTypes: parseJsonArray(r.grant_types),
      isPublic: r.is_public,
    } as unknown as OAuthClient;
  });
}

export async function revokeOAuthClient(id: string): Promise<boolean> {
  const prisma = getPrisma();
  const result = await prisma.$executeRawUnsafe(
    'UPDATE oauth_clients SET revoked = true WHERE id = $1',
    id,
  );
  return result > 0;
}

function validateRedirectUri(client: OAuthClient, redirectUri: string): boolean {
  return client.redirectUris.some((uri) => {
    if (uri === redirectUri) return true;
    // Allow exact match and wildcard path matching
    if (uri.endsWith('/*')) {
      const base = uri.slice(0, -2);
      return redirectUri.startsWith(base);
    }
    return false;
  });
}

export function validateClient(
  clientId: string,
  clientSecret?: string,
): Promise<OAuthClient | null> {
  return validateClientImpl(clientId, clientSecret);
}

async function validateClientImpl(
  clientId: string,
  clientSecret?: string,
): Promise<OAuthClient | null> {
  const client = await getClientByClientId(clientId);
  if (!client) return null;

  // Public clients don't need a secret
  if (client.isPublic) return client;

  if (!clientSecret) return null;
  const hashed = hashSecret(clientSecret);
  if (!crypto.timingSafeEqual(Buffer.from(hashed), Buffer.from(client.clientSecret))) {
    return null;
  }
  return client;
}

export function storeAuthCode(data: {
  clientId: string;
  userId: string;
  redirectUri: string;
  scopes: string[];
  codeChallenge?: string;
  codeChallengeMethod?: 'S256' | 'plain';
}): string {
  const code = generateAuthCode();
  codeStore.set(code, {
    code,
    clientId: data.clientId,
    userId: data.userId,
    redirectUri: data.redirectUri,
    scopes: data.scopes,
    codeChallenge: data.codeChallenge,
    codeChallengeMethod: data.codeChallengeMethod,
    expiresAt: Date.now() + AUTH_CODE_EXPIRY * 1000,
  });
  return code;
}

export function consumeAuthCode(
  code: string,
  codeVerifier?: string,
): AuthCodeData | null {
  const data = codeStore.get(code);
  if (!data) return null;
  if (data.expiresAt < Date.now()) {
    codeStore.delete(code);
    return null;
  }

  // PKCE verification
  if (data.codeChallenge) {
    if (!codeVerifier) return null;
    let computed: string;
    if (data.codeChallengeMethod === 'plain') {
      computed = codeVerifier;
    } else {
      computed = crypto.createHash('sha256').update(codeVerifier).digest('base64url');
    }
    if (computed !== data.codeChallenge) return null;
  }

  codeStore.delete(code);
  return data;
}

export async function issueTokens(
  authCode: AuthCodeData,
): Promise<{ accessToken: string; idToken: string; tokenType: string; expiresIn: number }> {
  const prisma = getPrisma();
  const rows = await prisma.$queryRawUnsafe<Array<Record<string, unknown>>>(
    'SELECT id, email, username, role, avatar_url FROM users WHERE id = $1',
    authCode.userId,
  );
  const user = rows[0] ? toCamel(rows[0]) : null;
  if (!user) throw new Error('User not found');

  const now = Math.floor(Date.now() / 1000);
  const kid = getKeyId();

  const accessToken = jwt.sign(
    {
      sub: user.id,
      email: user.email,
      role: user.role,
      scope: authCode.scopes.join(' '),
      iat: now,
    },
    getPrivateKey() || process.env.JWT_SECRET || 'dev-fallback',
    {
      algorithm: getJwtAlgorithm(),
      expiresIn: ACCESS_TOKEN_EXPIRY,
      keyid: kid,
      issuer: getIssuerUrl(),
      audience: authCode.clientId,
    },
  );

  const idToken = jwt.sign(
    {
      sub: user.id,
      email: user.email,
      name: user.username,
      picture: user.avatar_url,
      iat: now,
    },
    getPrivateKey() || process.env.JWT_SECRET || 'dev-fallback',
    {
      algorithm: getJwtAlgorithm(),
      expiresIn: ID_TOKEN_EXPIRY,
      keyid: kid,
      issuer: getIssuerUrl(),
      audience: authCode.clientId,
    },
  );

  log.info({ userId: authCode.userId, clientId: authCode.clientId }, 'Tokens issued');

  return {
    accessToken,
    idToken,
    tokenType: 'Bearer',
    expiresIn: 900,
  };
}

export function getIssuerUrl(): string {
  return process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';
}

function toCamel(row: Record<string, unknown>): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(row)) {
    const camelKey = key.replace(/_([a-z])/g, (_, l: string) => l.toUpperCase());
    out[camelKey] = typeof value === 'bigint' ? Number(value) : value;
  }
  return out;
}

function parseJsonArray(val: unknown): string[] {
  if (Array.isArray(val)) return val as string[];
  if (typeof val === 'string') {
    try { return JSON.parse(val); } catch { return []; }
  }
  return [];
}
