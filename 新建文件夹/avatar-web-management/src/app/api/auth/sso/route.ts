export const runtime = 'nodejs';

import { NextRequest, NextResponse } from 'next/server';
import { buildAuthorizationUrl, getIssuerInfo } from '@/lib/auth/oidc';
import { sealPkceSession } from '@/lib/auth/pkce-store';
import { createLogger } from '@/lib/logger';

const log = createLogger('api:sso');

export async function GET(req: NextRequest) {
  const { isConfigured } = getIssuerInfo();

  if (!isConfigured) {
    if (process.env.NODE_ENV !== 'production') {
      return NextResponse.json({
        success: true,
        message: 'SSO 未配置。在生产环境中设置 SSO_ISSUER / AZURE_AD_TENANT / KEYCLOAK_URL。',
        setupGuide: {
          azure_ad: 'https://learn.microsoft.com/entra/identity-platform',
          okta: 'https://developer.okta.com/docs/guides/',
          keycloak: 'https://www.keycloak.org/documentation',
        },
      });
    }
    return NextResponse.json({ success: false, error: 'SSO not configured' }, { status: 500 });
  }

  try {
    const { url, state, codeVerifier, nonce } = await buildAuthorizationUrl();

    const pkceCookie = sealPkceSession({ codeVerifier, nonce, state });

    if (req.nextUrl.searchParams.get('format') === 'json') {
      const res = NextResponse.json({ success: true, data: { redirect_url: url } });
      res.cookies.set(pkceCookie.name, pkceCookie.value, {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'lax',
        maxAge: pkceCookie.maxAge,
        path: '/',
      });
      return res;
    }

    const res = NextResponse.redirect(url);
    res.cookies.set(pkceCookie.name, pkceCookie.value, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: pkceCookie.maxAge,
      path: '/',
    });
    return res;
  } catch (err) {
    log.error({ err }, 'Failed to build authorization URL');
    return NextResponse.json({ success: false, error: 'OIDC discovery failed' }, { status: 502 });
  }
}
