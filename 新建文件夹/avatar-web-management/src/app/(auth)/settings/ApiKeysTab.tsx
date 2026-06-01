'use client';

import { useEffect, useState } from 'react';
import { Card, Table, Tag, Button, message } from 'antd';
import { KeyOutlined } from '@ant-design/icons';
import { useTranslations } from 'next-intl';
import { apiGet, apiPost, apiDelete } from '@/lib/api-client';

interface ApiKeyItem {
  id: string;
  name: string;
  key_prefix: string;
  last_used_at: string | null;
  revoked: number;
}

export default function ApiKeysTab() {
  const t = useTranslations('settings.apiKeys');
  const [keys, setKeys] = useState<ApiKeyItem[]>([]);
  const [loading, setLoading] = useState(false);

  const fetchKeys = async () => {
    setLoading(true);
    const res = await apiGet<ApiKeyItem[]>('/api/settings/api-keys');
    if (res.success) setKeys(res.data);
    setLoading(false);
  };

  useEffect(() => { fetchKeys(); }, []);

  const handleCreate = async () => {
    const name = prompt(t('createPrompt'));
    if (!name) return;
    const res = await apiPost<{ key: string }>('/api/settings/api-keys', { name });
    if (res.success) {
      message.success(t('generated', { key: res.data.key }));
      fetchKeys();
    } else { message.error(res.error || t('createFailed')); }
  };

  const handleRevoke = async (id: string) => {
    const res = await apiDelete(`/api/settings/api-keys/${id}`);
    if (res.success) {
      setKeys(prev => prev.map(k => k.id === id ? { ...k, revoked: 1 } : k));
      message.success(t('revokeSuccess'));
    } else { message.error(res.error || t('operationFailed')); }
  };

  return (
    <Card className="!border-purple-500/10 max-w-2xl">
      <div className="flex items-center justify-between mb-4">
        <span className="text-white font-medium">{t('title')}</span>
        <Button type="primary" icon={<KeyOutlined />} onClick={handleCreate}>{t('generateNew')}</Button>
      </div>
      <Table dataSource={keys} rowKey="id" loading={loading} pagination={false}
        columns={[
          { title: t('name'), dataIndex: 'name', key: 'name' },
          { title: t('prefix'), dataIndex: 'key_prefix', key: 'prefix',
            render: (p: string) => <code className="text-gray-400">{p}***</code> },
          { title: t('lastUsed'), dataIndex: 'last_used_at', key: 'used',
            render: (d: string | null) => d || t('never') },
          { title: t('status'), dataIndex: 'revoked', key: 'status',
            render: (r: number) => <Tag color={r ? 'red' : 'green'}>{r ? t('revoked') : t('active')}</Tag> },
          { title: t('actions'), key: 'actions',
            render: (_: unknown, r: ApiKeyItem) => (
              <Button size="small" danger disabled={!!r.revoked} onClick={() => handleRevoke(r.id)}>{t('revoke')}</Button>
            ),
          },
        ]}
      />
    </Card>
  );
}
