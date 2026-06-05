// OIDC 认证模块 — 支持 Keycloak / Azure AD / 任何 OIDC Provider
// 使用 openid-client v6 实现授权码流程 + PKCE

import {
  Configuration,
  discovery,
  buildAuthorizationUrl as buildOAuth2AuthorizationUrl,
  authorizationCodeGrant,
  randomPKCECodeVerifier,
  randomState,
  randomNonce,
  calculatePKCECodeChallenge,
  ClientSecretBasic,
  None,
  allowInsecureRequests,
} from 'openid-client';
import { createLogger } from '@/lib/logger';

const log = createLogger('auth:oidc');

let _config: Configuration | null = null;
let _issuerUrl = '';

function getOidcConfig() {
  const issuer = process.env.SSO_ISSUER ||
    (process.env.AZURE_AD_TENANT
      ? `https://login.microsoftonline.com/${process.env.AZURE_AD_TENANT}/v2.0`
      : null) ||
    process.env.KEYCLOAK_URL ||
    'http://localhost:8080/realms/avatar-management';

  const clientId = process.env.SSO_CLIENT_ID || 'avatar-web-app';
  const clientSecret = process.env.SSO_CLIENT_SECRET || (clientId ? 'avatar-web-app-secret' : undefined);

  return {
    issuer,
    clientId,
    clientSecret,
    redirectUri: process.env.SSO_REDIRECT_URI || 'http://localhost:3000/api/auth/sso/callback',
  };
}

async function getOidcConfigInstance(): Promise<Configuration> {
  const config = getOidcConfig();

  if (_config && _issuerUrl === config.issuer) {
    return _config;
  }

  const server = new URL(config.issuer);

  const clientAuth = config.clientSecret
    ? ClientSecretBasic(config.clientSecret)
    : None();

  _config = await discovery(
    server,
    config.clientId,
    { client_secret: config.clientSecret },
    clientAuth,
    {
      execute: config.issuer.startsWith('http://') ? [allowInsecureRequests] : [],
    },
  );

  _issuerUrl = config.issuer;
  log.info('Discovered issuer: %s', _config.serverMetadata().issuer);
  return _config;
}

export async function buildAuthorizationUrl(): Promise<{
  url: string;
  state: string;
  codeVerifier: string;
  nonce: string;
}> {
  const config = await getOidcConfigInstance();
  const oidcConfig = getOidcConfig();

  const codeVerifier = randomPKCECodeVerifier();
  const codeChallenge = await calculatePKCECodeChallenge(codeVerifier);
  const state = randomState();
  const nonce = randomNonce();

  const url = buildOAuth2AuthorizationUrl(config, {
    scope: 'openid profile email',
    code_challenge: codeChallenge,
    code_challenge_method: 'S256',
    state,
    nonce,
    redirect_uri: oidcConfig.redirectUri,
  });

  return { url: url.toString(), state, codeVerifier, nonce };
}

export async function handleCallback(
  code: string,
  codeVerifier: string,
  expectedNonce: string,
  expectedState: string
): Promise<{
  claims: { sub: string; email?: string; preferred_username?: string; name?: string; [key: string]: unknown };
  accessToken: string;
}> {
  const config = await getOidcConfigInstance();
  const oidcConfig = getOidcConfig();

  // 构造回调 URL 供 authorizationCodeGrant 解析（需包含 state 用于验证）
  const callbackUrl = new URL(oidcConfig.redirectUri);
  callbackUrl.searchParams.set('code', code);
  callbackUrl.searchParams.set('state', expectedState);

  const tokens = await authorizationCodeGrant(
    config,
    callbackUrl,
    {
      pkceCodeVerifier: codeVerifier,
      expectedNonce,
      expectedState,
    },
  );

  const claims = tokens.claims();
  if (!claims) {
    throw new Error('id_token claims 为空');
  }

  return {
    claims: claims as { sub: string; email?: string; preferred_username?: string; name?: string; [key: string]: unknown },
    accessToken: tokens.access_token,
  };
}

export function getIssuerInfo(): { issuer: string; clientId: string; isConfigured: boolean } {
  const config = getOidcConfig();
  return {
    issuer: config.issuer,
    clientId: config.clientId,
    isConfigured: !!(process.env.SSO_ISSUER || process.env.AZURE_AD_TENANT || process.env.KEYCLOAK_URL),
  };
}
