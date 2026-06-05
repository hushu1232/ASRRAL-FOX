import { NextResponse } from 'next/server';
import { getIssuerUrl } from '@/lib/auth/oauth-provider';
import { isRs256Available } from '@/lib/auth/keys';

export const dynamic = 'force-dynamic';

export function GET() {
  const issuer = getIssuerUrl();

  return NextResponse.json(
    {
      issuer,
      authorization_endpoint: `${issuer}/api/oauth/authorize`,
      token_endpoint: `${issuer}/api/oauth/token`,
      userinfo_endpoint: `${issuer}/api/oauth/userinfo`,
      jwks_uri: `${issuer}/.well-known/jwks.json`,
      scopes_supported: ['openid', 'profile', 'email'],
      response_types_supported: ['code'],
      grant_types_supported: ['authorization_code'],
      subject_types_supported: ['public'],
      id_token_signing_alg_values_supported: isRs256Available() ? ['RS256'] : ['HS256'],
      token_endpoint_auth_methods_supported: ['client_secret_basic', 'client_secret_post', 'none'],
      claims_supported: ['sub', 'email', 'name', 'picture', 'preferred_username'],
      code_challenge_methods_supported: ['S256', 'plain'],
    },
    {
      status: 200,
      headers: {
        'Content-Type': 'application/json',
        'Cache-Control': 'public, max-age=86400',
      },
    },
  );
}
