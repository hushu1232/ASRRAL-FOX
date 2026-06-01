export const runtime = 'nodejs';

import { NextRequest, NextResponse } from 'next/server';
import { getClientByClientId } from '@/lib/auth/oauth-provider';
import { createLogger } from '@/lib/logger';

const log = createLogger('oauth:authorize');

export async function GET(req: NextRequest) {
  const params = req.nextUrl.searchParams;
  const clientId = params.get('client_id');
  const redirectUri = params.get('redirect_uri');
  const responseType = params.get('response_type');
  const scope = params.get('scope') || 'openid';
  const state = params.get('state');
  const codeChallenge = params.get('code_challenge');
  const codeChallengeMethod = params.get('code_challenge_method') as 'S256' | 'plain' | null;

  if (!clientId || !redirectUri || responseType !== 'code') {
    return NextResponse.json(
      { error: 'invalid_request', error_description: 'Missing or invalid required parameters' },
      { status: 400 },
    );
  }

  const client = await getClientByClientId(clientId);
  if (!client) {
    return NextResponse.json(
      { error: 'invalid_client', error_description: 'Client not found' },
      { status: 401 },
    );
  }

  const isValidUri = client.redirectUris.some((uri) => {
    if (uri === redirectUri) return true;
    if (uri.endsWith('/*')) return redirectUri.startsWith(uri.slice(0, -2));
    return false;
  });

  if (!isValidUri) {
    return NextResponse.json(
      { error: 'invalid_redirect_uri', error_description: 'Redirect URI not whitelisted' },
      { status: 400 },
    );
  }

  const consentUrl = new URL('/oauth/consent', req.url);
  consentUrl.searchParams.set('client_id', clientId);
  consentUrl.searchParams.set('redirect_uri', redirectUri);
  consentUrl.searchParams.set('scope', scope);
  if (state) consentUrl.searchParams.set('state', state);
  if (codeChallenge) consentUrl.searchParams.set('code_challenge', codeChallenge);
  if (codeChallengeMethod) consentUrl.searchParams.set('code_challenge_method', codeChallengeMethod);

  log.info({ clientId, redirectUri }, 'OAuth authorize redirect to consent');
  return NextResponse.redirect(consentUrl);
}
