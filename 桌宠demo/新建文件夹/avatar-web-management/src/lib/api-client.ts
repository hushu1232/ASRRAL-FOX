import { useAuthStore } from '@/stores/authStore';
import { getStoredAccessToken } from '@/lib/auth/tokenStorage';
import type { ApiResponse, PaginatedResponse } from '@/types/api';

let refreshPromise: Promise<boolean> | null = null;

// ─── CSRF ──────────────────────────────────────────────────────

function getCsrfToken(): string | null {
  if (typeof document === 'undefined') return null;
  const match = document.cookie.match(/(?:^|;\s*)XSRF-TOKEN=([^;]*)/);
  return match ? decodeURIComponent(match[1]) : null;
}

// ─── Token management ──────────────────────────────────────────

async function ensureFreshToken(): Promise<string | null> {
  const { accessToken, clearAuth } = useAuthStore.getState();

  if (accessToken) return accessToken;

  if (!refreshPromise) {
    refreshPromise = (async () => {
      try {
        const res = await fetch('/api/auth/refresh', { method: 'POST' });
        if (!res.ok) return false;
        const data = await res.json();
        if (data.success) {
          useAuthStore.setState({
            accessToken: data.data.accessToken,
            user: data.data.user,
            isAuthenticated: true,
            isLoading: false,
          });
          return true;
        }
        return false;
      } catch {
        clearAuth();
        return false;
      } finally {
        refreshPromise = null;
      }
    })();
  }

  const ok = await refreshPromise;
  return ok ? useAuthStore.getState().accessToken : null;
}

async function redirectToLogin(): Promise<never> {
  if (typeof window !== 'undefined' && !window.location.pathname.startsWith('/login')) {
    window.location.href = `/login?callbackUrl=${encodeURIComponent(window.location.href)}`;
  }
  // Return a never-resolving promise so callers can treat this as terminal
  return new Promise(() => {});
}

// ─── Core request factory ──────────────────────────────────────

interface RequestOptions {
  method: 'GET' | 'POST' | 'PUT' | 'DELETE';
  path: string;
  body?: unknown;          // JSON body or FormData
  params?: Record<string, string>; // query params (GET only)
  isFormData?: boolean;
}

/**
 * Unified request factory — single implementation shared by all HTTP methods.
 * Handles: auth token, CSRF, query params, 401 retry-with-refresh, guest redirect.
 */
async function request<T>(opts: RequestOptions): Promise<ApiResponse<T>> {
  const { method, path, body, params, isFormData } = opts;

  const token = await ensureFreshToken();
  if (!token) return redirectToLogin();

  // Build URL
  const url = new URL(path, window.location.origin);
  if (params) {
    Object.entries(params).forEach(([k, v]) => url.searchParams.set(k, v));
  }

  // Build headers
  const headers: Record<string, string> = { Authorization: `Bearer ${token}` };
  const csrf = getCsrfToken();
  if (csrf) headers['X-CSRF-Token'] = csrf;
  if (!isFormData) headers['Content-Type'] = 'application/json';

  const fetchOpts: RequestInit = {
    method,
    headers,
    body: isFormData ? (body as FormData) : body ? JSON.stringify(body) : undefined,
  };

  let res = await fetch(url.toString(), fetchOpts);

  // 401 → refresh once and retry
  if (res.status === 401) {
    useAuthStore.setState({ accessToken: null });
    const newToken = await ensureFreshToken();
    if (newToken) {
      headers.Authorization = `Bearer ${newToken}`;
      const csrf2 = getCsrfToken();
      if (csrf2) headers['X-CSRF-Token'] = csrf2;
      res = await fetch(url.toString(), { ...fetchOpts, headers });
    }
  }

  return res.json();
}

// ─── Public API ────────────────────────────────────────────────

export async function apiGet<T>(path: string, params?: Record<string, string>): Promise<ApiResponse<T>> {
  return request<T>({ method: 'GET', path, params });
}

export async function apiPost<T>(path: string, body?: unknown): Promise<ApiResponse<T>> {
  return request<T>({ method: 'POST', path, body });
}

export async function apiPut<T>(path: string, body?: unknown): Promise<ApiResponse<T>> {
  return request<T>({ method: 'PUT', path, body });
}

export async function apiDelete<T>(path: string): Promise<ApiResponse<T>> {
  return request<T>({ method: 'DELETE', path });
}

export async function apiPostFormData<T>(path: string, formData: FormData): Promise<ApiResponse<T>> {
  return request<T>({ method: 'POST', path, body: formData, isFormData: true });
}

export type { ApiResponse, PaginatedResponse };
