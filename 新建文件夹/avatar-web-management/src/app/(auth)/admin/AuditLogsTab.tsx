'use client';

import { useState, useEffect, useCallback } from 'react';
import { Card, Table, Button } from 'antd';
import { DownloadOutlined } from '@ant-design/icons';
import { useTranslations } from 'next-intl';
import { apiGet } from '@/lib/api-client';

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
  const [logs, setLogs] = useState<AuditLogItem[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(false);
  const [page, setPage] = useState(1);

  const fetchLogs = useCallback(async () => {
    setLoading(true);
    const params = new URLSearchParams({ page: String(page), pageSize: '20' });
    const res = await apiGet<{ items: AuditLogItem[]; total: number }>(`/api/admin/audit-logs?${params}`);
    if (res.success) { setLogs(res.data.items); setTotal(res.data.total); }
    setLoading(false);
  }, [page]);

  useEffect(() => { fetchLogs(); }, [fetchLogs]);

  return (
    <Card className="!border-purple-500/10">
      <Table
        dataSource={logs} rowKey="id" loading={loading}
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
