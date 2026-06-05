'use client';

import { useEffect, useState, useCallback, useRef, useMemo } from 'react';
import { Input, Spin } from 'antd';
import {
  SearchOutlined,
  DashboardOutlined,
  PictureOutlined,
  FolderOutlined,
  ShopOutlined,
  SettingOutlined,
  RobotOutlined,
  TeamOutlined,
  MessageOutlined,
  ThunderboltOutlined,
  QuestionCircleOutlined,
  FileOutlined,
} from '@ant-design/icons';
import { useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { apiGet } from '@/lib/api-client';

// ─── Types ─────────────────────────────────────────────────────

interface SearchResult {
  avatars: Array<{ id: string; name: string; style: string }>;
  assets: Array<{ id: string; filename: string; asset_type: string }>;
  templates: Array<{ id: string; name: string; style: string }>;
}

interface QuickAction {
  id: string;
  label: string;
  icon: React.ReactNode;
  category: string;
  action: () => void;
}

// ─── Constants ─────────────────────────────────────────────────

const ASSET_TYPE_COLORS: Record<string, string> = {
  model: 'blue', texture: 'green', animation: 'orange', vfx: 'red', hdri: 'purple',
};

// ─── Component ─────────────────────────────────────────────────

export default function CommandPalette({ open, onClose }: { open: boolean; onClose: () => void }) {
  const router = useRouter();
  const t = useTranslations('search');
  const inputRef = useRef<any>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<SearchResult>({ avatars: [], assets: [], templates: [] });
  const [loading, setLoading] = useState(false);
  const [selectedIndex, setSelectedIndex] = useState(0);

  // Quick actions (always available, no query needed)
  const quickActions: QuickAction[] = useMemo(() => [
    { id: 'dashboard', label: t('categories.avatars') ? '工作台' : 'Dashboard', icon: <DashboardOutlined />, category: '导航', action: () => { router.push('/dashboard'); onClose(); } },
    { id: 'avatars', label: '形象管理', icon: <PictureOutlined />, category: '导航', action: () => { router.push('/avatars'); onClose(); } },
    { id: 'assets', label: '资产库', icon: <FolderOutlined />, category: '导航', action: () => { router.push('/assets'); onClose(); } },
    { id: 'marketplace', label: '模型市场', icon: <ShopOutlined />, category: '导航', action: () => { router.push('/marketplace'); onClose(); } },
    { id: 'pet', label: '桌宠设置', icon: <RobotOutlined />, category: '导航', action: () => { router.push('/dashboard/pet'); onClose(); } },
    { id: 'community', label: '社区', icon: <TeamOutlined />, category: '导航', action: () => { router.push('/community'); onClose(); } },
    { id: 'settings', label: '设置', icon: <SettingOutlined />, category: '导航', action: () => { router.push('/settings'); onClose(); } },
    { id: 'help', label: '帮助', icon: <QuestionCircleOutlined />, category: '导航', action: () => { router.push('/help'); onClose(); } },
  ], [router, onClose, t]);

  // Search results + quick actions combined for keyboard navigation
  const searchHits = [
    ...results.avatars.map((a) => ({ id: `avatar-${a.id}`, label: a.name, sub: a.style, icon: <PictureOutlined />, action: () => { router.push(`/avatars/${a.id}`); onClose(); } })),
    ...results.templates.map((t) => ({ id: `template-${t.id}`, label: t.name, sub: t.style, icon: <ShopOutlined />, action: () => { router.push('/marketplace'); onClose(); } })),
    ...results.assets.map((a) => ({ id: `asset-${a.id}`, label: a.filename, sub: a.asset_type, icon: <FileOutlined />, action: () => { router.push('/assets'); onClose(); } })),
  ];

  const activeItems = query.length >= 1 ? searchHits : quickActions;
  const safeIndex = Math.min(selectedIndex, Math.max(0, activeItems.length - 1));

  // Focus input on open
  useEffect(() => {
    if (open) {
      setTimeout(() => inputRef.current?.focus(), 50);
      setQuery('');
      setResults({ avatars: [], assets: [], templates: [] });
      setSelectedIndex(0);
    }
  }, [open]);

  // Debounced search
  useEffect(() => {
    if (query.length < 1) {
      setResults({ avatars: [], assets: [], templates: [] });
      setSelectedIndex(0);
      return;
    }
    setLoading(true);
    const timer = setTimeout(async () => {
      const res = await apiGet<SearchResult>('/api/search', { q: query });
      if (res.success) setResults(res.data);
      setLoading(false);
      setSelectedIndex(0);
    }, 150);
    return () => clearTimeout(timer);
  }, [query]);

  // Close on Escape
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    if (open) window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [open, onClose]);

  // Click outside to close
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        onClose();
      }
    };
    if (open) document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [open, onClose]);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setSelectedIndex((prev) => Math.min(prev + 1, activeItems.length - 1));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setSelectedIndex((prev) => Math.max(prev - 1, 0));
    } else if (e.key === 'Enter' && activeItems[safeIndex]) {
      e.preventDefault();
      activeItems[safeIndex].action();
    }
  };

  if (!open) return null;

  const totalResults = results.avatars.length + results.assets.length + results.templates.length;
  const showSearchResults = query.length >= 1;
  const displayItems = showSearchResults ? searchHits : quickActions;
  const hasItems = displayItems.length > 0;

  return (
    <div
      className="fixed inset-0 z-[9999] flex items-start justify-center pt-[15vh]"
      style={{ background: 'rgba(0, 0, 0, 0.35)', backdropFilter: 'blur(2px)' }}
    >
      <div
        ref={containerRef}
        className="w-full max-w-lg rounded-xl overflow-hidden"
        style={{
          background: 'var(--bg-card)',
          border: '1px solid var(--border-subtle)',
          boxShadow: '0 16px 48px rgba(0,0,0,0.15)',
        }}
      >
        {/* Search input */}
        <Input
          ref={inputRef}
          size="large"
          prefix={<SearchOutlined style={{ color: 'var(--text-muted)' }} />}
          placeholder={t('placeholder')}
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onKeyDown={handleKeyDown}
          variant="borderless"
          className="px-4 py-3 text-base"
          style={{ color: 'var(--text-primary)', background: 'transparent' }}
          aria-label={t('ariaLabel')}
        />

        {/* Results */}
        {loading ? (
          <div className="flex justify-center py-6 border-t" style={{ borderColor: 'var(--border-subtle)' }}>
            <Spin size="small" />
          </div>
        ) : showSearchResults && totalResults === 0 ? (
          <div className="py-8 text-center text-sm border-t" style={{ color: 'var(--text-muted)', borderColor: 'var(--border-subtle)' }}>
            {t('noResults', { query })}
          </div>
        ) : hasItems ? (
          <div
            className="max-h-72 overflow-y-auto border-t"
            style={{ borderColor: 'var(--border-subtle)' }}
            role="listbox"
          >
            {showSearchResults && (
              <div className="px-4 py-1.5 text-[11px] font-semibold uppercase tracking-wider" style={{ color: 'var(--text-muted)' }}>
                {totalResults} 个结果
              </div>
            )}
            {!showSearchResults && (
              <div className="px-4 py-1.5 text-[11px] font-semibold uppercase tracking-wider" style={{ color: 'var(--text-muted)' }}>
                快速导航
              </div>
            )}
            {displayItems.map((item, i) => (
              <div
                key={item.id}
                role="option"
                aria-selected={i === safeIndex}
                className="flex items-center gap-3 px-4 py-2.5 cursor-pointer transition-colors"
                style={{
                  background: i === safeIndex ? 'var(--bg-card-hover)' : 'transparent',
                  color: 'var(--text-primary)',
                }}
                onClick={item.action}
                onMouseEnter={() => setSelectedIndex(i)}
              >
                <span className="text-base shrink-0" style={{ color: 'var(--text-muted)' }}>
                  {item.icon}
                </span>
                <span className="text-sm font-medium truncate">{item.label}</span>
                {'sub' in item && item.sub && (
                  <span className="ml-auto text-xs shrink-0" style={{ color: 'var(--text-muted)' }}>
                    {item.sub}
                  </span>
                )}
              </div>
            ))}
          </div>
        ) : null}

        {/* Footer hint */}
        <div
          className="flex items-center gap-4 px-4 py-2 text-[11px] border-t"
          style={{ color: 'var(--text-muted)', borderColor: 'var(--border-subtle)' }}
        >
          <span>↑↓ 导航</span>
          <span>↵ 选择</span>
          <span>Esc 关闭</span>
        </div>
      </div>
    </div>
  );
}
