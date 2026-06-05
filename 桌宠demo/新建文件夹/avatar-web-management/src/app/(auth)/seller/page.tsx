'use client';

import { useState } from 'react';
import { Card, Tabs, Table, Button, Tag, App, Spin, Statistic, Row, Col, Modal, Popconfirm, Form, Input, Select, InputNumber } from 'antd';
import { PlusOutlined, EditOutlined, DeleteOutlined, DollarOutlined, DownloadOutlined, FileOutlined } from '@ant-design/icons';
import { useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { useApiGet, useApiPaginated } from '@/lib/use-api';
import { apiDelete, apiPut } from '@/lib/api-client';
import type { PaginatedResponse } from '@/lib/use-api';

interface SellerDashboard {
  totalItems: number;
  approvedItems: number;
  totalDownloads: number;
  totalOrders: number;
  totalRevenue: number;
  monthlyRevenue: number;
  pendingPayout: number;
}

interface SellerItem {
  id: string;
  title: string;
  category: string;
  price: number;
  currency: string;
  status: string;
  rating: number;
  download_count: number;
  order_count: number;
  created_at: string;
}

export default function SellerCenterPage() {
  const { message } = App.useApp();
  const router = useRouter();
  const t = useTranslations('seller.center');
  const tc = useTranslations('seller.center.categories');
  const ts = useTranslations('seller.center.statuses');
  const [activeTab, setActiveTab] = useState('items');
  const [editOpen, setEditOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<SellerItem | null>(null);
  const [editLoading, setEditLoading] = useState(false);
  const [editForm] = Form.useForm();

  const CATEGORY_LABELS: Record<string, string> = {
    model: tc('model'),
    personality: tc('personality'),
    voice: tc('voice'),
    animation: tc('animation'),
    theme: tc('theme'),
  };

  const STATUS_MAP: Record<string, { color: string; label: string }> = {
    pending: { color: 'orange', label: ts('pending') },
    approved: { color: 'green', label: ts('approved') },
    rejected: { color: 'red', label: ts('rejected') },
  };

  const { data: dashData, isLoading: dashLoading } = useApiGet<SellerDashboard>('/api/market/seller/dashboard');
  const dash: SellerDashboard | undefined = dashData?.success ? (dashData.data as unknown as SellerDashboard) : undefined;

  const { data: itemsData, isLoading: itemsLoading, mutate: mutateItems } =
    useApiPaginated<SellerItem>('/api/market/seller/items', { pageSize: '50' });
  const items: SellerItem[] = itemsData?.success
    ? (itemsData.data as unknown as { items: SellerItem[] })?.items || []
    : [];

  const handleDelete = async (id: string) => {
    const res = await apiDelete(`/api/market/items/${id}`);
    if (res.success) {
      message.success(t('delistSuccess'));
      mutateItems();
    } else {
      message.error(res.error || t('delistFailed'));
    }
  };

  const openEdit = (record: SellerItem) => {
    setEditingItem(record);
    editForm.setFieldsValue({
      title: record.title,
      category: record.category,
      price: record.price,
      description: '',
    });
    fetch(`/api/market/items/${record.id}`)
      .then((r) => r.json())
      .then((d) => {
        if (d.success) {
          const detail = d.data;
          let files = detail.files || '';
          let previews = detail.preview_images || '';
          if (Array.isArray(files)) files = files.join('\n');
          else try { files = JSON.parse(files).join('\n'); } catch { /* */ }
          if (Array.isArray(previews)) previews = previews.join('\n');
          else try { previews = JSON.parse(previews).join('\n'); } catch { /* */ }
          editForm.setFieldsValue({
            description: detail.description || '',
            files,
            previewImages: previews,
            thumbnailUrl: detail.thumbnail_url || '',
          });
        }
      })
      .catch(() => {});
    setEditOpen(true);
  };

  const handleEditSubmit = async (values: Record<string, unknown>) => {
    if (!editingItem) return;
    setEditLoading(true);
    try {
      const res = await apiPut(`/api/market/items/${editingItem.id}`, {
        title: values.title,
        description: values.description || '',
        category: values.category,
        price: values.price || 0,
        files: String(values.files || '').split('\n').map((l: string) => l.trim()).filter(Boolean),
        previewImages: String(values.previewImages || '').split('\n').map((l: string) => l.trim()).filter(Boolean),
        thumbnailUrl: values.thumbnailUrl || undefined,
      });
      if (res.success) {
        message.success(t('updateSuccess'));
        setEditOpen(false);
        setEditingItem(null);
        mutateItems();
      } else {
        message.error(res.error || t('updateFailed'));
      }
    } catch {
      message.error(t('networkError'));
    } finally {
      setEditLoading(false);
    }
  };

  const columns = [
    { title: t('item'), dataIndex: 'title', key: 'title', render: (title: string) => <span className="text-white">{title}</span> },
    { title: t('category'), dataIndex: 'category', key: 'category', render: (c: string) => CATEGORY_LABELS[c] || c },
    {
      title: t('price'), dataIndex: 'price', key: 'price',
      render: (p: number, r: SellerItem) => p === 0 ? <span className="text-green-400">{t('free')}</span> : `¥${p}`,
    },
    {
      title: t('status'), dataIndex: 'status', key: 'status',
      render: (s: string) => {
        const info = STATUS_MAP[s] || { color: 'default', label: s };
        return <Tag color={info.color}>{info.label}</Tag>;
      },
    },
    { title: t('downloads'), dataIndex: 'download_count', key: 'download_count' },
    {
      title: t('actions'), key: 'actions',
      render: (_: unknown, record: SellerItem) => (
        <div className="flex gap-2">
          <Button size="small" icon={<EditOutlined />} onClick={() => openEdit(record)}>{t('edit')}</Button>
          <Popconfirm title={t('delistConfirm')} onConfirm={() => handleDelete(record.id)}>
            <Button size="small" danger icon={<DeleteOutlined />}>{t('delist')}</Button>
          </Popconfirm>
        </div>
      ),
    },
  ];

  const tabItems = [
    {
      key: 'items',
      label: t('myItems'),
      children: (
        <div>
          <div className="mb-4">
            <Button type="primary" icon={<PlusOutlined />} onClick={() => router.push('/marketplace/new')}>
              {t('listNewItem')}
            </Button>
          </div>
          <Table
            dataSource={items}
            columns={columns}
            rowKey="id"
            loading={itemsLoading}
            className="[&_.ant-table]:bg-transparent [&_.ant-table-cell]:!border-purple-500/10"
            pagination={false}
          />
        </div>
      ),
    },
    {
      key: 'stats',
      label: t('salesStats'),
      children: dashLoading ? (
        <div className="flex justify-center py-20"><Spin size="large" /></div>
      ) : (
        <div>
          <Row gutter={[16, 16]} className="mb-6">
            <Col xs={12} sm={8} lg={6}>
              <Card className="!border-purple-500/10">
                <Statistic title={t('totalRevenue')} value={dash?.totalRevenue || 0} prefix={<DollarOutlined />} suffix={t('yuan')} />
              </Card>
            </Col>
            <Col xs={12} sm={8} lg={6}>
              <Card className="!border-purple-500/10">
                <Statistic title={t('monthlyRevenue')} value={dash?.monthlyRevenue || 0} prefix={<DollarOutlined />} suffix={t('yuan')} />
              </Card>
            </Col>
            <Col xs={12} sm={8} lg={6}>
              <Card className="!border-purple-500/10">
                <Statistic title={t('totalDownloads')} value={dash?.totalDownloads || 0} prefix={<DownloadOutlined />} />
              </Card>
            </Col>
            <Col xs={12} sm={8} lg={6}>
              <Card className="!border-purple-500/10">
                <Statistic title={t('itemCount')} value={dash?.approvedItems || 0} prefix={<FileOutlined />} suffix={`/ ${dash?.totalItems || 0}`} />
              </Card>
            </Col>
          </Row>
          <Row gutter={[16, 16]}>
            <Col xs={12} sm={8} lg={6}>
              <Card className="!border-purple-500/10">
                <Statistic title={t('totalOrders')} value={dash?.totalOrders || 0} />
              </Card>
            </Col>
            <Col xs={12} sm={8} lg={6}>
              <Card className="!border-purple-500/10">
                <Statistic title={t('pendingPayout')} value={dash?.pendingPayout || 0} prefix={<DollarOutlined />} suffix={t('yuan')} />
              </Card>
            </Col>
          </Row>
        </div>
      ),
    },
  ];

  return (
    <div>
      <h1 className="text-2xl font-bold text-white mb-6">{t('title')}</h1>
      <Tabs activeKey={activeTab} onChange={setActiveTab} items={tabItems} />

      <Modal
        title={t('editTitle')}
        open={editOpen}
        onCancel={() => { setEditOpen(false); setEditingItem(null); }}
        footer={null}
        destroyOnClose
      >
        <Form form={editForm} layout="vertical" onFinish={handleEditSubmit}>
          <Form.Item name="title" label={t('itemName')} rules={[{ required: true }]}>
            <Input maxLength={100} />
          </Form.Item>
          <Form.Item name="category" label={t('categoryLabel')} rules={[{ required: true }]}>
            <Select options={[
              { value: 'model', label: tc('model') },
              { value: 'personality', label: tc('personality') },
              { value: 'voice', label: tc('voice') },
              { value: 'animation', label: tc('animation') },
              { value: 'theme', label: tc('theme') },
            ]} />
          </Form.Item>
          <Form.Item name="description" label={t('description')}>
            <Input.TextArea rows={3} maxLength={2000} />
          </Form.Item>
          <Form.Item name="price" label={t('priceLabel')}>
            <InputNumber min={0} className="w-full" />
          </Form.Item>
          <Form.Item name="thumbnailUrl" label={t('thumbnailUrl')}>
            <Input placeholder="https://..." />
          </Form.Item>
          <Form.Item name="previewImages" label={t('previewImages')}>
            <Input.TextArea rows={2} />
          </Form.Item>
          <Form.Item name="files" label={t('files')}>
            <Input.TextArea rows={2} />
          </Form.Item>
          <Button type="primary" htmlType="submit" loading={editLoading} block className="bg-gradient-to-r from-purple-600 to-blue-600 border-0">
            {t('saveChanges')}
          </Button>
        </Form>
      </Modal>
    </div>
  );
}
