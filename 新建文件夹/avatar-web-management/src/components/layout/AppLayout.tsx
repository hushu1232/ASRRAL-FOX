'use client';

import { useEffect } from 'react';
import { Layout } from 'antd';
import Sidebar from './Sidebar';
import Header from './Header';
import SkipToMain from '@/components/ui/SkipToMain';
import { useAuthStore } from '@/stores/authStore';
import { useUIStore } from '@/stores/uiStore';
import { Spin } from 'antd';

const { Content } = Layout;

export default function AppLayout({ children }: { children: React.ReactNode }) {
  const { isAuthenticated, isLoading, hydrateFromStorage } = useAuthStore();
  const sidebarCollapsed = useUIStore((s) => s.sidebarCollapsed);
  const setIsMobile = useUIStore((s) => s.setIsMobile);

  // Hydrate auth from localStorage on client mount — avoids SSR mismatch
  useEffect(() => {
    hydrateFromStorage();
  }, [hydrateFromStorage]);

  useEffect(() => {
    const check = () => setIsMobile(window.innerWidth < 640);
    check();
    window.addEventListener('resize', check);
    return () => window.removeEventListener('resize', check);
  }, [setIsMobile]);

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ background: 'var(--bg-deep)' }}>
        <Spin size="large" />
      </div>
    );
  }

  return (
    <Layout style={{ minHeight: '100vh' }}>
      <SkipToMain />
      <Sidebar />
      <Layout style={{ marginLeft: sidebarCollapsed ? 64 : 220, background: 'var(--bg-deep)', transition: 'margin-left 0.2s' }}>
        <Header />
        <Content id="main-content" role="main" className="p-3 md:p-6 lg:px-8" style={{ minHeight: 'calc(100vh - 64px)' }}>
          {children}
        </Content>
      </Layout>
    </Layout>
  );
}
