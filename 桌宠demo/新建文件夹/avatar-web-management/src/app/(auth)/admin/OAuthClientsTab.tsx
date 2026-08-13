'use client';

import { useState } from 'react';
import { Card, Table, Button, Modal, Form, Input, Select, Switch, Tag, App, Space, Popconfirm } from 'antd';
import { PlusOutlined, CopyOutlined, DeleteOutlined, EyeOutlined } from '@ant-design/icons';
import { useTranslations } from 'next-intl';
import { apiDelete, apiPost } from '@/lib/api-client';
import { useApiGet } from '@/lib/use-api';

interface OAuthClientRecord {
  id: string;
  name: string;
  clientId: string;
  redirectUris: string[];
  scopes: string[];
  grantTypes: string[];
  isPublic: boolean;
}

export default function OAuthClientsTab() {
  const t = useTranslations('admin.oauth');
  const { message } = App.useApp();
  const [modalOpen, setModalOpen] = useState(false);
  const [secretMap, setSecretMap] = useState<Record<string, string>>({});
  const [form] = Form.useForm();
  const { data, isLoading, mutate } = useApiGet<OAuthClientRecord[]>('/api/admin/oauth-clients');
  const clients = data?.success ? (data.data ?? []) : [];

  const handleCreate = async () => {
    try {
      const values = await form.validateFields();
      const res = await apiPost<OAuthClientRecord & { clientSecret: string }>('/api/admin/oauth-clients', values);
      if (res.success) {
        message.success(t('createSuccess'));
        setSecretMap((prev) => ({ ...prev, [res.data.id]: res.data.clientSecret }));
        setModalOpen(false);
        form.resetFields();
        void mutate();
      } else {
        message.error(res.error || t('createFailed'));
      }
    } catch { /* form validation error */ }
  };

  const handleRevoke = async (id: string) => {
    try {
      const res = await apiDelete(`/api/admin/oauth-clients/${id}`);
      if (res.success) {
        message.success(t('revokeSuccess'));
        void mutate();
      } else {
        message.error(res.error || t('revokeFailed'));
      }
    } catch {
      message.error(t('requestFailed'));
    }
  };

  const columns = [
    { title: t('name'), dataIndex: 'name', key: 'name' },
    {
      title: 'Client ID', dataIndex: 'clientId', key: 'clientId',
      render: (v: string) => (
        <Space>
          <code className="text-blue-300 text-xs">{v}</code>
          <CopyOutlined className="text-gray-500 cursor-pointer hover:text-gray-300" onClick={() => { navigator.clipboard.writeText(v); message.success(t('copied')); }} />
        </Space>
      ),
    },
    {
      title: t('callbackUrl'), dataIndex: 'redirectUris', key: 'redirectUris',
      render: (uris: string[]) => uris.map((u, i) => <Tag key={i} className="text-xs mb-1">{u}</Tag>),
    },
    {
      title: t('scopes'), dataIndex: 'scopes', key: 'scopes',
      render: (scopes: string[]) => scopes.map((s) => <Tag key={s} color="blue" className="text-xs">{s}</Tag>),
    },
    {
      title: t('type'), dataIndex: 'isPublic', key: 'isPublic',
      render: (v: boolean) => v ? <Tag color="orange">{t('public')}</Tag> : <Tag color="green">{t('confidential')}</Tag>,
    },
    {
      title: t('actions'), key: 'actions',
      render: (_: unknown, record: OAuthClientRecord) => (
        <Space>
          {secretMap[record.id] && (
            <Button size="small" type="link" icon={<EyeOutlined />}
              onClick={() => {
                message.info(`Client Secret: ${secretMap[record.id]}`);
                navigator.clipboard.writeText(secretMap[record.id]);
              }}>
              {t('secret')}
            </Button>
          )}
          <Popconfirm title={t('revokeConfirm')} onConfirm={() => handleRevoke(record.id)}>
            <Button size="small" danger icon={<DeleteOutlined />}>{t('revoke')}</Button>
          </Popconfirm>
        </Space>
      ),
    },
  ];

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <p className="text-gray-400 text-sm">{t('description')}</p>
        <Button type="primary" icon={<PlusOutlined />} onClick={() => setModalOpen(true)}>{t('newClient')}</Button>
      </div>

      <Card className="!border-purple-500/10">
        <Table
          dataSource={clients}
          columns={columns}
          rowKey="id"
          loading={isLoading}
          pagination={false}
          locale={{ emptyText: t('noClients') }}
        />
      </Card>

      <Modal
        title={t('modal.title')}
        open={modalOpen}
        onCancel={() => setModalOpen(false)}
        onOk={handleCreate}
        okText={t('modal.create')}
      >
        <Form form={form} layout="vertical" initialValues={{ scopes: ['openid', 'profile', 'email'], grant_types: ['authorization_code'], is_public: false }}>
          <Form.Item name="name" label={t('modal.appName')} rules={[{ required: true }]}>
            <Input placeholder={t('modal.appNamePlaceholder')} />
          </Form.Item>
          <Form.Item name="redirect_uris" label={t('modal.callbackUrl')} rules={[{ required: true }]}
            extra={t('modal.callbackExtra')}>
            <Select mode="tags" placeholder="https://example.com/callback" />
          </Form.Item>
          <Form.Item name="scopes" label={t('modal.scopes')}>
            <Select mode="multiple" options={[
              { value: 'openid', label: 'openid - 用户标识' },
              { value: 'profile', label: 'profile - 个人资料' },
              { value: 'email', label: 'email - 邮箱' },
            ]} />
          </Form.Item>
          <Form.Item name="is_public" label={t('modal.publicClient')} valuePropName="checked">
            <Switch />
          </Form.Item>
        </Form>
      </Modal>
    </div>
  );
}
