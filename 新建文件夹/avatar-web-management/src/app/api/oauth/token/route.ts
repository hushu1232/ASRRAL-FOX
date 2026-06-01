export const runtime = 'nodejs';

import { NextRequest, NextResponse } from 'next/server';
import { validateClient, consumeAuthCode, issueTokens } from '@/lib/auth/oauth-provider';
import { createLogger } from '@/lib/logger';

const log = createLogger('oauth:token');

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => ({}));
  const grantType = body.grant_type;
  const code = body.code;
  const redirectUri = body.redirect_uri;
  const clientId = body.client_id;
  const clientSecret = body.client_secret;
  const codeVerifier = body.code_verifier;

  // Validate client credentials
  const client = await validateClient(clientId, clientSecret);
  if (!client) {
    return NextResponse.json(
      { error: 'invalid_client', error_description: 'Client authentication failed' },
      { status: 401 },
    );
  }

  if (grantType !== 'authorization_code') {
    return NextResponse.json(
      { error: 'unsupported_grant_type', error_description: 'Only authorization_code is supported' },
      { status: 400 },
    );
  }

  if (!code) {
    return NextResponse.json(
      { error: 'invalid_request', error_description: 'Missing authorization code' },
      { status: 400 },
    );
  }

  // Consume the authorization code
  const authCode = consumeAuthCode(code, codeVerifier);
  if (!authCode) {
    return NextResponse.json(
      { error: 'invalid_grant', error_description: 'Invalid or expired authorization code' },
      { status: 400 },
    );
  }

  if (authCode.clientId !== clientId) {
    return NextResponse.json(
      { error: 'invalid_grant', error_description: 'Code was not issued to this client' },
      { status: 400 },
    );
  }

  if (authCode.redirectUri !== redirectUri) {
    return NextResponse.json(
      { error: 'invalid_grant', error_description: 'Redirect URI mismatch' },
      { status: 400 },
    );
  }

  try {
    const tokens = await issueTokens(authCode);
    log.info({ clientId, userId: authCode.userId }, 'Tokens issued');

    return NextResponse.json(
      {
        access_token: tokens.accessToken,
        id_token: tokens.idToken,
        token_type: tokens.tokenType,
        expires_in: tokens.expiresIn,
      },
      {
        headers: {
          'Cache-Control': 'no-store',
          'Pragma': 'no-cache',
        },
      },
    );
  } catch (err) {
    log.error({ err }, 'Failed to issue tokens');
    return NextResponse.json(
      { error: 'server_error', error_description: 'Failed to issue tokens' },
      { status: 500 },
    );
  }
}
