'use client';

import { useEffect } from 'react';
import { Spin } from 'antd';
import Sidebar from '@/components/layout/Sidebar';
import Header from '@/components/layout/Header';
import SkipToMain from '@/components/ui/SkipToMain';
import { useAuthStore } from '@/stores/authStore';
import { useUIStore } from '@/stores/uiStore';
import './style.scss';

export default function AppLayout({ children }: { children: React.ReactNode }) {
  const { isAuthenticated, isLoading, hydrateFromStorage } = useAuthStore();
  const sidebarCollapsed = useUIStore((s) => s.sidebarCollapsed);
  const setIsMobile = useUIStore((s) => s.setIsMobile);

  useEffect(() => { hydrateFromStorage(); }, [hydrateFromStorage]);

  useEffect(() => {
    const check = () => setIsMobile(window.innerWidth < 640);
    check();
    window.addEventListener('resize', check);
    return () => window.removeEventListener('resize', check);
  }, [setIsMobile]);

  if (isLoading) {
    const cls = ['app-layout', 'app-layout--loading'].join(' ');
    return (
      <div className={cls}>
        <Spin size="large" />
      </div>
    );
  }

  const mainCls = [
    'app-layout__main',
    sidebarCollapsed ? 'app-layout__main--sidebar-collapsed' : 'app-layout__main--sidebar-expanded',
  ].join(' ');

  return (
    <div className="app-layout">
      <SkipToMain />
      <div className="app-layout__sidebar-area">
        <Sidebar />
      </div>
      <div className={mainCls}>
        <Header />
        <main id="main-content" className="app-layout__content" role="main">
          {children}
        </main>
      </div>
    </div>
  );
}
