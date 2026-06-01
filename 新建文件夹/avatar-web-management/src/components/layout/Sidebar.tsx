'use client';

import { useEffect, useRef } from 'react';
import { Layout, Menu, Button, Drawer } from 'antd';
import {
  DashboardOutlined, UserOutlined, PictureOutlined, FolderOutlined,
  ShopOutlined, SettingOutlined, SafetyOutlined, ApiOutlined, DollarOutlined,
  QuestionCircleOutlined, MenuFoldOutlined, MenuUnfoldOutlined,
  PlusOutlined, RobotOutlined, ShoppingCartOutlined, BellOutlined,
  TeamOutlined, MessageOutlined,
} from '@ant-design/icons';
import { useRouter, usePathname } from 'next/navigation';
import Image from 'next/image';
import { useTranslations } from 'next-intl';
import { useAuthStore } from '@/stores/authStore';
import { useUIStore } from '@/stores/uiStore';
import { sidebarEnter } from '@/lib/motion';

const { Sider } = Layout;

export default function Sidebar() {
  const t = useTranslations('layout.sidebar');
  const collapsed = useUIStore((s) => s.sidebarCollapsed);
  const toggleSidebar = useUIStore((s) => s.toggleSidebar);
  const router = useRouter();
  const pathname = usePathname();
  const user = useAuthStore((s) => s.user);
  const isMobile = useUIStore((s) => s.isMobile);
  const mobileMenuOpen = useUIStore((s) => s.mobileMenuOpen);
  const setMobileMenuOpen = useUIStore((s) => s.setMobileMenuOpen);

  const menuItems = [
    { key: '/dashboard', icon: <DashboardOutlined />, label: t('dashboard') },
    { key: '/dashboard/pet', icon: <RobotOutlined />, label: t('pet') },
    { key: '/avatars', icon: <PictureOutlined />, label: t('avatars') },
    { key: '/assets', icon: <FolderOutlined />, label: t('assets') },
    { key: '/marketplace', icon: <ShopOutlined />, label: t('marketplace') },
    { key: '/community', icon: <TeamOutlined />, label: t('community') },
    { key: '/purchases', icon: <ShoppingCartOutlined />, label: t('myPurchases') },
    { key: '/messages', icon: <MessageOutlined />, label: t('messages') },
    { key: '/notifications', icon: <BellOutlined />, label: t('notifications') },
    { key: '/seller', icon: <DollarOutlined />, label: t('sellerCenter'), role: 'workspace_admin' },
    { key: '/settings', icon: <SettingOutlined />, label: t('settings') },
    { type: 'divider' as const },
    { key: '/admin', icon: <SafetyOutlined />, label: t('admin'), role: 'admin' },
    { key: '/api-docs', icon: <ApiOutlined />, label: t('apiDocs'), role: 'workspace_admin' },
    { key: '/help', icon: <QuestionCircleOutlined />, label: t('help') },
  ];

  // Guest mode: only show public-browsing items
  const GUEST_ALLOWED = ['/marketplace', '/community', '/avatars', '/help'];

  const filteredItems = menuItems.filter((item) => {
    if ('type' in item) return !!user; // show divider only for logged-in users
    if ('role' in item && item.role) {
      if (!user) return false;
      if (item.role === 'admin' && user.role !== 'super_admin') return false;
      if (item.role === 'workspace_admin' && user.role !== 'super_admin' && user.role !== 'workspace_admin') return false;
    }
    if (!user && !GUEST_ALLOWED.includes(item.key)) return false;
    return true;
  });

  const selectedKey = menuItems.find(item => {
    if ('type' in item) return false;
    return pathname.startsWith(item.key);
  })?.key || pathname;

  const sidebarItems = filteredItems.map((item) => {
    if ('type' in item && item.type === 'divider') return { type: 'divider' as const };
    return { key: item.key, icon: item.icon, label: item.label };
  });

  // GSAP staggered entrance
  const sidebarRef = useRef<HTMLDivElement>(null);
  useEffect(() => { if (sidebarRef.current) sidebarEnter(sidebarRef.current); }, [collapsed]);

  const sidebarContent = (
    <>
      <div className={`flex items-center gap-3 ${collapsed ? 'justify-center px-2' : 'px-5'} h-16`} style={{ borderBottom: '1px solid var(--border-subtle)' }}>
        {!collapsed && (
          <>
            <Image src="/images/logo.svg" alt={t('logoAlt')} width={28} height={28} className="shrink-0" priority unoptimized />
            <span className="text-sm font-bold whitespace-nowrap" style={{ color: 'var(--text-primary)' }}>{t('brand')}</span>
          </>
        )}
        {collapsed && <Image src="/images/logo.svg" alt={t('logoAlt')} width={24} height={24} priority unoptimized />}
      </div>

      <div className="py-3 px-3" style={collapsed ? { display: 'flex', justifyContent: 'center' } : {}}>
        <Button
          type="primary"
          icon={<PlusOutlined />}
          block={!collapsed}
          onClick={() => router.push('/avatars')}
          style={{ background: 'linear-gradient(90deg, var(--accent), var(--info))', border: 'none', height: 36, fontWeight: 500 }}
        >
          {!collapsed && t('newAvatar')}
        </Button>
      </div>

      <Menu
        mode="inline"
        selectedKeys={[selectedKey]}
        items={sidebarItems}
        onClick={({ key }) => router.push(key)}
        onMouseEnter={({ key }) => { if (key) router.prefetch(key); }}
        style={{
          background: 'transparent',
          borderInlineEnd: 'none',
          marginTop: 4,
        }}
        theme="dark"
      />

      <div className="absolute bottom-4 left-0 right-0 px-3">
        <Button
          type="text"
          icon={collapsed ? <MenuUnfoldOutlined /> : <MenuFoldOutlined />}
          onClick={toggleSidebar}
          block
          style={{ color: 'var(--text-muted)' }}
          aria-label={collapsed ? t('expand') : t('collapse')}
        />
      </div>
    </>
  );

  // Mobile: show Drawer
  if (isMobile) {
    return (
      <Drawer
        open={mobileMenuOpen}
        onClose={() => setMobileMenuOpen(false)}
        placement="left"
        width={280}
        styles={{ body: { padding: 0, background: 'var(--bg-card)' }, header: { display: 'none' } }}
      >
        {sidebarContent}
      </Drawer>
    );
  }

  // Desktop: show fixed Sider
  return (
    <nav aria-label={t('mainNav')}>
      <div ref={sidebarRef}>
        <Sider
          trigger={null}
          collapsible
          collapsed={collapsed}
          width={220}
          collapsedWidth={64}
          style={{
            background: 'var(--bg-card)',
            borderRight: '1px solid var(--border-subtle)',
            height: '100vh',
            position: 'fixed',
            left: 0,
            top: 0,
            zIndex: 100,
          }}
        >
          {sidebarContent}
        </Sider>
      </div>
    </nav>
  );
}
