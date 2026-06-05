// Edge 中间件 — i18n locale 检测、机器人防护、页面/API 鉴权、安全头补全
import { NextRequest, NextResponse } from 'next/server';

// --- i18n ---
const LOCALES = ['zh-CN', 'en', 'ja'] as const;
const DEFAULT_LOCALE = 'zh-CN';

/**
 * Detect user locale from cookie, Accept-Language header, or default.
 * Sets NEXT_LOCALE cookie for next-intl to pick up via requestLocale.
 */
function resolveLocale(request: NextRequest): string {
  // 1. Cookie preference
  const cookieLocale = request.cookies.get('NEXT_LOCALE')?.value;
  if (cookieLocale && LOCALES.includes(cookieLocale as (typeof LOCALES)[number])) {
    return cookieLocale;
  }

  // 2. Accept-Language header
  const acceptLang = request.headers.get('accept-language');
  if (acceptLang) {
    const preferred = acceptLang.split(',')[0]?.trim()?.slice(0, 5);
    if (preferred && LOCALES.includes(preferred as (typeof LOCALES)[number])) {
      return preferred;
    }
    // Handle zh-* variants → zh-CN
    if (preferred?.startsWith('zh')) return 'zh-CN';
    if (preferred?.startsWith('en')) return 'en';
  }

  return DEFAULT_LOCALE;
}

// --- bot detection ---
// Patterns that match common script/automation tools without matching real browsers.
const BOT_UA_PATTERNS = [
  /^$/,                     // empty UA (most bots / misconfigured scripts)
  /^curl\//i,               // curl
  /^wget\//i,               // wget
  /^python-requests/i,      // Python requests library
  /^python-urllib/i,        // Python urllib
  /^Go-http-client/i,       // Go net/http
  /^Java\/[\d.]+$/i,        // Java HTTP client (bare)
  /^libwww-perl/i,          // Perl LWP
  /^PHP\/[\d.]+$/i,         // PHP cURL wrapper (bare)
  /^Apache-HttpClient/i,    // Apache HTTP client
  /^node-fetch/i,           // node-fetch
  /^axios/i,                // axios default UA
  /^okhttp/i,               // OkHttp
];

function looksLikeBot(ua: string | null, ip: string): boolean {
  // Localhost requests (dev / integration tests) are never bots
  if (ip === '127.0.0.1' || ip === '::1' || ip === 'localhost') return false;
  if (!ua || ua.trim().length === 0) return true;
  return BOT_UA_PATTERNS.some((p) => p.test(ua));
}

function getClientIp(request: NextRequest): string {
  return request.headers.get('x-forwarded-for')?.split(',')[0]?.trim()
    || request.headers.get('x-real-ip')
    || '127.0.0.1';
}

// --- body size limits ---
const DEFAULT_BODY_LIMIT = 1_048_576;     // 1MB for general API requests
const UPLOAD_BODY_LIMIT = 52_428_800;      // 50MB for file upload endpoints

const UPLOAD_ROUTES = [
  '/api/assets/upload/init',
  '/api/assets/upload/',
  '/api/rigging/upload',
  '/api/avatars/',
];

function getBodyLimit(pathname: string): number {
  if (UPLOAD_ROUTES.some((p) => pathname.startsWith(p))) return UPLOAD_BODY_LIMIT;
  return DEFAULT_BODY_LIMIT;
}

// Sensitive auth endpoints that should reject bot traffic
const SENSITIVE_AUTH = [
  '/api/auth/login',
  '/api/auth/register',
  '/api/auth/forgot-password',
  '/api/auth/reset-password',
  '/api/oauth/token',
  '/api/oauth/authorize',
];

// Public API routes (no Bearer token required)
const PUBLIC_API = [
  '/api/auth/',
  '/api/health',
  '/api/metrics',
  '/api/csp-report',
  '/api/docs',
  '/api/oauth/',
  '/.well-known/',
  '/api/rigging/health',
  '/api/rigging/status/',
  '/api/market/items',
  '/api/search',
  '/api/assets/proxy',
];

// Page routes that need authentication
const PROTECTED_PAGE_PREFIXES = [
  '/dashboard',
  '/admin',
  '/avatars',
  '/assets',
  '/marketplace',
  '/seller',
  '/settings',
  '/notifications',
  '/purchases',
  '/help',
  '/api-docs',
];

// Public page routes (no auth cookie required)
const PUBLIC_PAGE_PREFIXES = [
  '/login',
  '/register',
  '/forgot-password',
  '/reset-password',
  '/oauth/consent',
];

function matchPrefix(pathname: string, prefixes: string[]): boolean {
  return prefixes.some((p) => pathname.startsWith(p));
}

// --- main ---
export default function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // 1. Bot protection — block obvious bots on sensitive auth endpoints
  if (matchPrefix(pathname, SENSITIVE_AUTH)) {
    const ua = request.headers.get('user-agent');
    const ip = getClientIp(request);
    if (looksLikeBot(ua, ip)) {
      return new NextResponse('Forbidden', {
        status: 403,
        headers: { 'Content-Type': 'text/plain; charset=utf-8' },
      });
    }
  }

  // 2. Body size check — reject oversized payloads before they hit the API
  if (pathname.startsWith('/api/')) {
    const contentLength = request.headers.get('content-length');
    if (contentLength) {
      const size = parseInt(contentLength, 10);
      const limit = getBodyLimit(pathname);
      if (!isNaN(size) && size > limit) {
        return NextResponse.json(
          {
            success: false,
            error: `Request body too large. Max: ${Math.round(limit / 1_048_576)}MB`,
          },
          { status: 413 },
        );
      }
    }
  }

  // 3. API auth — require Bearer token for non-public API routes
  if (pathname.startsWith('/api/') && !matchPrefix(pathname, PUBLIC_API)) {
    const authHeader = request.headers.get('authorization');
    if (!authHeader?.startsWith('Bearer ')) {
      return NextResponse.json(
        { success: false, error: 'Missing or invalid authorization header' },
        { status: 401 },
      );
    }
    // Full JWT verification happens in route handlers via withAuth()
    const response = NextResponse.next();
    response.headers.set('X-API-Version', '1');
    return response;
  }

  // 4. i18n — detect locale from cookie / Accept-Language, set cookie for next-intl
  const locale = resolveLocale(request);
  const response = NextResponse.next();
  response.cookies.set('NEXT_LOCALE', locale, {
    path: '/',
    maxAge: 365 * 24 * 60 * 60, // 1 year
    sameSite: 'lax',
  });
  response.headers.set('X-API-Version', '1');
  response.headers.set('X-Content-Type-Options', 'nosniff');

  // 5. Page auth — redirect unauthenticated users away from protected pages
  if (
    matchPrefix(pathname, PROTECTED_PAGE_PREFIXES) &&
    !matchPrefix(pathname, PUBLIC_PAGE_PREFIXES)
  ) {
    const token = request.cookies.get('refreshToken')?.value || request.cookies.get('access_token')?.value;
    if (!token) {
      const loginUrl = new URL('/login', request.url);
      loginUrl.searchParams.set('callbackUrl', pathname + request.nextUrl.search);
      return NextResponse.redirect(loginUrl);
    }
  }

  return response;
}

// --- route matcher ---
// Exclude static assets and Next.js internals for performance.
export const config = {
  matcher: [
    '/((?!_next/static|_next/image|_next/webpack-hmr|favicon\\.ico|.*\\.(?:svg|png|jpe?g|gif|ico|webp|avif|glb|gltf|moc3|woff2?|ttf|eot|map|json|wasm)).*)',
  ],
};
