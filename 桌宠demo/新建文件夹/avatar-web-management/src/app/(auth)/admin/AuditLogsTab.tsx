'use client';

import { useState } from 'react';
import { Card, Table, Button } from 'antd';
import { DownloadOutlined } from '@ant-design/icons';
import { useTranslations } from 'next-intl';
import { useApiGet } from '@/lib/use-api';

interface AuditLogItem {
  id: string;
  user_name: string;
  action: string;
  resource_type: string;
  resource_id: string;
  ip_address: string;
  created_at: string;
}

export default function AuditLogsTab() {
  const t = useTranslations('admin.auditLogs');
  const [page, setPage] = useState(1);
  const { data, isLoading } = useApiGet<{ items: AuditLogItem[]; total: number }>(
    '/api/admin/audit-logs',
    { page: String(page), pageSize: '20' },
  );
  const logs = data?.success ? (data.data?.items ?? []) : [];
  const total = data?.success ? (data.data?.total ?? 0) : 0;

  return (
    <Card className="!border-purple-500/10">
      <Table
        dataSource={logs} rowKey="id" loading={isLoading}
        columns={[
          { title: t('user'), dataIndex: 'user_name', key: 'u' },
          { title: t('action'), dataIndex: 'action', key: 'a' },
          { title: t('resourceType'), dataIndex: 'resource_type', key: 'rt' },
          { title: t('resourceId'), dataIndex: 'resource_id', key: 'ri' },
          { title: t('ipAddress'), dataIndex: 'ip_address', key: 'ip' },
          { title: t('time'), dataIndex: 'created_at', key: 't' },
        ]}
        pagination={{ current: page, total, pageSize: 20, onChange: setPage, showTotal: total => t('paginationTotal', { total }) }}
      />
      <Button icon={<DownloadOutlined />} className="mt-3">{t('export')}</Button>
    </Card>
  );
}
