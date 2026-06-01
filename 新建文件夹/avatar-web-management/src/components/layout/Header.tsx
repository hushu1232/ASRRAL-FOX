'use client';

import { useState, useEffect } from 'react';
import { Input, Dropdown, Avatar, Badge, Space, Button } from 'antd';
import { SearchOutlined, LogoutOutlined, UserOutlined, MenuOutlined } from '@ant-design/icons';
import { useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { useAuthStore } from '@/stores/authStore';
import { useUIStore } from '@/stores/uiStore';
import NotificationDropdown from './NotificationDropdown';
import SearchModal from './SearchModal';
import BreadcrumbNav from './BreadcrumbNav';
import ThemeToggle from '@/components/ui/ThemeToggle';

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
    <div className="flex items-center justify-between h-16 px-6" style={{ background: 'var(--bg-card)', borderBottom: '1px solid var(--border-subtle)' }}>
      <div className="flex items-center gap-4 flex-1 max-w-md">
        {isMobile && (
          <Button
            type="text"
            icon={<MenuOutlined />}
            onClick={() => setMobileMenuOpen(true)}
            aria-label={th('menu')}
            style={{ color: 'var(--text-primary)' }}
          />
        )}
        <div className="hidden md:block">
          <BreadcrumbNav />
        </div>
        <Input
          prefix={<SearchOutlined style={{ color: 'var(--text-muted)' }} />}
          placeholder={`${th('search')} (Ctrl+K)`}
          style={{
            background: 'var(--bg-card-hover)',
            borderColor: 'var(--border-subtle)',
            color: 'var(--text-primary)',
          }}
          className="hover:border-[var(--border-subtle)]"
          onClick={() => setSearchOpen(true)}
          onKeyDown={(e) => { if (e.key === 'Enter') setSearchOpen(true); }}
          readOnly
          aria-label={th('search')}
          role="searchbox"
        />
        <SearchModal open={searchOpen} onClose={() => setSearchOpen(false)} />
      </div>

      <Space size="middle">
        {isAuthenticated ? (
          <>
            <NotificationDropdown />
            <ThemeToggle />
            <Dropdown menu={{ items: userMenuItems }} placement="bottomRight">
              <div className="flex items-center gap-2 cursor-pointer" role="button" tabIndex={0} aria-label={th('profile')}>
                <Avatar size="small" src={user?.avatar_url} icon={<UserOutlined />} style={{ backgroundColor: '#d97706' }}>
                  {!user?.avatar_url && (user?.username || user?.email || '?')[0]?.toUpperCase()}
                </Avatar>
                <span className="text-sm hidden sm:inline" style={{ color: 'var(--text-primary)' }}>{user?.username || user?.email}</span>
              </div>
            </Dropdown>
          </>
        ) : (
          <Space size="small">
            <ThemeToggle />
            <Button type="primary" size="small" onClick={() => router.push('/login')}>
              {th('login') || 'Login'}
            </Button>
            <Button size="small" onClick={() => router.push('/register')} style={{ borderColor: 'var(--border-subtle)', color: 'var(--text-primary)' }}>
              {th('register') || 'Register'}
            </Button>
          </Space>
        )}
      </Space>
    </div>
  );
}
