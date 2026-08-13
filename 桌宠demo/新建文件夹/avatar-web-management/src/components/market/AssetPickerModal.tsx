// TODO: BEM-migrate
'use client';

import { useState } from 'react';
import { Modal, Card, Checkbox, Spin, Tag } from 'antd';
import { FileOutlined } from '@ant-design/icons';
import { useTranslations } from 'next-intl';
import { useApiPaginated } from '@/lib/use-api';

interface AssetItem {
  id: string;
  filename: string;
  asset_type: string;
  format: string;
  file_size: number;
  storage_path: string;
  created_at: string;
}

const assetTypeColors: Record<string, string> = {
  model: 'blue', texture: 'green', animation: 'orange', vfx: 'red', hdri: 'purple',
};

interface Props {
  open: boolean;
  onClose: () => void;
  onSelect: (paths: string[]) => void;
  filterType?: string;
}

export default function AssetPickerModal({ open, onClose, onSelect, filterType }: Props) {
  const t = useTranslations('assets');
  const tc = useTranslations('common');

  const assetTypeLabels: Record<string, string> = {
    model: t('types.model'),
    texture: t('types.texture'),
    animation: t('types.animation'),
    vfx: t('types.vfx'),
    hdri: t('types.hdri'),
  };

  const [selected, setSelected] = useState<Set<string>>(new Set());
  const { data, isLoading: loading, error } = useApiPaginated<AssetItem>(
    open ? '/api/assets' : null,
    { pageSize: '100' },
  );
  const allAssets = data?.success ? (data.data?.items ?? []) : [];
  const assets = filterType ? allAssets.filter(asset => asset.asset_type === filterType) : allAssets;

  const handleClose = () => {
    setSelected(new Set());
    onClose();
  };

  const toggleSelect = (id: string) => {
    setSelected(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const handleConfirm = () => {
    const selectedAssets = assets.filter(a => selected.has(a.id));
    onSelect(selectedAssets.map(a => a.storage_path));
    handleClose();
  };

  return (
    <Modal
      title={t('picker.title')}
      open={open}
      onCancel={handleClose}
      onOk={handleConfirm}
      afterOpenChange={(isOpen) => { if (!isOpen) setSelected(new Set()); }}
      okText={t('picker.confirm', { count: selected.size })}
      cancelText={tc('cancel')}
      width={720}
      destroyOnHidden
    >
      {error ? (
        <div className="text-center py-16 text-gray-500">{t('loadFailed')}</div>
      ) : loading ? (
        <div className="flex justify-center py-16"><Spin size="large" /></div>
      ) : assets.length === 0 ? (
        <div className="text-center py-16 text-gray-500">
          <p className="text-lg mb-2">{t('noAssets')}</p>
          <p className="text-sm">{t('uploadFirst')}</p>
        </div>
      ) : (
        <div className="grid grid-cols-3 gap-3 max-h-[400px] overflow-y-auto py-2">
          {assets.map(asset => (
            <Card
              key={asset.id}
              size="small"
              hoverable
              className={`!border-purple-500/10 cursor-pointer transition-colors ${selected.has(asset.id) ? '!border-purple-500/50 bg-purple-500/5' : ''}`}
              onClick={() => toggleSelect(asset.id)}
              cover={
                <div className="h-16 bg-gradient-to-br from-gray-800 to-gray-900 flex items-center justify-center overflow-hidden relative">
                  <FileOutlined className="text-2xl text-gray-500" />
                  {selected.has(asset.id) && (
                    <Checkbox checked className="absolute top-1 right-1" />
                  )}
                </div>
              }
            >
              <div className="text-xs text-gray-300 truncate" title={asset.filename}>{asset.filename}</div>
              <Tag color={assetTypeColors[asset.asset_type]} className="mt-1 text-[10px]">
                {assetTypeLabels[asset.asset_type] || asset.asset_type}
              </Tag>
            </Card>
          ))}
        </div>
      )}
    </Modal>
  );
}
