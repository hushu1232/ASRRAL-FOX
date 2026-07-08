// TODO: BEM-migrate
'use client';

import { useEffect, useState, useCallback, useRef } from 'react';
import { Modal, Input, Tag, Empty, Spin } from 'antd';
import { SearchOutlined, FileOutlined, UserOutlined, ShopOutlined } from '@ant-design/icons';
import { useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { apiGet } from '@/lib/api-client';

interface SearchResult {
  avatars: Array<{ id: string; name: string; style: string; thumbnail_url: string | null; status: string }>;
  assets: Array<{ id: string; filename: string; asset_type: string; format: string; file_size: number }>;
  templates: Array<{ id: string; name: string; style: string; thumbnail_url: string | null }>;
}

const typeColors: Record<string, string> = { model: 'blue', texture: 'green', animation: 'orange', vfx: 'red', hdri: 'purple' };

export default function SearchModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  const router = useRouter();
  const t = useTranslations('search');
  const inputRef = useRef<any>(null);
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<SearchResult>({ avatars: [], assets: [], templates: [] });
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (open) {
      setTimeout(() => inputRef.current?.focus(), 100);
      setQuery('');
      setResults({ avatars: [], assets: [], templates: [] });
    }
  }, [open]);

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === 'k') {
        e.preventDefault();
        if (open) onClose(); else onClose();
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [open, onClose]);

  const doSearch = useCallback(async (value: string) => {
    setQuery(value);
    if (value.length < 1) { setResults({ avatars: [], assets: [], templates: [] }); return; }
    setLoading(true);
    const res = await apiGet<SearchResult>('/api/search', { q: value });
    if (res.success) setResults(res.data);
    setLoading(false);
  }, []);

  const totalResults = results.avatars.length + results.assets.length + results.templates.length;

  return (
    <Modal
      open={open}
      onCancel={onClose}
      footer={null}
      closable={false}
      width={560}
      styles={{ body: { padding: 0, background: 'var(--bg-card)', border: '1px solid var(--border-subtle)' } }}
    >
      <Input
        ref={inputRef}
        size="large"
        prefix={<SearchOutlined style={{ color: 'var(--text-muted)' }} />}
        placeholder={t('placeholder')}
        value={query}
        onChange={e => doSearch(e.target.value)}
        variant="borderless"
        className="px-4 py-3"
        style={{ color: 'var(--text-primary)' }}
        aria-label={t('ariaLabel')}
      />
      {query && (
        <div className="max-h-80 overflow-y-auto" style={{ borderTop: '1px solid var(--border-subtle)' }} aria-live="polite">
          {loading ? (
            <div className="flex justify-center py-8"><Spin /></div>
          ) : totalResults === 0 ? (
            <Empty description={t('noResults', { query })} image={Empty.PRESENTED_IMAGE_SIMPLE} className="py-4" />
          ) : (
            <div>
              {results.avatars.length > 0 && (
                <div>
                  <div className="px-4 py-2 text-xs font-medium" style={{ color: 'var(--text-muted)' }}>{t('categories.avatars')}</div>
                  <div>
                    {results.avatars.map(item => (
                      <div className="px-4 py-2 cursor-pointer flex items-center gap-3 hover:bg-[var(--bg-card-hover)]"
                        key={item.id}
                        onClick={() => { router.push(`/avatars/${item.id}`); onClose(); }}
                        onKeyDown={(e) => { if (e.key === 'Enter') { router.push(`/avatars/${item.id}`); onClose(); } }}
                        role="button"
                        tabIndex={0}
                        aria-label={item.name}>
                        <UserOutlined style={{ color: 'var(--text-muted)' }} />
                        <span className="text-sm" style={{ color: 'var(--text-primary)' }}>{item.name}</span>
                        <Tag className="ml-auto text-xs">{item.style}</Tag>
                      </div>
                    ))}
                  </div>
                </div>
              )}
              {results.templates.length > 0 && (
                <div>
                  <div className="px-4 py-2 text-xs font-medium" style={{ color: 'var(--text-muted)' }}>{t('categories.templates')}</div>
                  <div>
                    {results.templates.map(item => (
                      <div className="px-4 py-2 cursor-pointer flex items-center gap-3 hover:bg-[var(--bg-card-hover)]"
                        key={item.id}
                        onClick={() => { router.push('/marketplace'); onClose(); }}
                        onKeyDown={(e) => { if (e.key === 'Enter') { router.push('/marketplace'); onClose(); } }}
                        role="button"
                        tabIndex={0}
                        aria-label={item.name}>
                        <ShopOutlined style={{ color: 'var(--text-muted)' }} />
                        <span className="text-sm" style={{ color: 'var(--text-primary)' }}>{item.name}</span>
                        <Tag className="ml-auto text-xs">{item.style}</Tag>
                      </div>
                    ))}
                  </div>
                </div>
              )}
              {results.assets.length > 0 && (
                <div>
                  <div className="px-4 py-2 text-xs font-medium" style={{ color: 'var(--text-muted)' }}>{t('categories.assets')}</div>
                  <div>
                    {results.assets.map(item => (
                      <div className="px-4 py-2 cursor-pointer flex items-center gap-3 hover:bg-[var(--bg-card-hover)]"
                        key={item.id}
                        onClick={() => { router.push('/assets'); onClose(); }}
                        onKeyDown={(e) => { if (e.key === 'Enter') { router.push('/assets'); onClose(); } }}
                        role="button"
                        tabIndex={0}
                        aria-label={item.filename}>
                        <FileOutlined style={{ color: 'var(--text-muted)' }} />
                        <span className="text-sm" style={{ color: 'var(--text-primary)' }}>{item.filename}</span>
                        <Tag color={typeColors[item.asset_type]} className="ml-auto text-xs">{item.asset_type}</Tag>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </Modal>
  );
}
