// CSRF 保护 — Double Submit Cookie 模式
// 无状态：服务端不存储 token，仅比对 Cookie 与 Header 是否一致

import { NextRequest } from 'next/server';

const CSRF_COOKIE = 'XSRF-TOKEN';
const CSRF_HEADER = 'X-CSRF-Token';

/**
 * 生成新的 CSRF token
 */
export function generateCsrfToken(): string {
  return crypto.randomUUID();
}

/**
 * 从请求中提取 CSRF token（Header 优先，其次 Cookie）
 */
export function getCsrfTokenFromRequest(req: NextRequest): string | null {
  // Header 优先
  const headerToken = req.headers.get(CSRF_HEADER.toLowerCase());
  if (headerToken) return headerToken;

  // Cookie 作为备选
  return req.cookies.get(CSRF_COOKIE)?.value || null;
}

/**
 * 获取 Cookie 中的 CSRF token
 */
export function getCsrfTokenFromCookie(req: NextRequest): string | null {
  return req.cookies.get(CSRF_COOKIE)?.value || null;
}

/**
 * 验证 CSRF token：Header 与 Cookie 必须一致
 */
export function validateCsrfToken(req: NextRequest): boolean {
  const headerToken = req.headers.get(CSRF_HEADER.toLowerCase());
  const cookieToken = req.cookies.get(CSRF_COOKIE)?.value;

  if (!headerToken || !cookieToken) return false;
  return headerToken === cookieToken;
}

/**
 * 检查请求是否需要 CSRF 校验
 * GET/HEAD/OPTIONS 不校验（幂等安全操作）
 */
export function requiresCsrfCheck(method: string): boolean {
  return !['GET', 'HEAD', 'OPTIONS'].includes(method.toUpperCase());
}

/**
 * 生成 CSRF Cookie 的 Set-Cookie 字符串
 */
export function csrfCookieString(token: string): string {
  return `${CSRF_COOKIE}=${token}; Path=/; SameSite=Lax; Max-Age=86400; Secure=${process.env.NODE_ENV === 'production'}`;
}

/**
 * 验证 Origin/Referer 头（Server Actions 兼容）
 * 作为 CSRF 校验的补充手段
 */
export function validateOrigin(req: NextRequest): boolean {
  const origin = req.headers.get('origin');
  const referer = req.headers.get('referer');
  const host = req.headers.get('host') || '';

  const requestOrigin = origin || (referer ? extractOriginFromReferer(referer) : null);
  if (!requestOrigin) return true; // 无 Origin 时放行（如服务端调用）

  try {
    const originHost = new URL(requestOrigin).host;
    const originHostname = originHost.split(':')[0]; // strip port
    return originHost === host || originHostname === 'localhost';
  } catch {
    return false;
  }
}

function extractOriginFromReferer(referer: string): string | null {
  try {
    const url = new URL(referer);
    return url.origin;
  } catch {
    return null;
  }
}

export { CSRF_COOKIE, CSRF_HEADER };
