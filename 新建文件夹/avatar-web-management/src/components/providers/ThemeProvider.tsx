'use client';

import { useEffect, useMemo } from 'react';
import { ConfigProvider, theme, App } from 'antd';
import { AntdRegistry } from '@ant-design/nextjs-registry';
import { useUIStore, type ThemeMode } from '@/stores/uiStore';
import { warmAmberTokens, darkTokens, toAntdThemeTokens } from '@/lib/design-system';

function resolveTheme(mode: ThemeMode): 'light' | 'dark' {
  if (mode === 'system') {
    if (typeof window !== 'undefined') {
      return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
    }
    return 'light';
  }
  return mode === 'dark' ? 'dark' : 'light';
}

export default function ThemeProvider({ children }: { children: React.ReactNode }) {
  const themeMode = useUIStore((s) => s.themeMode);
  const resolved = resolveTheme(themeMode);
  const tokens = resolved === 'dark' ? darkTokens : warmAmberTokens;

  // Hydrate theme from localStorage on mount (runs once)
  useEffect(() => {
    const stored = localStorage.getItem('theme-mode') as ThemeMode | null;
    if (stored) {
      const current = useUIStore.getState().themeMode;
      if (stored !== current) {
        useUIStore.setState({ themeMode: stored });
      }
    }
  }, []);

  // Set data-theme attribute on <html> for Tailwind CSS variable switching
  useEffect(() => {
    document.documentElement.setAttribute('data-theme', resolved);
  }, [resolved]);

  // Memoize Ant Design tokens to prevent infinite re-render from new object references
  const antdTheme = useMemo(
    () => ({
      algorithm: resolved === 'dark' ? theme.darkAlgorithm : theme.defaultAlgorithm,
      token: toAntdThemeTokens(tokens),
    }),
    [resolved, tokens],
  );

  return (
    <AntdRegistry>
      <ConfigProvider theme={antdTheme}>
        <App>
          {children}
        </App>
      </ConfigProvider>
    </AntdRegistry>
  );
}
