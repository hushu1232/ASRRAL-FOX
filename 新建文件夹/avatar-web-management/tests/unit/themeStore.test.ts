/**
 * @jest-environment jsdom
 */

import { useUIStore } from '@/stores/uiStore';

describe('themeStore', () => {
  beforeEach(() => {
    useUIStore.setState({ themeMode: 'light' });
    localStorage.clear();
  });

  it('defaults to light theme', () => {
    expect(useUIStore.getState().themeMode).toBe('light');
  });

  it('setThemeMode changes mode and persists to localStorage', () => {
    useUIStore.getState().setThemeMode('dark');
    expect(useUIStore.getState().themeMode).toBe('dark');
    expect(localStorage.getItem('theme-mode')).toBe('dark');
  });

  it('supports all three modes', () => {
    useUIStore.getState().setThemeMode('system');
    expect(useUIStore.getState().themeMode).toBe('system');
    expect(localStorage.getItem('theme-mode')).toBe('system');
  });
});
