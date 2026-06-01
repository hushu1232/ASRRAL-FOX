'use client';

import { useState, useEffect, useCallback } from 'react';
import { Card, Table, Tag, Button, Input, Select, Space, Popconfirm, message } from 'antd';
import { SearchOutlined } from '@ant-design/icons';
import { useTranslations } from 'next-intl';
import { apiGet, apiPut, apiDelete } from '@/lib/api-client';
import { useAuthStore } from '@/stores/authStore';

interface UserItem {
  id: string;
  username: string;
  email: string;
  role: string;
  status: string;
  last_login_at: string | null;
  created_at: string;
}

export default function UsersTab() {
  const t = useTranslations('admin.users');
  const [users, setUsers] = useState<UserItem[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(false);
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const [role, setRole] = useState('');
  const [status, setStatus] = useState('');

  const roleLabels: Record<string, string> = {
    super_admin: t('roles.super_admin'),
    workspace_admin: t('roles.workspace_admin'),
    user: t('roles.user'),
  };

  const fetchUsers = useCallback(async () => {
    setLoading(true);
    const params = new URLSearchParams({ page: String(page), pageSize: '20' });
    if (search) params.set('search', search);
    if (role) params.set('role', role);
    if (status) params.set('status', status);
    const res = await apiGet<{ items: UserItem[]; total: number }>(`/api/admin/users?${params}`);
    if (res.success) { setUsers(res.data.items); setTotal(res.data.total); }
    setLoading(false);
  }, [page, search, role, status]);

  // Fetch on mount and when params change
  useEffect(() => { fetchUsers(); }, [fetchUsers]);

  // Re-fetch on tab visibility change (route switch back)
  useEffect(() => {
    const handleVisibility = () => {
      if (document.visibilityState === 'visible') {
        fetchUsers();
      }
    };
    document.addEventListener('visibilitychange', handleVisibility);
    return () => document.removeEventListener('visibilitychange', handleVisibility);
  }, [fetchUsers]);

  const handleRoleChange = async (userId: string, newRole: string) => {
    const res = await apiPut(`/api/admin/users/${userId}`, { role: newRole });
    if (res.success) {
      setUsers(prev => prev.map(u => u.id === userId ? { ...u, role: newRole } : u));
      message.success(t('roleChanged'));
    } else { message.error(res.error || t('updateFailed')); }
  };

  const handleBan = async (userId: string, action: 'ban' | 'unban') => {
    const token = useAuthStore.getState().accessToken;
    const raw = await fetch(`/api/admin/users/${userId}`, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`,
        'X-CSRF-Token': document.cookie.match(/(?:^|;\s*)XSRF-TOKEN=([^;]*)/)?.[1] || '',
      },
      body: JSON.stringify({ action }),
    });
    const data = await raw.json();
    if (data.success) {
      const newStatus = action === 'ban' ? 'suspended' : 'active';
      setUsers(prev => prev.map(u => u.id === userId ? { ...u, status: newStatus } : u));
      message.success(action === 'ban' ? t('userBanned') : t('userUnbanned'));
    } else {
      message.error(data.error || t('updateFailed'));
    }
  };

  const handleDelete = async (userId: string) => {
    const res = await apiDelete(`/api/admin/users/${userId}`);
    if (res.success) {
      setUsers(prev => prev.filter(u => u.id !== userId));
      message.success(t('userDeleted'));
    } else { message.error(res.error || t('updateFailed')); }
  };

  return (
    <Card className="!border-purple-500/10">
      <div className="flex gap-4 mb-4">
        <Input prefix={<SearchOutlined />} placeholder={t('search')} style={{ width: 240 }}
          value={search} onChange={e => { setSearch(e.target.value); setPage(1); }} />
        <Select placeholder={t('roleFilter')} allowClear style={{ width: 140 }}
          value={role || undefined} onChange={v => { setRole(v || ''); setPage(1); }}
          options={Object.entries(roleLabels).map(([k, v]) => ({ value: k, label: v }))} />
      </div>
      <Table
        dataSource={users} rowKey="id" loading={loading}
        columns={[
          { title: t('username'), dataIndex: 'username', key: 'un' },
          { title: t('email'), dataIndex: 'email', key: 'em' },
          { title: t('role'), dataIndex: 'role', key: 'role',
            render: (r: string, record: UserItem) => (
              <Select size="small" value={r} style={{ width: 100 }}
                onChange={v => handleRoleChange(record.id, v)}
                options={Object.entries(roleLabels).map(([k, v]) => ({ value: k, label: v }))} />
            ),
          },
          { title: t('status'), dataIndex: 'status', key: 'status',
            render: (s: string) => (
              <Tag color={s === 'active' ? 'green' : s === 'suspended' ? 'red' : s === 'deleted' ? 'default' : 'blue'}>
                {s === 'active' ? t('statusActive') : s === 'suspended' ? t('statusSuspended') : s}
              </Tag>
            ),
          },
          { title: t('registeredAt'), dataIndex: 'created_at', key: 'ca' },
          { title: t('actions'), key: 'actions',
            render: (_: unknown, record: UserItem) => (
              <Space>
                {record.status === 'suspended' ? (
                  <Popconfirm title={t('unbanConfirm')} onConfirm={() => handleBan(record.id, 'unban')}>
                    <Button size="small">{t('unban')}</Button>
                  </Popconfirm>
                ) : (
                  <Popconfirm title={t('banConfirm')} onConfirm={() => handleBan(record.id, 'ban')}>
                    <Button size="small" danger>{t('ban')}</Button>
                  </Popconfirm>
                )}
                <Popconfirm title={t('deleteConfirm')} onConfirm={() => handleDelete(record.id)}>
                  <Button size="small" danger type="text">{t('delete')}</Button>
                </Popconfirm>
              </Space>
            ),
          },
        ]}
        pagination={{ current: page, total, pageSize: 20, onChange: setPage, showTotal: total => t('paginationTotal', { total }) }}
      />
    </Card>
  );
}
