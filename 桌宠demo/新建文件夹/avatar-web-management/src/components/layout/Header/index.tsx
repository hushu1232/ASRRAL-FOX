'use client';

import { useState, useEffect } from 'react';
import { Input, Dropdown, Avatar, Badge, Space, Button } from 'antd';
import { SearchOutlined, LogoutOutlined, UserOutlined, MenuOutlined } from '@ant-design/icons';
import { useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { useAuthStore } from '@/stores/authStore';
import { useUIStore } from '@/stores/uiStore';
import NotificationDropdown from '@/components/layout/NotificationDropdown';
import CommandPalette from '@/components/layout/CommandPalette';
import BreadcrumbNav from '@/components/layout/BreadcrumbNav';
import ThemeToggle from '@/components/ui/ThemeToggle';
import './style.scss';

export default function Header() {
  const th = useTranslations('layout.header');
  const router = useRouter();
  const { user, logout, isAuthenticated } = useAuthStore();
  const [searchOpen, setSearchOpen] = useState(false);
  const isMobile = useUIStore((s) => s.isMobile);
  const setMobileMenuOpen = useUIStore((s) => s.setMobileMenuOpen);

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === 'k') {
        e.preventDefault();
        setSearchOpen(true);
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, []);

  const handleLogout = async () => {
    await logout();
    router.push('/login');
  };

  const userMenuItems = [
    { key: 'profile', icon: <UserOutlined />, label: th('profile'), onClick: () => router.push('/settings') },
    { type: 'divider' as const },
    { key: 'logout', icon: <LogoutOutlined />, label: th('logout'), onClick: handleLogout, danger: true },
  ];

  return (
    <header className="header">
      <div className="header__left">
        {isMobile && (
          <Button
            type="text"
            icon={<MenuOutlined />}
            onClick={() => setMobileMenuOpen(true)}
            aria-label={th('menu')}
            className="header__mobile-toggle"
          />
        )}
        <div className="header__breadcrumb">
          <BreadcrumbNav />
        </div>
        <Input
          prefix={<SearchOutlined style={{ color: 'var(--text-muted)' }} />}
          placeholder={`${th('search')} (Ctrl+K)`}
          className="header__search"
          onClick={() => setSearchOpen(true)}
          onKeyDown={(e) => { if (e.key === 'Enter') setSearchOpen(true); }}
          readOnly
          aria-label={th('search')}
          role="searchbox"
        />
        <CommandPalette open={searchOpen} onClose={() => setSearchOpen(false)} />
      </div>

      <div className="header__right">
        {isAuthenticated ? (
          <>
            <NotificationDropdown />
            <ThemeToggle />
            <Dropdown menu={{ items: userMenuItems }} placement="bottomRight">
              <div className="header__user-trigger" role="button" tabIndex={0} aria-label={th('profile')}>
                <Avatar size="small" src={user?.avatar_url} icon={<UserOutlined />} className="header__avatar">
                  {!user?.avatar_url && (user?.username || user?.email || '?')[0]?.toUpperCase()}
                </Avatar>
                <span className="header__username">{user?.username || user?.email}</span>
              </div>
            </Dropdown>
          </>
        ) : (
          <div className="header__guest-actions">
            <ThemeToggle />
            <Button type="primary" size="small" className="header__login-btn" onClick={() => router.push('/login')}>
              {th('login') || 'Login'}
            </Button>
            <Button size="small" className="header__register-btn" onClick={() => router.push('/register')}>
              {th('register') || 'Register'}
            </Button>
          </div>
        )}
      </div>
    </header>
  );
}
