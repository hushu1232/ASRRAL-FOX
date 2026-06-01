// CORS 策略 — 动态白名单 + 预检请求处理
// 从 CORS_ORIGINS 环境变量读取允许的 Origin 列表

import { NextRequest, NextResponse } from 'next/server';

const CORS_ALLOW_METHODS = 'GET, POST, PUT, DELETE, PATCH, OPTIONS';
const CORS_ALLOW_HEADERS = 'Content-Type, Authorization, X-CSRF-Token, X-Request-Id, X-API-Version';
const CORS_EXPOSE_HEADERS = 'X-RateLimit-Limit, X-RateLimit-Remaining, X-RateLimit-Reset, X-Request-Id, X-API-Version';
const CORS_MAX_AGE = '86400';

let cachedOrigins: string[] | null = null;
let cachedOriginsRaw: string = '';

function getAllowedOrigins(): string[] {
  const raw = process.env.CORS_ORIGINS || '';
  if (raw === cachedOriginsRaw && cachedOrigins !== null) {
    return cachedOrigins;
  }
  cachedOriginsRaw = raw;
  cachedOrigins = raw
    .split(',')
    .map((o) => o.trim())
    .filter((o) => o.length > 0);
  return cachedOrigins;
}

export function isOriginAllowed(origin: string | null): boolean {
  if (!origin) return false;

  const allowed = getAllowedOrigins();

  // 未配置白名单时，放行 localhost 和同源请求
  if (allowed.length === 0) {
    try {
      const hostname = new URL(origin).hostname;
      return hostname === 'localhost' || hostname === '127.0.0.1' || hostname.endsWith('.local');
    } catch {
      return false;
    }
  }

  return allowed.includes(origin);
}

export function setCorsHeaders(response: NextResponse, origin: string): void {
  response.headers.set('Access-Control-Allow-Origin', origin);
  response.headers.set('Access-Control-Allow-Credentials', 'true');
  response.headers.set('Access-Control-Expose-Headers', CORS_EXPOSE_HEADERS);
  response.headers.set('Vary', 'Origin');
}

export function handlePreflight(): NextResponse {
  const response = new NextResponse(null, { status: 204 });
  response.headers.set('Access-Control-Allow-Methods', CORS_ALLOW_METHODS);
  response.headers.set('Access-Control-Allow-Headers', CORS_ALLOW_HEADERS);
  response.headers.set('Access-Control-Max-Age', CORS_MAX_AGE);
  return response;
}

export function handleCors(request: NextRequest): NextResponse | null {
  const origin = request.headers.get('origin');

  // 无 Origin 头（同源请求或服务端调用），不添加 CORS 头
  if (!origin) return null;

  // OPTIONS 预检请求
  if (request.method === 'OPTIONS') {
    if (!isOriginAllowed(origin)) {
      return NextResponse.json(
        { success: false, error: 'Origin not allowed' },
        { status: 403 },
      );
    }
    const response = handlePreflight();
    response.headers.set('Access-Control-Allow-Origin', origin);
    response.headers.set('Access-Control-Allow-Credentials', 'true');
    return response;
  }

  // 普通请求：检查 Origin 是否在白名单中
  if (!isOriginAllowed(origin)) {
    return NextResponse.json(
      { success: false, error: 'Origin not allowed' },
      { status: 403 },
    );
  }

  return null; // 放行，CORS 头由路由处理程序设置
}
