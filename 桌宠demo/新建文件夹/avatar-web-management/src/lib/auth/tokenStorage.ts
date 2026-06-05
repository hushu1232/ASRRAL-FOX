/**
 * Token 存储抽象层
 *
 * 将所有 token 和用户数据的持久化操作集中在一个地方。
 * 当前使用 localStorage 实现，计划迁移到 httpOnly cookie + BFF pattern。
 * 迁移时只需修改此文件的实现，不影响任何调用方。
 *
 * Security note:
 *   localStorage 容易受 XSS 攻击。生产环境应将 accessToken 迁移到
 *   httpOnly cookie，只通过 BFF (Backend-for-Frontend) token handler 访问。
 *   当前实现作为过渡方案，CSRF token 已通过 XSRF-TOKEN cookie 提供防护。
 *
 * @see ADR-XXX: Token Storage Migration Plan
 */

interface StoredAuth {
  user: {
    id: string;
    email: string;
    username: string;
    avatar_url: string | null;
    role: string;
    level: number;
    exp: number;
    activeTitle: string | null;
    unlockedTitles: string[];
  };
  accessToken: string;
}

const STORAGE_KEY = 'astralfox_auth';

function isBrowser(): boolean {
  return typeof window !== 'undefined';
}

// ─── Public API ────────────────────────────────────────────────

export function getStoredAuth(): StoredAuth | null {
  if (!isBrowser()) return null;
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const data: unknown = JSON.parse(raw);
    if (isValidAuthData(data)) return data;
    // Corrupted data — clean up
    localStorage.removeItem(STORAGE_KEY);
    return null;
  } catch {
    return null;
  }
}

export function setStoredAuth(auth: StoredAuth): void {
  if (!isBrowser()) return;
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(auth));
  } catch {
    // Storage full or disabled — silently fail (auth state lives in memory)
  }
}

export function clearStoredAuth(): void {
  if (!isBrowser()) return;
  try {
    localStorage.removeItem(STORAGE_KEY);
  } catch {
    // Best effort
  }
}

export function getStoredAccessToken(): string | null {
  return getStoredAuth()?.accessToken ?? null;
}

export function getStoredUser(): StoredAuth['user'] | null {
  return getStoredAuth()?.user ?? null;
}

// ─── Future migration hook ──────────────────────────────────────

/**
 * 当迁移到 httpOnly cookie 方案时，替换以下函数的实现：
 *
 * - getStoredAccessToken() → 从内存/React Context 读取 (cookie 不可被 JS 访问)
 * - getStoredUser()      → 调用 /api/auth/me 或从 JWT payload 解析
 * - setStoredAuth()       → 仅调用 /api/auth/login 获取 httpOnly cookie
 * - clearStoredAuth()     → 调用 /api/auth/logout 清除 cookie
 */

// ─── Helpers ─────────────────────────────────────────────────────

function isValidAuthData(data: unknown): data is StoredAuth {
  if (typeof data !== 'object' || data === null) return false;
  const d = data as Record<string, unknown>;
  return (
    typeof d.accessToken === 'string' &&
    d.accessToken.length > 0 &&
    typeof d.user === 'object' &&
    d.user !== null &&
    typeof (d.user as Record<string, unknown>).id === 'string'
  );
}
