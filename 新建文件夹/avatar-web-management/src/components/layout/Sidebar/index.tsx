'use client';

import { useEffect, useRef } from 'react';
import { Menu, Button, Drawer } from 'antd';
import {
  DashboardOutlined, PictureOutlined, FolderOutlined,
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
import './style.scss';

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

  const GUEST_ALLOWED = ['/marketplace', '/community', '/avatars', '/help'];

  const filteredItems = menuItems.filter((item) => {
    if ('type' in item) return !!user;
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

  const sidebarRef = useRef<HTMLDivElement>(null);
  useEffect(() => { if (sidebarRef.current) sidebarEnter(sidebarRef.current); }, [collapsed]);

  const sizeMod = collapsed ? 'collapsed' : 'expanded';

  const sidebarContent = (
    <>
      {/* Brand */}
      <div className={`sidebar__brand sidebar__brand--${sizeMod}`}>
        {!collapsed ? (
          <>
            <Image
              src="/images/logo.svg"
              alt={t('logoAlt')}
              width={28}
              height={28}
              className="sidebar__logo"
              priority
              unoptimized
            />
            <span className="sidebar__brand-text">{t('brand')}</span>
          </>
        ) : (
          <Image
            src="/images/logo.svg"
            alt={t('logoAlt')}
            width={24}
            height={24}
            className="sidebar__logo sidebar__logo--collapsed"
            priority
            unoptimized
          />
        )}
      </div>

      {/* New Avatar Button */}
      <div className={`sidebar__action sidebar__action--${sizeMod}`}>
        <Button
          type="primary"
          icon={<PlusOutlined />}
          className={`sidebar__new-btn sidebar__new-btn--${sizeMod}`}
          onClick={() => router.push('/avatars')}
          {...(!collapsed ? { block: true } : {})}
        >
          {!collapsed && t('newAvatar')}
        </Button>
      </div>

      {/* Navigation Menu */}
      <Menu
        mode="inline"
        selectedKeys={[selectedKey]}
        items={sidebarItems}
        onClick={({ key }) => router.push(key)}
        onMouseEnter={({ key }) => { if (key) router.prefetch(key); }}
        className="sidebar__menu"
        theme="dark"
      />

      {/* Collapse Toggle */}
      <div className="sidebar__toggle">
        <button
          type="button"
          className="sidebar__toggle-btn"
          onClick={toggleSidebar}
          aria-label={collapsed ? t('expand') : t('collapse')}
        >
          {collapsed ? <MenuUnfoldOutlined /> : <MenuFoldOutlined />}
        </button>
      </div>
    </>
  );

  if (isMobile) {
    return (
      <Drawer
        open={mobileMenuOpen}
        onClose={() => setMobileMenuOpen(false)}
        placement="left"
        width={280}
        className="sidebar--mobile"
        styles={{ body: { padding: 0, background: 'var(--bg-card)' }, header: { display: 'none' } }}
      >
        {sidebarContent}
      </Drawer>
    );
  }

  const sidebarCls = ['sidebar', `sidebar--${sizeMod}`].join(' ');

  return (
    <nav aria-label={t('mainNav')} ref={sidebarRef}>
      <div className={sidebarCls}>
        {sidebarContent}
      </div>
    </nav>
  );
}
