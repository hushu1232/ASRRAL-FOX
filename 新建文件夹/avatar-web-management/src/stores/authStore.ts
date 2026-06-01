'use client';

import { create } from 'zustand';

interface User {
  id: string;
  email: string;
  username: string;
  avatar_url: string | null;
  role: string;
  level: number;
  exp: number;
  activeTitle: string | null;
  unlockedTitles: string[];
}

interface AuthState {
  user: User | null;
  accessToken: string | null;
  isLoading: boolean;
  isAuthenticated: boolean;

  setAuth: (user: User, accessToken: string) => void;
  setAccessToken: (token: string) => void;
  setLoading: (loading: boolean) => void;
  clearAuth: () => void;
  hydrateFromStorage: () => void;
  refreshAuth: () => Promise<void>;
  login: (email: string, password: string) => Promise<void>;
  registerAction: (email: string, username: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
}

const AUTH_STORAGE_KEY = 'astralfox_auth';

function persistAuth(user: unknown, accessToken: string | null) {
  if (typeof window === 'undefined') return;
  try {
    if (user && accessToken) {
      localStorage.setItem(AUTH_STORAGE_KEY, JSON.stringify({ user, accessToken }));
    } else {
      localStorage.removeItem(AUTH_STORAGE_KEY);
    }
  } catch {}
}

// Always start with the same SSR-safe default. Hydrate from storage on client mount.
const DEFAULT_STATE = {
  user: null as User | null,
  accessToken: null as string | null,
  isAuthenticated: false,
  isLoading: true,
};

export const useAuthStore = create<AuthState>((set, get) => ({
  ...DEFAULT_STATE,

  setAuth: (user, accessToken) => {
    persistAuth(user, accessToken);
    set({ user, accessToken, isAuthenticated: true, isLoading: false });
  },

  setAccessToken: (accessToken) => {
    set({ accessToken });
  },

  setLoading: (isLoading) => set({ isLoading }),

  clearAuth: () => {
    persistAuth(null, null);
    set({ user: null, accessToken: null, isAuthenticated: false, isLoading: false });
  },

  // Hydrate from localStorage on client mount (called in useEffect to avoid SSR mismatch)
  hydrateFromStorage: () => {
    if (typeof window === 'undefined') return;
    try {
      const raw = localStorage.getItem(AUTH_STORAGE_KEY);
      if (raw) {
        const data = JSON.parse(raw);
        if (data.user && data.accessToken) {
          set({ user: data.user, accessToken: data.accessToken, isAuthenticated: true, isLoading: false });
          return;
        }
      }
    } catch {}
    set({ isLoading: false });
  },

  refreshAuth: async () => {
    try {
      set({ isLoading: true });
      const res = await fetch('/api/auth/refresh', { method: 'POST' });
      if (!res.ok) throw new Error('Refresh failed');
      const data = await res.json();
      if (data.success) {
        set({
          user: data.data.user,
          accessToken: data.data.accessToken,
          isAuthenticated: true,
          isLoading: false,
        });
      } else {
        set({ isLoading: false, isAuthenticated: false });
      }
    } catch {
      set({ isLoading: false, isAuthenticated: false, user: null, accessToken: null });
    }
  },

  login: async (email, password) => {
    const res = await fetch('/api/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password }),
    });
    const data = await res.json();
    if (!data.success) throw new Error(data.error || 'Login failed');
    persistAuth(data.data.user, data.data.accessToken);
    set({
      user: data.data.user,
      accessToken: data.data.accessToken,
      isAuthenticated: true,
      isLoading: false,
    });
  },

  registerAction: async (email, username, password) => {
    const res = await fetch('/api/auth/register', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, username, password }),
    });
    const data = await res.json();
    if (!data.success) throw new Error(data.error || 'Registration failed');
  },

  logout: async () => {
    try {
      await fetch('/api/auth/logout', { method: 'POST' });
    } finally {
      set({
        user: null,
        accessToken: null,
        isAuthenticated: false,
        isLoading: false,
      });
    }
  },
}));
