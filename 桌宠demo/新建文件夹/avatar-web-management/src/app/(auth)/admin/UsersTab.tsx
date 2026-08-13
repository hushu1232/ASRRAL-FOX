'use client';

import { useState } from 'react';
import { Card, Table, Tag, Button, Input, Select, Space, Popconfirm, message } from 'antd';
import { SearchOutlined } from '@ant-design/icons';
import { useTranslations } from 'next-intl';
import { apiPut, apiPatch, apiDelete } from '@/lib/api-client';
import { useApiGet } from '@/lib/use-api';

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
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const [role, setRole] = useState('');

  const roleLabels: Record<string, string> = {
    super_admin: t('roles.super_admin'),
    workspace_admin: t('roles.workspace_admin'),
    user: t('roles.user'),
  };

  const params: Record<string, string> = { page: String(page), pageSize: '20' };
  if (search) params.search = search;
  if (role) params.role = role;
  const { data, isLoading, mutate } = useApiGet<{ items: UserItem[]; total: number }>(
    '/api/admin/users',
    params,
  );
  const users = data?.success ? (data.data?.items ?? []) : [];
  const total = data?.success ? (data.data?.total ?? 0) : 0;

  const handleRoleChange = async (userId: string, newRole: string) => {
    const res = await apiPut(`/api/admin/users/${userId}`, { role: newRole });
    if (res.success) {
      void mutate();
      message.success(t('roleChanged'));
    } else { message.error(res.error || t('updateFailed')); }
  };

  const handleBan = async (userId: string, action: 'ban' | 'unban') => {
    const res = await apiPatch(`/api/admin/users/${userId}`, { action });
    if (res.success) {
      void mutate();
      message.success(action === 'ban' ? t('userBanned') : t('userUnbanned'));
    } else {
      message.error(res.error || t('updateFailed'));
    }
  };

  const handleDelete = async (userId: string) => {
    const res = await apiDelete(`/api/admin/users/${userId}`);
    if (res.success) {
      void mutate();
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
        dataSource={users} rowKey="id" loading={isLoading}
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
