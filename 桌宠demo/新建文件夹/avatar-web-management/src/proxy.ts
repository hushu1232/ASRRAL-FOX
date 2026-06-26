import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { routing } from '@/i18n/routing';
import { checkRateLimit, extractUserIdFromAuthHeader, isLocalRateLimitAddress, RATE_LIMITS } from '@/lib/rate-limit';
import { validateCsrfToken, requiresCsrfCheck, validateOrigin } from '@/lib/csrf';
import { handleCors, setCorsHeaders } from '@/lib/cors';
import { httpRequestsInFlight, observeHttpRequest, rateLimitHits } from '@/lib/metrics';

const AUTH_ROUTES = ['/dashboard', '/avatars', '/assets', '/marketplace', '/settings', '/admin', '/api-docs', '/help'];

// API routes that don't need CSRF (login/register before token acquisition)
const CSRF_EXEMPT = ['/api/auth/login', '/api/auth/register', '/api/auth/refresh', '/api/health'];
// Endpoints exempt from rate limiting (Prometheus scrape, health checks)
const RATE_LIMIT_EXEMPT = ['/api/metrics', '/api/health'];

// Body size limits (bytes)
const MAX_BODY_SIZE_GENERAL = 1 * 1024 * 1024;   // 1MB for general API
const MAX_BODY_SIZE_UPLOAD = 50 * 1024 * 1024;    // 50MB for upload endpoints
const MAX_BODY_SIZE_EXPORT = 10 * 1024 * 1024;    // 10MB for export endpoints

function getClientIp(request: NextRequest): string {
  return request.headers.get('x-forwarded-for')?.split(',')[0]?.trim()
    || request.headers.get('x-real-ip')
    || '127.0.0.1';
}

function getRateLimitConfig(pathname: string) {
  if (pathname === '/api/auth/login') return RATE_LIMITS.login;
  if (pathname === '/api/auth/register') return RATE_LIMITS.register;
  if (pathname === '/api/auth/forgot-password') return RATE_LIMITS.forgotPassword;
  if (pathname.startsWith('/api/assets/upload')) return RATE_LIMITS.upload;
  if (pathname.match(/^\/api\/avatars\/[^/]+\/export$/)) return RATE_LIMITS.export;
  return RATE_LIMITS.api;
}

function getMaxBodySize(pathname: string): number {
  if (pathname.startsWith('/api/assets/upload')) return MAX_BODY_SIZE_UPLOAD;
  if (pathname.startsWith('/api/avatars') && (pathname.endsWith('/export') || pathname.includes('/versions'))) return MAX_BODY_SIZE_EXPORT;
  return MAX_BODY_SIZE_GENERAL;
}

/**
 * Handle i18n locale prefix:
 * - /zh-CN/xxx → strip prefix, set NEXT_LOCALE=zh-CN, rewrite to /xxx
 * - /en/xxx    → strip prefix, set NEXT_LOCALE=en, rewrite to /xxx
 * - /xxx       → detect locale from cookie/header or default, redirect to /{locale}/xxx
 */
function handleI18n(request: NextRequest): NextResponse | null {
  const { pathname } = request.nextUrl;
  const locales = routing.locales as readonly string[];
  const defaultLocale = routing.defaultLocale as string;

  // Locale prefix pattern: /zh-CN/... or /en/...
  const localePrefixMatch = pathname.match(/^\/([a-z]{2}(?:-[A-Z]{2})?)(\/.*)?$/);
  if (localePrefixMatch) {
    const prefix = localePrefixMatch[1];
    if (locales.includes(prefix)) {
      // Valid locale prefix — strip it and rewrite internally
      const rest = localePrefixMatch[2] || '/';
      const newUrl = new URL(rest, request.url);
      newUrl.search = request.nextUrl.search;
      const response = NextResponse.rewrite(newUrl);
      response.cookies.set('NEXT_LOCALE', prefix, { path: '/', sameSite: 'lax' });
      return response;
    }
  }

  // No valid prefix — detect locale and redirect to prefixed URL
  const cookieLocale = request.cookies.get('NEXT_LOCALE')?.value;
  const headerLocale = request.headers.get('accept-language')?.split(',')[0]?.split('-')[0];
  const detectedLocale = (locales.includes(cookieLocale || '') ? cookieLocale
    : locales.includes(headerLocale || '') ? headerLocale
    : defaultLocale) || defaultLocale;

  const redirectUrl = new URL(`/${detectedLocale}${pathname}`, request.url);
  redirectUrl.search = request.nextUrl.search;
  return NextResponse.redirect(redirectUrl);
}

