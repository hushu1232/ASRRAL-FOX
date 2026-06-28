'use client';

import { Alert, Card, Descriptions, Space, Steps, Tag, Typography } from 'antd';
import {
  ApiOutlined,
  CheckCircleOutlined,
  ClockCircleOutlined,
  CloudServerOutlined,
  ExclamationCircleOutlined,
  SafetyCertificateOutlined,
} from '@ant-design/icons';

const { Text, Title } = Typography;

const PACKAGE_ROOT = 'D:\\tmp\\alife-webbridge-integration';

const mockChecks = [
  {
    key: 'preflight',
    label: 'Preflight',
    detail: 'WebBridge readiness',
    color: 'green',
    icon: <CloudServerOutlined />,
  },
  {
    key: 'manifest',
    label: 'Package manifest',
    detail: 'current-pet-character-bundle',
    color: 'green',
    icon: <ApiOutlined />,
  },
  {
    key: 'hash',
    label: 'SHA-256 validation',
    detail: 'character-card',
    color: 'green',
    icon: <SafetyCertificateOutlined />,
  },
  {
    key: 'pending',
    label: 'Pending activation',
    detail: 'Local confirmation',
    color: 'orange',
    icon: <ClockCircleOutlined />,
  },
];

const failureReasons = [
  '401 package file',
  'PACKAGE_HASH_MISMATCH',
  'PACKAGE_SECURITY_BLOCKED',
];

export default function WebBridgeMockStatusPanel() {
  return (
    <Card
      title={
        <Space size="small" wrap>
          <ApiOutlined />
          <span>WebBridge package install</span>
          <Tag color="blue">Mock</Tag>
        </Space>
      }
    >
      <Space orientation="vertical" size="large" style={{ width: '100%' }}>
        <div
          style={{
            display: 'grid',
            gap: 12,
            gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))',
          }}
        >
          <div
            style={{
              border: '1px solid rgba(148, 163, 184, 0.22)',
              borderRadius: 8,
              padding: 14,
            }}
          >
            <Text type="secondary">Runtime</Text>
            <Title level={5} style={{ margin: '6px 0 0' }}>
              Alife .NET 9
            </Title>
          </div>
          <div
            style={{
              border: '1px solid rgba(148, 163, 184, 0.22)',
              borderRadius: 8,
              padding: 14,
            }}
          >
            <Text type="secondary">Package state</Text>
            <div style={{ marginTop: 8 }}>
              <Tag color="orange">pendingActivation</Tag>
            </div>
          </div>
          <div
            style={{
              border: '1px solid rgba(148, 163, 184, 0.22)',
              borderRadius: 8,
              padding: 14,
            }}
          >
            <Text type="secondary">Isolation</Text>
            <div style={{ marginTop: 8 }}>
              <Tag color="default">No live Alife calls</Tag>
            </div>
          </div>
        </div>

        <Steps
          size="small"
          current={3}
          items={mockChecks.map((check) => ({
            title: check.label,
            content: (
              <Space orientation="vertical" size={2}>
                <Text type="secondary">{check.detail}</Text>
                <Tag color={check.color}>{check.key === 'pending' ? 'Waiting' : 'Ready'}</Tag>
              </Space>
            ),
            icon: check.icon,
          }))}
        />

        <Descriptions column={1} size="small">
          <Descriptions.Item label="Package root">
            <Text code>{PACKAGE_ROOT}</Text>
          </Descriptions.Item>
          <Descriptions.Item label="Manifest">
            current-pet-character-bundle
          </Descriptions.Item>
          <Descriptions.Item label="File">
            characters/current-pet/card.json
          </Descriptions.Item>
        </Descriptions>

        <Alert
          type="warning"
          showIcon
          icon={<ExclamationCircleOutlined />}
          title="Failure states"
          description={
            <Space size={[8, 8]} wrap>
              {failureReasons.map((reason) => (
                <Tag key={reason} color="red">
                  {reason}
                </Tag>
              ))}
            </Space>
          }
        />

        <Alert
          type="success"
          showIcon
          icon={<CheckCircleOutlined />}
          title="Activation guard"
          description="autoApply=false, requiresLocalConfirmation=true"
        />
      </Space>
    </Card>
  );
}
