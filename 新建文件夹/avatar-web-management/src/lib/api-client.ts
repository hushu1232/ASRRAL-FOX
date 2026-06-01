import { useAuthStore } from '@/stores/authStore';
import type { ApiResponse, PaginatedResponse } from '@/types/api';

let refreshPromise: Promise<boolean> | null = null;

function getCsrfToken(): string | null {
  if (typeof document === 'undefined') return null;
  const match = document.cookie.match(/(?:^|;\s*)XSRF-TOKEN=([^;]*)/);
  return match ? decodeURIComponent(match[1]) : null;
}

function csrfHeaders(extra?: Record<string, string>): Record<string, string> {
  const token = getCsrfToken();
  const base: Record<string, string> = extra ? { ...extra } : {};
  if (token) base['X-CSRF-Token'] = token;
  return base;
}

async function ensureFreshToken(): Promise<string | null> {
  const { accessToken, refreshAuth, clearAuth } = useAuthStore.getState();

  if (accessToken) return accessToken;

  // Try refreshing
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

export async function apiGet<T>(path: string, params?: Record<string, string>): Promise<ApiResponse<T>> {
  const token = await ensureFreshToken();
  if (!token) {
    // Guest mode: redirect to login for protected pages
    if (typeof window !== 'undefined' && !window.location.pathname.startsWith('/login')) {
      window.location.href = `/login?callbackUrl=${encodeURIComponent(window.location.href)}`;
    }
    return { success: false, data: null as T, error: 'Not authenticated' };
  }

  const url = new URL(path, window.location.origin);
  if (params) {
    Object.entries(params).forEach(([k, v]) => url.searchParams.set(k, v));
  }

  const res = await fetch(url.toString(), {
    headers: csrfHeaders({ Authorization: `Bearer ${token}` }),
  });

  if (res.status === 401) {
    // Token expired mid-request — try refresh once
    useAuthStore.setState({ accessToken: null });
    const newToken = await ensureFreshToken();
    if (newToken) {
      const retry = await fetch(url.toString(), {
        headers: csrfHeaders({ Authorization: `Bearer ${newToken}` }),
      });
      return retry.json();
    }
  }

  return res.json();
}

export async function apiPost<T>(path: string, body?: unknown): Promise<ApiResponse<T>> {
  const token = await ensureFreshToken();
  if (!token) {
    return { success: false, data: null as T, error: 'Not authenticated' };
  }

  const res = await fetch(path, {
    method: 'POST',
    headers: csrfHeaders({
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    }),
    body: body ? JSON.stringify(body) : undefined,
  });

  if (res.status === 401) {
    useAuthStore.setState({ accessToken: null });
    const newToken = await ensureFreshToken();
    if (newToken) {
      const retry = await fetch(path, {
        method: 'POST',
        headers: csrfHeaders({
          'Content-Type': 'application/json',
          Authorization: `Bearer ${newToken}`,
        }),
        body: body ? JSON.stringify(body) : undefined,
      });
      return retry.json();
    }
  }

  return res.json();
}

export async function apiPut<T>(path: string, body?: unknown): Promise<ApiResponse<T>> {
  const token = await ensureFreshToken();
  if (!token) {
    return { success: false, data: null as T, error: 'Not authenticated' };
  }

  const res = await fetch(path, {
    method: 'PUT',
    headers: csrfHeaders({
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    }),
    body: body ? JSON.stringify(body) : undefined,
  });

  if (res.status === 401) {
    useAuthStore.setState({ accessToken: null });
    const newToken = await ensureFreshToken();
    if (newToken) {
      const retry = await fetch(path, {
        method: 'PUT',
        headers: csrfHeaders({
          'Content-Type': 'application/json',
          Authorization: `Bearer ${newToken}`,
        }),
        body: body ? JSON.stringify(body) : undefined,
      });
      return retry.json();
    }
  }

  return res.json();
}

export async function apiPostFormData<T>(path: string, formData: FormData): Promise<ApiResponse<T>> {
  const token = await ensureFreshToken();
  if (!token) {
    return { success: false, data: null as T, error: 'Not authenticated' };
  }

  const res = await fetch(path, {
    method: 'POST',
    headers: csrfHeaders({
      Authorization: `Bearer ${token}`,
    }),
    body: formData,
  });

  if (res.status === 401) {
    useAuthStore.setState({ accessToken: null });
    const newToken = await ensureFreshToken();
    if (newToken) {
      const retry = await fetch(path, {
        method: 'POST',
        headers: csrfHeaders({
          Authorization: `Bearer ${newToken}`,
        }),
        body: formData,
      });
      return retry.json();
    }
  }

  return res.json();
}

export async function apiDelete<T>(path: string): Promise<ApiResponse<T>> {
  const token = await ensureFreshToken();
  if (!token) {
    return { success: false, data: null as T, error: 'Not authenticated' };
  }

  const res = await fetch(path, {
    method: 'DELETE',
    headers: csrfHeaders({ Authorization: `Bearer ${token}` }),
  });

  if (res.status === 401) {
    useAuthStore.setState({ accessToken: null });
    const newToken = await ensureFreshToken();
    if (newToken) {
      const retry = await fetch(path, {
        method: 'DELETE',
        headers: csrfHeaders({ Authorization: `Bearer ${newToken}` }),
      });
      return retry.json();
    }
  }

  return res.json();
}

export type { ApiResponse, PaginatedResponse };
