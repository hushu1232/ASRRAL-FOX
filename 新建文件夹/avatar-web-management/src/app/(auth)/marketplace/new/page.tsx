'use client';

import { useState, useEffect } from 'react';
import { Card, Form, Input, Select, InputNumber, Button, App, Divider, Alert } from 'antd';
import { SendOutlined, InfoCircleOutlined, FolderOpenOutlined } from '@ant-design/icons';
import { useRouter, useSearchParams } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { apiPost } from '@/lib/api-client';
import AssetPickerModal from '@/components/market/AssetPickerModal';

const { TextArea } = Input;

interface ListingForm {
  title: string;
  description: string;
  category: string;
  price: number;
  currency: string;
  previewImages: string;
  files: string;
  thumbnailUrl: string;
}

function parseLines(s: string): string[] {
  return s.split('\n').map(l => l.trim()).filter(Boolean);
}

export default function NewMarketItemPage() {
  const { message } = App.useApp();
  const router = useRouter();
  const searchParams = useSearchParams();
  const t = useTranslations('marketplace.new');
  const tc = useTranslations('marketplace.categories');
  const tco = useTranslations('common');
  const [loading, setLoading] = useState(false);
  const [filesPickerOpen, setFilesPickerOpen] = useState(false);
  const [previewPickerOpen, setPreviewPickerOpen] = useState(false);
  const [form] = Form.useForm<ListingForm>();

  const CATEGORIES = [
    { value: 'model', label: tc('model') },
    { value: 'personality', label: tc('personality') },
    { value: 'voice', label: tc('voice') },
    { value: 'animation', label: tc('animation') },
    { value: 'theme', label: tc('theme') },
  ];

  const fromAvatar = searchParams.get('from') === 'avatar';
  const avatarId = searchParams.get('avatarId') || '';
  const avatarTitle = searchParams.get('title') || '';
  const fromAsset = searchParams.get('from') === 'asset';
  const assetId = searchParams.get('assetId') || '';
  const assetFilename = searchParams.get('filename') || '';
  const storagePath = searchParams.get('storagePath') || '';

  // Pre-fill form when coming from avatar page
  useEffect(() => {
    if (fromAvatar && avatarId) {
      form.setFieldsValue({
        title: avatarTitle || '我的形象',
        category: 'model',
        price: 0,
      });
    }
  }, [fromAvatar, avatarId, avatarTitle, form]);

  // Pre-fill when coming from asset page — use storage_path as file entry
  useEffect(() => {
    if (fromAsset && assetId && storagePath) {
      form.setFieldsValue({
        title: assetFilename || '我的资产',
        category: 'model',
        price: 0,
        files: storagePath,
      });
    }
  }, [fromAsset, assetId, assetFilename, storagePath, form]);

  const handleSubmit = async (values: ListingForm) => {
    setLoading(true);
    try {
      const res = await apiPost('/api/market/items', {
        title: values.title,
        description: values.description || '',
        category: values.category,
        price: values.price || 0,
        currency: values.currency || 'CNY',
        files: parseLines(values.files || ''),
        previewImages: parseLines(values.previewImages || ''),
        thumbnailUrl: values.thumbnailUrl || undefined,
        avatarId: fromAvatar ? avatarId : undefined,
      });

      if (res.success) {
        message.success(t('submitSuccess'));
        router.push('/seller');
      } else {
        message.error(res.error || t('submitFailed'));
      }
    } catch {
      message.error(tco('networkError'));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="max-w-2xl mx-auto">
      <Button type="text" onClick={() => router.back()} className="mb-4 text-gray-400 hover:text-white">
        {t('back')}
      </Button>

      <Card className="!border-purple-500/10">
        <h1 className="text-xl font-bold text-white mb-6">{t('title')}</h1>

        {fromAvatar && avatarId && (
          <Alert
            type="info"
            icon={<InfoCircleOutlined />}
            message={t('fromAvatarTitle')}
            description={t('fromAvatarDesc', { name: avatarTitle, id: avatarId })}
            className="mb-4"
            showIcon
          />
        )}

        {fromAsset && assetId && (
          <Alert
            type="info"
            icon={<InfoCircleOutlined />}
            message={t('fromAssetTitle')}
            description={t('fromAssetDesc', { name: assetFilename || assetId })}
            className="mb-4"
            showIcon
          />
        )}

        <Form
          form={form}
          layout="vertical"
          onFinish={handleSubmit}
          initialValues={{ category: 'model', price: 0, currency: 'CNY' }}
        >
          <Form.Item
            name="title"
            label={<span className="text-gray-300">{t('itemName')}</span>}
            rules={[{ required: true, message: t('itemNameRequired') }, { max: 100 }]}
          >
            <Input placeholder={t('itemNamePlaceholder')} maxLength={100} />
          </Form.Item>

          <Form.Item
            name="category"
            label={<span className="text-gray-300">{t('category')}</span>}
            rules={[{ required: true }]}
          >
            <Select options={CATEGORIES} />
          </Form.Item>

          <Form.Item
            name="description"
            label={<span className="text-gray-300">{tco('description')}</span>}
          >
            <TextArea rows={4} placeholder={t('descriptionPlaceholder')} maxLength={2000} showCount />
          </Form.Item>

          <div className="grid grid-cols-2 gap-4">
            <Form.Item
              name="price"
              label={<span className="text-gray-300">{t('priceLabel')}</span>}
            >
              <InputNumber min={0} className="w-full" placeholder={t('pricePlaceholder')} />
            </Form.Item>
            <Form.Item
              name="currency"
              label={<span className="text-gray-300">{t('currencyLabel')}</span>}
            >
              <Select options={[{ value: 'CNY', label: t('currencyCNY') }, { value: 'USD', label: t('currencyUSD') }]} />
            </Form.Item>
          </div>

          <Form.Item
            name="thumbnailUrl"
            label={<span className="text-gray-300">{t('thumbnailUrlLabel')}</span>}
          >
            <Input placeholder={t('thumbnailUrlPlaceholder')} />
          </Form.Item>

          <Form.Item
            name="previewImages"
            label={<span className="text-gray-300">{t('previewImagesLabel')}</span>}
            extra={<span className="text-gray-500">{t('previewImagesExtra')}</span>}
          >
            <TextArea rows={3} placeholder="https://example.com/preview1.png&#10;https://example.com/preview2.png" />
            <Button
              type="dashed"
              icon={<FolderOpenOutlined />}
              onClick={() => setPreviewPickerOpen(true)}
              className="mt-2"
              size="small"
            >
              {t('pickPreviews')}
            </Button>
          </Form.Item>

          <Form.Item
            name="files"
            label={<span className="text-gray-300">{t('filesLabel')}</span>}
            extra={<span className="text-gray-500">{t('filesExtra')}</span>}
          >
            <TextArea rows={2} placeholder="models/my-model.model3.json&#10;textures/my-tex.png" />
            <Button
              type="dashed"
              icon={<FolderOpenOutlined />}
              onClick={() => setFilesPickerOpen(true)}
              className="mt-2"
              size="small"
            >
              {t('pickFiles')}
            </Button>
          </Form.Item>

          <Divider />

          <Button
            type="primary"
            htmlType="submit"
            loading={loading}
            icon={<SendOutlined />}
            size="large"
            block
            className="bg-gradient-to-r from-purple-600 to-blue-600 border-0 h-12 text-lg font-bold"
          >
            {t('submit')}
          </Button>
        </Form>
      </Card>

      <AssetPickerModal
        open={filesPickerOpen}
        onClose={() => setFilesPickerOpen(false)}
        onSelect={(paths) => {
          const current = form.getFieldValue('files') || '';
          const existing = current ? current.split('\n').filter(Boolean) : [];
          const merged = [...existing, ...paths].join('\n');
          form.setFieldsValue({ files: merged });
        }}
      />

      <AssetPickerModal
        open={previewPickerOpen}
        onClose={() => setPreviewPickerOpen(false)}
        filterType="texture"
        onSelect={(paths) => {
          const current = form.getFieldValue('previewImages') || '';
          const existing = current ? current.split('\n').filter(Boolean) : [];
          const merged = [...existing, ...paths].join('\n');
          form.setFieldsValue({ previewImages: merged });
        }}
      />
    </div>
  );
}
