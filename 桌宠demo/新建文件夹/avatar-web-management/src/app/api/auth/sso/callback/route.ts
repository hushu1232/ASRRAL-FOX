export const runtime = 'nodejs';

import { NextRequest, NextResponse } from 'next/server';
import { v4 as uuidv4 } from 'uuid';
import prisma from '@/lib/prisma';
import { signAccessToken, signRefreshToken } from '@/lib/auth/jwt';
import { handleCallback, getIssuerInfo } from '@/lib/auth/oidc';
import { unsealPkceSession } from '@/lib/auth/pkce-store';
import { JWT_REFRESH_EXPIRY_DAYS } from '@/lib/constants';
import { createLogger } from '@/lib/logger';

const log = createLogger('api:sso');

export async function GET(req: NextRequest) {
  const code = req.nextUrl.searchParams.get('code');
  const state = req.nextUrl.searchParams.get('state');
  const error = req.nextUrl.searchParams.get('error');

  if (error) {
    const desc = req.nextUrl.searchParams.get('error_description') || error;
    return NextResponse.redirect(new URL(`/login?error=${encodeURIComponent(desc)}`, req.url));
  }

  if (!code) {
    return NextResponse.redirect(new URL('/login?error=missing_code', req.url));
  }

  const { isConfigured } = getIssuerInfo();
  if (!isConfigured) {
    if (process.env.NODE_ENV !== 'production') {
      log.debug('Would exchange code: %s', code);
      return NextResponse.redirect(
        new URL('/login?error=SSO未配置，请在.env中设置SSO_ISSUER,_SSO_CLIENT_ID,_SSO_CLIENT_SECRET', req.url)
      );
    }
    return NextResponse.redirect(new URL('/login?error=sso_not_configured', req.url));
  }

  const pkceCookie = req.cookies.get('pkce_session');
  if (!pkceCookie?.value) {
    return NextResponse.redirect(new URL('/login?error=session_expired', req.url));
  }

  const pkceSession = unsealPkceSession(pkceCookie.value);
  if (!pkceSession) {
    return NextResponse.redirect(new URL('/login?error=invalid_session', req.url));
  }

  if (state && pkceSession.state !== state) {
    return NextResponse.redirect(new URL('/login?error=state_mismatch', req.url));
  }

  try {
    const { claims } = await handleCallback(
      code,
      pkceSession.codeVerifier,
      pkceSession.nonce,
      pkceSession.state
    );

    const email = (claims.email as string) || `${claims.sub}@sso.local`;
    const username = (claims.preferred_username as string) || (claims.name as string) || email.split('@')[0];
    const ssoSubject = claims.sub;

    let user = await prisma.user.findFirst({
      where: { ssoSubject },
      select: { id: true, workspaceId: true, email: true, username: true, role: true },
    });

    if (!user) {
      const existingEmail = await prisma.user.findFirst({
        where: { email },
        select: { id: true, workspaceId: true, email: true, username: true, role: true },
      });

      if (existingEmail) {
        await prisma.user.update({
          where: { id: existingEmail.id },
          data: { ssoProvider: 'oidc', ssoSubject },
        });
        user = existingEmail;
      } else {
        const workspace = await prisma.workspace.create({
          data: { name: `${username}的空间`, plan: 'free' },
        });

        user = await prisma.user.create({
          data: {
            id: uuidv4(),
            workspaceId: workspace.id,
            email,
            username,
            passwordHash: '',
            role: 'user',
            ssoProvider: 'oidc',
            ssoSubject,
          },
          select: { id: true, workspaceId: true, email: true, username: true, role: true },
        });
      }
    }

    const accessToken = signAccessToken({
      sub: user.id,
      email: user.email,
      role: user.role,
      ws: user.workspaceId,
    });
    const refreshToken = await signRefreshToken(user.id);

    await prisma.user.update({
      where: { id: user.id },
      data: { lastLoginAt: new Date() },
    });

    const res = NextResponse.redirect(new URL('/dashboard', req.url));

    res.cookies.set('pkce_session', '', {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 0,
      path: '/',
    });

    res.cookies.set('refreshToken', refreshToken.token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: JWT_REFRESH_EXPIRY_DAYS * 24 * 60 * 60,
      path: '/',
    });

    res.headers.set('X-Access-Token', accessToken);
    return res;
  } catch (err) {
    log.error({ err }, 'SSO callback error');
    const msg = err instanceof Error ? err.message : 'sso_callback_error';
    return NextResponse.redirect(new URL(`/login?error=${encodeURIComponent(msg)}`, req.url));
  }
}
