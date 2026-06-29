'use client';

import { useMemo, useState } from 'react';
import { Alert, Descriptions, Segmented, Space, Steps, Tag, Typography } from 'antd';
import {
  ApiOutlined,
  CheckCircleOutlined,
  ClockCircleOutlined,
  CloudServerOutlined,
  ExclamationCircleOutlined,
  SafetyCertificateOutlined,
} from '@ant-design/icons';
import MetricTile from '@/components/ui/MetricTile';
import OperationPanel from '@/components/ui/OperationPanel';

const { Text } = Typography;

const PACKAGE_ROOT = 'D:\\tmp\\alife-webbridge-integration';

type MockScenarioKey = 'pendingActivation' | 'unauthorized' | 'hashMismatch' | 'securityBlocked';

type CheckState = 'ready' | 'waiting' | 'failed' | 'blocked';

const mockChecks = [
  {
    key: 'preflight',
    label: 'Preflight',
    detail: 'WebBridge readiness',
    icon: <CloudServerOutlined />,
  },
  {
    key: 'manifest',
    label: 'Package manifest',
    detail: 'current-pet-character-bundle',
    icon: <ApiOutlined />,
  },
  {
    key: 'hash',
    label: 'SHA-256 validation',
    detail: 'character-card',
    icon: <SafetyCertificateOutlined />,
  },
  {
    key: 'pending',
    label: 'Pending activation',
    detail: 'Local confirmation',
    icon: <ClockCircleOutlined />,
  },
];

const mockScenarios: Record<
  MockScenarioKey,
  {
    label: string;
    packageState: string;
    tagColor: string;
    activeStep: number;
    nextAction: string;
    detail: string;
    alertType: 'success' | 'warning' | 'error';
    checks: Record<string, CheckState>;
  }
> = {
  pendingActivation: {
    label: 'Ready package',
    packageState: 'pendingActivation',
    tagColor: 'orange',
    activeStep: 3,
    nextAction: 'Local operator review before apply',
    detail: 'Package passed preflight, manifest, and SHA-256 checks. Activation is held locally.',
    alertType: 'success',
    checks: {
      preflight: 'ready',
      manifest: 'ready',
      hash: 'ready',
      pending: 'waiting',
    },
  },
  unauthorized: {
    label: 'Auth failure',
    packageState: '401 package file',
    tagColor: 'red',
    activeStep: 1,
    nextAction: 'Refresh package bearer token before download',
    detail: 'The manifest can be reached, but a package file request is rejected by authorization.',
    alertType: 'error',
    checks: {
      preflight: 'ready',
      manifest: 'failed',
      hash: 'blocked',
      pending: 'blocked',
    },
  },
  hashMismatch: {
    label: 'Hash mismatch',
    packageState: 'PACKAGE_HASH_MISMATCH',
    tagColor: 'red',
    activeStep: 2,
    nextAction: 'Reject package and re-download bundle',
    detail: 'The downloaded file digest does not match the signed package manifest.',
    alertType: 'error',
    checks: {
      preflight: 'ready',
      manifest: 'ready',
      hash: 'failed',
      pending: 'blocked',
    },
  },
  securityBlocked: {
    label: 'Security block',
    packageState: 'PACKAGE_SECURITY_BLOCKED',
    tagColor: 'red',
    activeStep: 0,
    nextAction: 'Keep activation disabled until path validation passes',
    detail: 'A path traversal or unsafe package file target is blocked before activation.',
    alertType: 'error',
    checks: {
      preflight: 'failed',
      manifest: 'blocked',
      hash: 'blocked',
      pending: 'blocked',
    },
  },
};

const checkStateLabels: Record<CheckState, string> = {
  ready: 'Ready',
  waiting: 'Waiting',
  failed: 'Failed',
  blocked: 'Blocked',
};

const checkStateColors: Record<CheckState, string> = {
  ready: 'green',
  waiting: 'orange',
  failed: 'red',
  blocked: 'default',
};

const failureReasons = ['401 package file', 'PACKAGE_HASH_MISMATCH', 'PACKAGE_SECURITY_BLOCKED'];

export default function WebBridgeMockStatusPanel() {
  const [scenarioKey, setScenarioKey] = useState<MockScenarioKey>('pendingActivation');
  const scenario = mockScenarios[scenarioKey];
  const scenarioOptions = useMemo(
    () =>
      Object.entries(mockScenarios).map(([value, item]) => ({
        label: item.label,
        value,
      })),
    [],
  );

  return (
    <OperationPanel
      title={
        <Space size="small" wrap>
          <ApiOutlined />
          <span>WebBridge package install</span>
          <Tag color="blue">Mock</Tag>
        </Space>
      }
    >
      <Space vertical size="large" style={{ width: '100%' }}>
        <div>
          <Text strong>Mock scenario</Text>
          <div style={{ marginTop: 8, maxWidth: '100%', overflowX: 'auto', paddingBottom: 2 }}>
            <Segmented
              options={scenarioOptions}
              value={scenarioKey}
              onChange={(value) => setScenarioKey(value as MockScenarioKey)}
              style={{ minWidth: 'max-content' }}
            />
          </div>
        </div>

        <div
          style={{
            display: 'grid',
            gap: 12,
            gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))',
          }}
        >
          <MetricTile label="Runtime" value="Alife .NET 9" />
          <MetricTile
            label="Package state"
            value={<Tag color={scenario.tagColor}>{scenario.packageState}</Tag>}
          />
          <MetricTile label="Next action" value={scenario.nextAction} />
          <MetricTile label="Isolation" value={<Tag color="default">No live Alife calls</Tag>} />
        </div>

        <Steps
          size="small"
          current={scenario.activeStep}
          items={mockChecks.map((check) => ({
            title: check.label,
            status: toStepStatus(scenario.checks[check.key]),
            content: (
              <Space vertical size={2}>
                <Text type="secondary">{check.detail}</Text>
                <Tag color={checkStateColors[scenario.checks[check.key]]}>
                  {checkStateLabels[scenario.checks[check.key]]}
                </Tag>
              </Space>
            ),
            icon: check.icon,
          }))}
        />

        <Descriptions column={1} size="small">
          <Descriptions.Item label="Package root">
            <Text code>{PACKAGE_ROOT}</Text>
          </Descriptions.Item>
          <Descriptions.Item label="Manifest">current-pet-character-bundle</Descriptions.Item>
          <Descriptions.Item label="File">characters/current-pet/card.json</Descriptions.Item>
          <Descriptions.Item label="Scenario detail">{scenario.detail}</Descriptions.Item>
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
          type={scenario.alertType}
          showIcon
          icon={<CheckCircleOutlined />}
          title="Activation guard"
          description={
            <Space vertical size={4}>
              <Text>{scenario.nextAction}</Text>
              <Text code>autoApply=false, requiresLocalConfirmation=true</Text>
            </Space>
          }
        />
      </Space>
    </OperationPanel>
  );
}

function toStepStatus(state: CheckState): 'finish' | 'process' | 'wait' | 'error' {
  if (state === 'failed') {
    return 'error';
  }

  if (state === 'ready') {
    return 'finish';
  }

  if (state === 'waiting') {
    return 'process';
  }

  return 'wait';
}
