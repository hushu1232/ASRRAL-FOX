'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { Card, Button, Input, Select, Space, Table, Tag, Tree, App, Spin, Pagination, Progress } from 'antd';
import { UploadOutlined, AppstoreOutlined, UnorderedListOutlined, FolderOutlined, FileOutlined, SearchOutlined, ShopOutlined } from '@ant-design/icons';
import { useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';
import Image from 'next/image';
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
      <ShopOutlined className="cursor-pointer text-gray-400 hover:text-purple-400" onClick={() => router.push(`/marketplace/new?from=asset&assetId=${record.id}&filename=${encodeURIComponent(record.filename)}&storagePath=${encodeURIComponent(record.storage_path)}`)} aria-label={t('upload.sellOnMarket')} />
    ) },
  ];

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold text-white">{t('title')}</h1>
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
      </div>

      <div className="flex gap-4">
        <Card className="!border-purple-500/10 w-52 shrink-0" title={t('upload.directory')}>
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
        </Card>

        <div className="flex-1">
          <Card className="!border-purple-500/10 mb-4">
            <Space wrap>
              <Input prefix={<SearchOutlined />} placeholder={t('upload.searchFiles')} value={search} onChange={e => { setSearch(e.target.value); setPage(1); }} style={{ width: 220 }} />
              <Select
                placeholder={t('upload.typeFilter')}
                value={typeFilter || undefined}
                onChange={(v) => { setTypeFilter(v || ''); setPage(1); }}
                allowClear
                style={{ width: 140 }}
                options={Object.entries(assetTypeLabels).map(([k, v]) => ({ value: k, label: v }))}
              />
              <div className="flex gap-1 border border-purple-500/20 rounded-lg p-0.5">
                <Button type={viewMode === 'grid' ? 'primary' : 'text'} size="small" icon={<AppstoreOutlined />} onClick={() => setViewMode('grid')} />
                <Button type={viewMode === 'list' ? 'primary' : 'text'} size="small" icon={<UnorderedListOutlined />} onClick={() => setViewMode('list')} />
              </div>
            </Space>
          </Card>

          {loading ? (
            <div className="flex justify-center py-20"><Spin size="large" /></div>
          ) : assets.length === 0 ? (
            <Card className="!border-purple-500/10 text-center py-16">
              <p className="text-lg text-gray-500 mb-2">{t('noAssets')}</p>
              <p className="text-sm text-gray-600">{t('upload.noAssetsHint')}</p>
            </Card>
          ) : viewMode === 'list' ? (
            <Card className="!border-purple-500/10">
              <Table dataSource={assets} columns={columns} rowKey="id" pagination={false} size="middle" />
            </Card>
          ) : (
            <div className="grid grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-3">
              {assets.map(asset => (
                <Card
                  key={asset.id}
                  hoverable
                  size="small"
                  className="!border-purple-500/10 text-center"
                  cover={
                    <div className="h-20 bg-gradient-to-br from-gray-800 to-gray-900 flex items-center justify-center overflow-hidden relative">
                      <Image src="/images/placeholder-asset.svg" alt={asset.filename} fill className="object-contain p-3 opacity-50" unoptimized />
                    </div>
                  }
                  actions={[
                    <ShopOutlined key="sell" onClick={() => router.push(`/marketplace/new?from=asset&assetId=${asset.id}&filename=${encodeURIComponent(asset.filename)}&storagePath=${encodeURIComponent(asset.storage_path)}`)} aria-label={t('upload.sellOnMarket')} />,
                  ]}
                >
                  <div className="text-xs text-gray-300 truncate" title={asset.filename}>{asset.filename}</div>
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
