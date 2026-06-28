// TODO: BEM-migrate
'use client';

import { Card, Button, Space, Typography, Descriptions, message, Divider } from 'antd';
import { DownloadOutlined, PlaySquareOutlined, ShoppingCartOutlined, ReloadOutlined } from '@ant-design/icons';
import { useTranslations } from 'next-intl';

const { Title, Text } = Typography;

interface ModelResult {
  modelId: string;
  previewUrl: string;
  moc3Url: string;
  totalTimeMs: number;
}

interface ModelPreviewProps {
  result: ModelResult;
  template: string;
  meshDensity: string;
  onReset: () => void;
}

export default function ModelPreview({ result, template, meshDensity, onReset }: ModelPreviewProps) {
  const tp = useTranslations('rigging.preview');
  const tt = useTranslations('rigging.templates');
  const tm = useTranslations('rigging.mesh');

  const handleSetAsPet = async () => {
    try {
      const res = await fetch('/api/pet/set-avatar', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ avatarId: result.modelId }),
      });
      const json = await res.json();
      if (json.success) {
        message.success(tp('setAsPetSuccess'));
      } else {
        message.error(json.error || tp('setFailed'));
      }
    } catch {
      message.error(tp('setFailedRetry'));
    }
  };

  const handleDownload = () => {
    window.open(`/api/rigging/models/${result.modelId}`, '_blank');
  };

  const handlePublish = () => {
    window.location.href = `/marketplace/new?modelId=${result.modelId}`;
  };

  return (
    <div className="max-w-2xl mx-auto">
      <Title level={4}>{tp('title')}</Title>

      <Card className="mt-4">
        <div className="flex flex-col sm:flex-row gap-4 mb-4">
          {result.previewUrl && (
            <div className="w-40 h-[213px] overflow-hidden rounded-lg bg-gray-100 shrink-0">
              <img
                src={result.previewUrl}
                alt="Generated model preview"
                className="w-full h-full object-cover"
              />
            </div>
          )}
          <Descriptions column={1} size="small">
            <Descriptions.Item label={tp('template')}>{tt(template) || template}</Descriptions.Item>
            <Descriptions.Item label={tp('mesh')}>{tm(meshDensity) || meshDensity}</Descriptions.Item>
            <Descriptions.Item label={tp('duration')}>{Math.round(result.totalTimeMs / 1000)}s</Descriptions.Item>
            <Descriptions.Item label={tp('modelId')}>
              <Text copyable style={{ fontSize: 12 }}>{result.modelId}</Text>
            </Descriptions.Item>
          </Descriptions>
        </div>

        <Divider />

        <Space orientation="vertical" style={{ width: '100%' }}>
          <Button
            type="primary"
            icon={<PlaySquareOutlined />}
            block
            onClick={handleSetAsPet}
          >
            {tp('setAsPet')}
          </Button>
          <Button
            icon={<DownloadOutlined />}
            block
            onClick={handleDownload}
          >
            {tp('downloadModel')}
          </Button>
          <Button
            icon={<ShoppingCartOutlined />}
            block
            onClick={handlePublish}
          >
            {tp('publishToMarket')}
          </Button>
          <Button
            type="text"
            icon={<ReloadOutlined />}
            block
            onClick={onReset}
          >
            {tp('regenerate')}
          </Button>
        </Space>
      </Card>
    </div>
  );
}