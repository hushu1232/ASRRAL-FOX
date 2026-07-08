'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { Card, Button, Input, Select, Table, Tag, Tree, App, Pagination, Tooltip } from 'antd';
import { UploadOutlined, AppstoreOutlined, UnorderedListOutlined, FolderOutlined, FileOutlined, SearchOutlined, ShopOutlined } from '@ant-design/icons';
import { useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';
import Image from 'next/image';
import PageHeader from '@/components/layout/PageHeader';
import OperationPanel from '@/components/ui/OperationPanel';
import EmptyState from '@/components/ui/EmptyState';
import LoadingState from '@/components/ui/LoadingState';
import { apiGet } from '@/lib/api-client';
import { useAuthStore } from '@/stores/authStore';
import type { PaginatedResponse } from '@/lib/api-client';

interface AssetItem {
  id: string;
  filename: string;
  asset_type: string;
  format: string;
  file_size: number;
  status: string;
  storage_path: string;
  created_at: string;
}

const assetTypeColors: Record<string, string> = { model: 'blue', texture: 'green', animation: 'orange', vfx: 'red', hdri: 'purple' };

const ALLOWED_EXTENSIONS = ['.glb', '.gltf', '.png', '.jpg', '.jpeg', '.hdr', '.exr', '.fbx', '.blend', '.obj', '.mtl', '.mp4'];
const MAX_SIZE = 500 * 1024 * 1024;

export default function AssetLibraryPage() {
  const t = useTranslations('assets');
  const { message } = App.useApp();
  const router = useRouter();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');
  const [search, setSearch] = useState('');
  const [typeFilter, setTypeFilter] = useState('');
  const [assets, setAssets] = useState<AssetItem[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const pageSize = 24;

  const assetTypeLabels: Record<string, string> = {
    model: t('types.model'),
    texture: t('types.texture'),
    animation: t('types.animation'),
    vfx: t('types.vfx'),
    hdri: t('types.hdri'),
  };

  const fetchAssets = useCallback(async () => {
    setLoading(true);
    try {
      const params: Record<string, string> = { page: String(page), pageSize: String(pageSize) };
      if (search) params.search = search;
      if (typeFilter) params.type = typeFilter;

      const res = await apiGet<PaginatedResponse<AssetItem>>('/api/assets', params);
      if (res.success && res.data) {
        setAssets(res.data.items);
        setTotal(res.data.total);
      } else {
        message.error(res.error || t('upload.loadFailed'));
      }
    } catch {
      message.error(t('upload.networkError'));
    } finally {
      setLoading(false);
    }
  }, [page, search, typeFilter, message, t]);

  useEffect(() => {
    fetchAssets();
  }, [fetchAssets]);

  const handleUploadClick = () => {
    fileInputRef.current?.click();
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const ext = '.' + file.name.split('.').pop()?.toLowerCase();
    if (!ALLOWED_EXTENSIONS.includes(ext)) {
      message.error(t('upload.unsupportedFormat', { ext }));
      if (fileInputRef.current) fileInputRef.current.value = '';
      return;
    }

    if (file.size > MAX_SIZE) {
      message.error(t('upload.fileTooLarge'));
      if (fileInputRef.current) fileInputRef.current.value = '';
      return;
    }

    setUploading(true);
    setUploadProgress(0);

    const formData = new FormData();
    formData.append('file', file);

    const token = useAuthStore.getState().accessToken;
    try {
      const res = await fetch('/api/assets/upload', {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
        body: formData,
      });

      const data = await res.json();
      if (data.success) {
        message.success(t('upload.uploadSuccess', { name: file.name }));
        fetchAssets();
      } else {
        message.error(data.error || t('upload.uploadFailed'));
      }
    } catch {
      message.error(t('upload.uploadRequestFailed'));
    } finally {
      setUploading(false);
      setUploadProgress(0);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const columns = [
    { title: t('upload.fileName'), dataIndex: 'filename', key: 'name', render: (n: string) => <span><FileOutlined className="mr-2 text-gray-400" />{n}</span> },
    { title: t('upload.type'), dataIndex: 'asset_type', key: 'type', render: (val: string) => <Tag color={assetTypeColors[val]}>{assetTypeLabels[val] || val}</Tag> },
    { title: t('upload.format'), dataIndex: 'format', key: 'fmt', render: (f: string) => <span className="text-xs text-gray-400 uppercase">{f}</span> },
    { title: t('upload.size'), dataIndex: 'file_size', key: 'size', render: (s: number) => s > 0 ? (s / 1024 / 1024).toFixed(1) + ' MB' : '-' },
    { title: t('upload.date'), dataIndex: 'created_at', key: 'date' },
    { title: t('upload.actions'), key: 'action', render: (_: unknown, record: AssetItem) => (
      <Tooltip title={t('upload.sellOnMarket')}>
        <Button
          type="text"
          size="small"
          icon={<ShopOutlined />}
          onClick={() => router.push(`/marketplace/new?from=asset&assetId=${record.id}&filename=${encodeURIComponent(record.filename)}&storagePath=${encodeURIComponent(record.storage_path)}`)}
          aria-label={t('upload.sellOnMarket')}
        />
      </Tooltip>
    ) },
  ];

  return (
    <div>
      <PageHeader
        title={t('title')}
        actions={
          <>
            <input
              ref={fileInputRef}
              type="file"
              accept=".glb,.gltf,.png,.jpg,.jpeg,.hdr,.exr,.fbx,.blend,.obj,.mtl,.mp4"
              className="hidden"
              onChange={handleFileChange}
            />
            <Button type="primary" icon={<UploadOutlined />} onClick={handleUploadClick} loading={uploading}>
              {t('uploadButton')}
            </Button>
          </>
        }
      />

      <div className="flex flex-col gap-4 lg:flex-row">
        <OperationPanel
          data-testid="asset-directory-panel"
          className="w-full lg:w-56 lg:shrink-0"
          title={t('upload.directory')}
        >
          <Tree
            treeData={[
              { title: t('upload.allAssets'), key: 'all', icon: <FolderOutlined /> },
              { title: assetTypeLabels.model, key: 'models', icon: <FolderOutlined />, children: [
                { title: t('upload.characters'), key: 'characters', icon: <FileOutlined /> },
                { title: t('upload.parts'), key: 'parts', icon: <FileOutlined /> },
              ]},
              { title: assetTypeLabels.texture, key: 'textures', icon: <FolderOutlined /> },
              { title: assetTypeLabels.animation, key: 'animations', icon: <FolderOutlined /> },
              { title: assetTypeLabels.hdri, key: 'hdri', icon: <FolderOutlined /> },
            ]}
            defaultExpandAll
          />
        </OperationPanel>

        <div className="min-w-0 flex-1">
          <OperationPanel data-testid="asset-filter-panel" className="mb-4" title={null}>
            <div className="flex min-w-0 flex-wrap items-center gap-3">
              <Input
                prefix={<SearchOutlined />}
                placeholder={t('upload.searchFiles')}
                value={search}
                onChange={e => { setSearch(e.target.value); setPage(1); }}
                className="w-full sm:w-64"
              />
              <Select
                placeholder={t('upload.typeFilter')}
                value={typeFilter || undefined}
                onChange={(v) => { setTypeFilter(v || ''); setPage(1); }}
                allowClear
                className="w-full sm:w-40"
                options={Object.entries(assetTypeLabels).map(([k, v]) => ({ value: k, label: v }))}
              />
              <div className="flex gap-1 rounded-lg border border-[var(--border-subtle)] p-0.5">
                <Tooltip title={t('upload.gridView')}>
                  <Button
                    type={viewMode === 'grid' ? 'primary' : 'text'}
                    size="small"
                    icon={<AppstoreOutlined />}
                    onClick={() => setViewMode('grid')}
                    aria-label={t('upload.gridView')}
                  />
                </Tooltip>
                <Tooltip title={t('upload.listView')}>
                  <Button
                    type={viewMode === 'list' ? 'primary' : 'text'}
                    size="small"
                    icon={<UnorderedListOutlined />}
                    onClick={() => setViewMode('list')}
                    aria-label={t('upload.listView')}
                  />
                </Tooltip>
              </div>
            </div>
          </OperationPanel>

          {loading ? (
            <LoadingState />
          ) : assets.length === 0 ? (
            <OperationPanel data-testid="asset-empty-panel" title={null}>
              <EmptyState description={t('noAssets')} />
              <p className="mt-[-24px] text-center text-sm" style={{ color: 'var(--text-secondary)' }}>
                {t('upload.noAssetsHint')}
              </p>
            </OperationPanel>
          ) : viewMode === 'list' ? (
            <OperationPanel data-testid="asset-list-panel" title={null}>
              <Table
                dataSource={assets}
                columns={columns}
                rowKey="id"
                pagination={false}
                size="middle"
                scroll={{ x: 'max-content' }}
              />
            </OperationPanel>
          ) : (
            <div
              data-testid="asset-grid"
              className="grid gap-3"
              style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))' }}
            >
              {assets.map(asset => (
                <Card
                  key={asset.id}
                  hoverable
                  size="small"
                  className="text-left transition-all"
                  style={{
                    borderColor: 'var(--border-subtle)',
                    borderRadius: 'var(--ds-panel-radius)',
                    background: 'var(--bg-card)',
                  }}
                  cover={
                    <div className="relative flex h-24 items-center justify-center overflow-hidden" style={{ background: 'var(--bg-card-hover)' }}>
                      <Image src="/images/placeholder-asset.svg" alt={asset.filename} fill className="object-contain p-3 opacity-50" unoptimized />
                    </div>
                  }
                  actions={[
                    <Tooltip title={t('upload.sellOnMarket')} key="sell">
                      <Button
                        type="text"
                        size="small"
                        icon={<ShopOutlined />}
                        onClick={() => router.push(`/marketplace/new?from=asset&assetId=${asset.id}&filename=${encodeURIComponent(asset.filename)}&storagePath=${encodeURIComponent(asset.storage_path)}`)}
                        aria-label={t('upload.sellOnMarket')}
                      />
                    </Tooltip>,
                  ]}
                >
                  <div className="truncate text-xs font-medium" style={{ color: 'var(--text-primary)' }} title={asset.filename}>{asset.filename}</div>
                  <div className="mt-1 text-[11px] uppercase" style={{ color: 'var(--text-muted)' }}>{asset.format}</div>
                  <Tag color={assetTypeColors[asset.asset_type]} className="mt-1 text-[10px]">{assetTypeLabels[asset.asset_type] || asset.asset_type}</Tag>
                </Card>
              ))}
            </div>
          )}

          <div className="flex justify-center mt-4">
            <Pagination current={page} total={total} pageSize={pageSize} onChange={setPage} showTotal={total => t('upload.paginationTotal', { total })} />
          </div>
        </div>
      </div>
    </div>
  );
}
