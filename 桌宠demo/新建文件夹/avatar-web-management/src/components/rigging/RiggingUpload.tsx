// TODO: BEM-migrate
'use client';

import { useState, useCallback, useRef } from 'react';
import { Upload, Button, Select, Card, Typography, message, Space } from 'antd';
import { InboxOutlined, ThunderboltOutlined } from '@ant-design/icons';
import { useTranslations } from 'next-intl';

const { Dragger } = Upload;
const { Title, Text } = Typography;

interface RiggingUploadProps {
  onPipelineStart: (data: { imageId: string; template: string; meshDensity: string; previewUrl: string }) => void;
  disabled?: boolean;
}

export default function RiggingUpload({ onPipelineStart, disabled }: RiggingUploadProps) {
  const t = useTranslations('rigging.upload');
  const tt = useTranslations('rigging.templates');
  const tm = useTranslations('rigging.mesh');

  const TEMPLATE_OPTIONS = [
    { value: 'catgirl', label: tt('catgirl') },
    { value: 'human_female', label: tt('human_female') },
    { value: 'human_male', label: tt('human_male') },
  ];

  const MESH_OPTIONS = [
    { value: 'low', label: tm('low') },
    { value: 'medium', label: tm('medium') },
    { value: 'high', label: tm('high') },
  ];

  const [file, setFile] = useState<File | null>(null);
  const [template, setTemplate] = useState('catgirl');
  const [meshDensity, setMeshDensity] = useState('medium');
  const [uploading, setUploading] = useState(false);
  const [imageId, setImageId] = useState<string | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const previewRef = useRef<string | null>(null);

  const handleUpload = useCallback(async () => {
    if (!file) return;
    setUploading(true);

    try {
      const form = new FormData();
      form.append('file', file);

      const res = await fetch('/api/rigging/upload', {
        method: 'POST',
        body: form,
      });
      const json = await res.json();

      if (!json.success) {
        message.error(json.error || 'Upload failed');
        return;
      }

      setImageId(json.data.imageId);
      setPreviewUrl(json.data.previewUrl);
      previewRef.current = json.data.previewUrl;
      message.success(t('uploadSuccess'));
    } catch {
      message.error(t('uploadFailed'));
    } finally {
      setUploading(false);
    }
  }, [file, t]);

  const handleStart = useCallback(() => {
    if (!imageId) return;
    onPipelineStart({
      imageId,
      template,
      meshDensity,
      previewUrl: previewRef.current || '',
    });
  }, [imageId, template, meshDensity, onPipelineStart]);

  const beforeUpload = useCallback((f: File) => {
    const isImage = f.type === 'image/png' || f.type === 'image/jpeg';
    if (!isImage) {
      message.error(t('unsupportedFormat'));
      return false;
    }
    const isUnderLimit = f.size <= 10 * 1024 * 1024;
    if (!isUnderLimit) {
      message.error(t('fileTooLarge'));
      return false;
    }
    setFile(f);
    setImageId(null);
    setPreviewUrl(null);
    return false;
  }, [t]);

  return (
    <div className="max-w-2xl mx-auto">
      <Title level={4}>{t('title')}</Title>
      <Text type="secondary">{t('description')}</Text>

      <Dragger
        accept=".png,.jpeg,.jpg"
        beforeUpload={beforeUpload}
        maxCount={1}
        disabled={uploading || disabled}
        className="mt-4"
      >
        <p className="ant-upload-drag-icon"><InboxOutlined /></p>
        <p className="ant-upload-text">{t('dragText')}</p>
        <p className="ant-upload-hint">{t('dragHint')}</p>
      </Dragger>

      {file && !imageId && (
        <Button
          type="primary"
          onClick={handleUpload}
          loading={uploading}
          disabled={disabled}
          className="mt-3 w-full"
        >
          {uploading ? t('uploading') : t('uploadToAI')}
        </Button>
      )}

      {imageId && (
        <Card size="small" className="mt-4 !bg-green-50">
          <Text type="success">{t('uploaded')}{file?.name}</Text>
        </Card>
      )}

      <Card title={t('generateOptions')} className="mt-4">
        <Space direction="vertical" style={{ width: '100%' }}>
          <div>
            <Text strong>{t('skeletonTemplate')}</Text>
            <Select
              value={template}
              onChange={setTemplate}
              options={TEMPLATE_OPTIONS}
              className="w-full mt-1"
              disabled={disabled}
            />
          </div>
          <div>
            <Text strong>{t('meshDensity')}</Text>
            <Select
              value={meshDensity}
              onChange={setMeshDensity}
              options={MESH_OPTIONS}
              className="w-full mt-1"
              disabled={disabled}
            />
          </div>
        </Space>
      </Card>

      <Button
        type="primary"
        icon={<ThunderboltOutlined />}
        onClick={handleStart}
        disabled={!imageId || disabled}
        loading={disabled}
        size="large"
        block
        className="mt-4 h-12"
      >
        {t('startGeneration')}
      </Button>
    </div>
  );
}