export async function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;

  const requestId = crypto.randomUUID();
  request.headers.set('x-request-id', requestId);

  // --- API versioning: /api/v1/* → /api/* ---
  if (pathname.startsWith('/api/v1/')) {
    const internalPath = pathname.replace('/api/v1/', '/api/');
    const rewriteUrl = new URL(internalPath, request.url);
    rewriteUrl.search = request.nextUrl.search;
    const rewrite = NextResponse.rewrite(rewriteUrl);
    rewrite.headers.set('X-API-Version', '1');
    rewrite.headers.set('X-Request-Id', requestId);
    return rewrite;
  }

  // --- CORS & Rate limiting (API routes) ---
  if (pathname.startsWith('/api/')) {
    const startMs = Date.now();
    httpRequestsInFlight.inc();

    const routePattern = pathname.replace(/\/[a-f0-9-]{36}/g, '/:id').replace(/\/\d+/g, '/:num');

    try {
      // CORS check (first, including OPTIONS preflight)
      const corsResult = handleCors(request);
      if (corsResult) {
        corsResult.headers.set('X-Request-Id', requestId);
        observeHttpRequest(request.method, routePattern, corsResult.status, (Date.now() - startMs) / 1000);
        return corsResult;
      }

      // Body size check (skip for GET/HEAD/OPTIONS)
      if (requiresCsrfCheck(request.method)) {
        const contentLength = request.headers.get('content-length');
        if (contentLength) {
          const bodySize = parseInt(contentLength, 10);
          const maxSize = getMaxBodySize(pathname);
          if (bodySize > maxSize) {
            const sizeResponse = NextResponse.json(
              { success: false, error: `Request body too large. Maximum: ${maxSize / 1024 / 1024}MB` },
              { status: 413, headers: { 'X-Request-Id': requestId } },
            );
            const sizeOrigin = request.headers.get('origin');
            if (sizeOrigin) setCorsHeaders(sizeResponse, sizeOrigin);
            observeHttpRequest(request.method, routePattern, 413, (Date.now() - startMs) / 1000);
            return sizeResponse;
          }
        }
      }

      const rateConfig = getRateLimitConfig(pathname);
      const ip = getClientIp(request);

      const isUserScoped = rateConfig === RATE_LIMITS.upload
        || rateConfig === RATE_LIMITS.export;

      const userId = isUserScoped
        ? extractUserIdFromAuthHeader(request.headers.get('authorization'))
        : null;

      const identifier = userId || ip;
      const routeKey = pathname.replace(/\//g, '_').slice(0, 60);
      const rateLimitKey = `rl:${routeKey}:${identifier}`;

      const isRateLimitExempt = RATE_LIMIT_EXEMPT.some((r) => pathname.startsWith(r))
        || isLocalRateLimitAddress(ip);
      const result = isRateLimitExempt
        ? { allowed: true, remaining: 999, reset: 0, limit: 999 }
        : await checkRateLimit(rateLimitKey, rateConfig.limit, rateConfig.windowMs);

      if (!result.allowed) {
        rateLimitHits.inc({ route: routePattern });
        const rateLimitResponse = NextResponse.json(
          { success: false, error: 'Too many requests', retryAfter: result.reset - Math.ceil(Date.now() / 1000) },
          {
            status: 429,
            headers: {
              'X-Request-Id': requestId,
              'X-RateLimit-Limit': String(result.limit),
              'X-RateLimit-Remaining': '0',
              'X-RateLimit-Reset': String(result.reset),
              'Retry-After': String(Math.max(0, result.reset - Math.ceil(Date.now() / 1000))),
            },
          },
        );
        const rateLimitOrigin = request.headers.get('origin');
        if (rateLimitOrigin) setCorsHeaders(rateLimitResponse, rateLimitOrigin);
        observeHttpRequest(request.method, routePattern, 429, (Date.now() - startMs) / 1000);
        return rateLimitResponse;
      }

      // --- CSRF validation (non-GET write operations) ---
      if (requiresCsrfCheck(request.method) && !CSRF_EXEMPT.some((r) => pathname.startsWith(r))
          && !isLocalRateLimitAddress(ip)) {
        if (!validateCsrfToken(request)) {
          const originOk = validateOrigin(request);
          if (!originOk) {
            const csrfResponse = NextResponse.json(
              { success: false, error: 'Invalid CSRF token' },
              { status: 403, headers: { 'X-Request-Id': requestId } },
            );
            const csrfOrigin = request.headers.get('origin');
            if (csrfOrigin) setCorsHeaders(csrfResponse, csrfOrigin);
            observeHttpRequest(request.method, routePattern, 403, (Date.now() - startMs) / 1000);
            return csrfResponse;
          }
        }
      }

      const response = NextResponse.next();
      response.headers.set('X-Request-Id', requestId);
      response.headers.set('X-API-Version', '1');
      response.headers.set('X-RateLimit-Limit', String(result.limit));
      response.headers.set('X-RateLimit-Remaining', String(result.remaining));
      response.headers.set('X-RateLimit-Reset', String(result.reset));
      const origin = request.headers.get('origin');
      if (origin) setCorsHeaders(response, origin);
      observeHttpRequest(request.method, routePattern, 200, (Date.now() - startMs) / 1000);
      return response;
    } finally {
      httpRequestsInFlight.dec();
    }
  }

  // --- i18n locale handling (page routes) ---
  const i18nResponse = handleI18n(request);
  if (i18nResponse) {
    i18nResponse.headers.set('X-Request-Id', requestId);
    return i18nResponse;
  }

  // Fallback: should not reach here if handleI18n always returns
  const response = NextResponse.next();
  response.headers.set('X-Request-Id', requestId);
  return response;
}

export const config = {
  matcher: [
    // next-intl locale patterns
    '/(zh-CN|en)/:path*',
    '/',
    // API routes
    '/api/:path*',
    // Page routes
    '/dashboard/:path*',
    '/avatars/:path*',
    '/assets/:path*',
    '/marketplace/:path*',
    '/settings/:path*',
    '/admin/:path*',
    '/api-docs/:path*',
    '/help/:path*',
    '/login',
    '/register',
    '/forgot-password',
    '/reset-password',
    '/purchases',
    '/seller',
  ],
};
