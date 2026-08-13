import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { routing } from '@/i18n/routing';
import { checkRateLimit, RATE_LIMITS } from '@/lib/rate-limit';
import { validateCsrfToken, requiresCsrfCheck, validateOrigin } from '@/lib/csrf';
import { handleCors, setCorsHeaders } from '@/lib/cors';
import { httpRequestsInFlight, observeHttpRequest, rateLimitHits } from '@/lib/metrics';

// API routes that don't need CSRF (login/register before token acquisition)
const CSRF_EXEMPT = ['/api/auth/login', '/api/auth/register', '/api/auth/refresh', '/api/health'];
// Endpoints exempt from rate limiting (Prometheus scrape, health checks)
const RATE_LIMIT_EXEMPT = ['/api/metrics', '/api/health'];

// Body size limits (bytes)
const MAX_BODY_SIZE_GENERAL = 1 * 1024 * 1024;   // 1MB for general API
const MAX_BODY_SIZE_UPLOAD = 50 * 1024 * 1024;    // 50MB for upload endpoints
const MAX_BODY_SIZE_EXPORT = 10 * 1024 * 1024;    // 10MB for export endpoints
const TRUST_PROXY_AUTH_HEADER = 'x-foxd-proxy-token';

function getClientIp(request: NextRequest): string | null {
  if (process.env.TRUST_PROXY_HEADERS !== 'true') return null;
  const proxySecret = process.env.TRUST_PROXY_SECRET;
  if (!proxySecret || request.headers.get(TRUST_PROXY_AUTH_HEADER) !== proxySecret) return null;

  const singleHeaderValue = (value: string | null): string | null => {
    const values = value?.split(',').map((part) => part.trim()).filter(Boolean) || [];
    return values.length === 1 ? values[0] : null;
  };

  // A trusted proxy must overwrite these headers. Reject appended chains so a
  // client-supplied first X-Forwarded-For value cannot become the limit key.
  return singleHeaderValue(request.headers.get('x-forwarded-for'))
    || singleHeaderValue(request.headers.get('x-real-ip'))
    || null;
}

function getRateLimitIdentity(request: NextRequest): string | null {
  const clientIp = getClientIp(request);
  if (clientIp) return clientIp;

  // Local development has no trusted proxy by default. Keep it usable with a
  // deliberately shared, route-scoped bucket; production fails closed below.
  if (process.env.NODE_ENV !== 'production') return 'local-dev';
  return null;
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

function hasRequestBody(request: NextRequest): boolean {
  const contentLength = request.headers.get('content-length')?.trim();
  if (contentLength === '0') return false;
  return Boolean(
    request.headers.get('transfer-encoding')
    || request.headers.get('content-type')
    || contentLength,
  );
}

function bodySizeError(request: NextRequest, requestId: string, status: 400 | 411 | 413, message: string): NextResponse {
  const response = NextResponse.json(
    { success: false, error: message },
    { status, headers: { 'X-Request-Id': requestId } },
  );
  const origin = request.headers.get('origin');
  if (origin) setCorsHeaders(response, origin);
  return response;
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
  const apiPathname = pathname.startsWith('/api/v1/')
    ? pathname.replace('/api/v1/', '/api/')
    : pathname;
  const apiRewriteUrl = apiPathname === pathname ? null : new URL(apiPathname, request.url);
  if (apiRewriteUrl) apiRewriteUrl.search = request.nextUrl.search;

  const requestId = crypto.randomUUID();
  request.headers.set('x-request-id', requestId);

  // --- CORS & Rate limiting (API routes) ---
  if (apiPathname.startsWith('/api/')) {
    const startMs = Date.now();
    httpRequestsInFlight.inc();

    const routePattern = apiPathname.replace(/\/[a-f0-9-]{36}/g, '/:id').replace(/\/\d+/g, '/:num');

    try {
      // CORS check (first, including OPTIONS preflight)
      const corsResult = handleCors(request);
      if (corsResult) {
        corsResult.headers.set('X-Request-Id', requestId);
        observeHttpRequest(request.method, routePattern, corsResult.status, (Date.now() - startMs) / 1000);
        return corsResult;
      }

      // Body size check (skip for GET/HEAD/OPTIONS). In production, a body
      // without a trustworthy length is rejected before any route handler can
      // buffer it. The ingress proxy buffers chunked requests and forwards a
      // Content-Length header, so normal uploads remain compatible.
      if (requiresCsrfCheck(request.method)) {
        const contentLength = request.headers.get('content-length');
        const transferEncoding = request.headers.get('transfer-encoding');
        if (process.env.NODE_ENV === 'production' && hasRequestBody(request) && !contentLength) {
          const sizeResponse = bodySizeError(
            request,
            requestId,
            411,
            'Content-Length is required for bounded request bodies',
          );
          observeHttpRequest(request.method, routePattern, 411, (Date.now() - startMs) / 1000);
          return sizeResponse;
        }
        if (contentLength && transferEncoding) {
          const sizeResponse = bodySizeError(
            request,
            requestId,
            400,
            'Content-Length and Transfer-Encoding cannot be sent together',
          );
          observeHttpRequest(request.method, routePattern, 400, (Date.now() - startMs) / 1000);
          return sizeResponse;
        }
        if (contentLength) {
          const normalizedLength = contentLength.trim();
          const bodySize = /^\d+$/.test(normalizedLength) ? Number(normalizedLength) : Number.NaN;
          const maxSize = getMaxBodySize(apiPathname);
          if (!Number.isSafeInteger(bodySize) || bodySize < 0) {
            const sizeResponse = bodySizeError(request, requestId, 400, 'Invalid Content-Length');
            observeHttpRequest(request.method, routePattern, 400, (Date.now() - startMs) / 1000);
            return sizeResponse;
          }
          if (bodySize > maxSize) {
            const sizeResponse = bodySizeError(
              request,
              requestId,
              413,
              `Request body too large. Maximum: ${maxSize / 1024 / 1024}MB`,
            );
            observeHttpRequest(request.method, routePattern, 413, (Date.now() - startMs) / 1000);
            return sizeResponse;
          }
        }
      }

      const rateConfig = getRateLimitConfig(apiPathname);
      const identity = getRateLimitIdentity(request);
      const matchesRoute = (route: string) => apiPathname === route || apiPathname.startsWith(`${route}/`);
      const routeKey = apiPathname.replace(/\//g, '_').slice(0, 60);

      const isRateLimitExempt = RATE_LIMIT_EXEMPT.some(matchesRoute);
      if (!isRateLimitExempt && !identity) {
        const unavailableResponse = NextResponse.json(
          { success: false, error: 'Rate limiting is not configured for this deployment' },
          {
            status: 503,
            headers: {
              'X-Request-Id': requestId,
              'Retry-After': '60',
            },
          },
        );
        const unavailableOrigin = request.headers.get('origin');
        if (unavailableOrigin) setCorsHeaders(unavailableResponse, unavailableOrigin);
        observeHttpRequest(request.method, routePattern, 503, (Date.now() - startMs) / 1000);
        return unavailableResponse;
      }

      const result = isRateLimitExempt
        ? { allowed: true, remaining: rateConfig.limit, reset: 0, limit: rateConfig.limit }
        : await checkRateLimit(`rl:${routeKey}:${identity}`, rateConfig.limit, rateConfig.windowMs);

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
      if (requiresCsrfCheck(request.method) && !CSRF_EXEMPT.some(matchesRoute)) {
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

      const response = apiRewriteUrl ? NextResponse.rewrite(apiRewriteUrl) : NextResponse.next();
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
    '/companion/:path*',
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
