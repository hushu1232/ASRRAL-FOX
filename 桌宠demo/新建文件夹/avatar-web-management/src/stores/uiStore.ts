'use client';

import { create } from 'zustand';

export type ThemeMode = 'light' | 'dark' | 'system';

interface UIState {
  sidebarCollapsed: boolean;
  toggleSidebar: () => void;
  themeMode: ThemeMode;
  setThemeMode: (mode: ThemeMode) => void;
  isMobile: boolean;
  setIsMobile: (v: boolean) => void;
  mobileMenuOpen: boolean;
  setMobileMenuOpen: (v: boolean) => void;
}

export const useUIStore = create<UIState>((set) => ({
  sidebarCollapsed: false,
  toggleSidebar: () => set((s) => ({ sidebarCollapsed: !s.sidebarCollapsed })),
  themeMode: 'light',
  setThemeMode: (mode) => {
    if (typeof window !== 'undefined') {
      localStorage.setItem('theme-mode', mode);
    }
    set({ themeMode: mode });
  },
  isMobile: false,
  setIsMobile: (v) => set({ isMobile: v }),
  mobileMenuOpen: false,
  setMobileMenuOpen: (v) => set({ mobileMenuOpen: v }),
}));
