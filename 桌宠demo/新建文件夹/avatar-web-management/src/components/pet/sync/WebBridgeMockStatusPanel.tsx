'use client';

import { useMemo, useState } from 'react';
import { Alert, Descriptions, Segmented, Space, Steps, Tag, Typography } from 'antd';
import { useTranslations } from 'next-intl';
import {
  ApiOutlined,
  CheckCircleOutlined,
  ClockCircleOutlined,
  CloudServerOutlined,
  ExclamationCircleOutlined,
  SafetyCertificateOutlined,
} from '@ant-design/icons';
import EvidenceGrid from '@/components/ui/EvidenceGrid';
import MetricTile from '@/components/ui/MetricTile';
import OperationPanel from '@/components/ui/OperationPanel';
import StatusChip from '@/components/ui/StatusChip';

const { Text } = Typography;

const PACKAGE_ROOT = 'D:\\FOXD\\.worktrees\\_alife-webbridge-integration';

type MockScenarioKey = 'pendingActivation' | 'unauthorized' | 'hashMismatch' | 'securityBlocked';

type CheckState = 'ready' | 'waiting' | 'failed' | 'blocked';

const mockChecks = [
  { key: 'preflight', icon: <CloudServerOutlined /> },
  { key: 'manifest', icon: <ApiOutlined /> },
  { key: 'hash', icon: <SafetyCertificateOutlined /> },
  { key: 'pending', icon: <ClockCircleOutlined /> },
];

const mockScenarios: Record<
  MockScenarioKey,
  {
    packageState: string;
    tagColor: string;
    activeStep: number;
    alertType: 'success' | 'warning' | 'error';
    checks: Record<string, CheckState>;
  }
> = {
  pendingActivation: {
    packageState: 'pendingActivation',
    tagColor: 'orange',
    activeStep: 3,
    alertType: 'success',
    checks: {
      preflight: 'ready',
      manifest: 'ready',
      hash: 'ready',
      pending: 'waiting',
    },
  },
  unauthorized: {
    packageState: '401 package file',
    tagColor: 'red',
    activeStep: 1,
    alertType: 'error',
    checks: {
      preflight: 'ready',
      manifest: 'failed',
      hash: 'blocked',
      pending: 'blocked',
    },
  },
  hashMismatch: {
    packageState: 'PACKAGE_HASH_MISMATCH',
    tagColor: 'red',
    activeStep: 2,
    alertType: 'error',
    checks: {
      preflight: 'ready',
      manifest: 'ready',
      hash: 'failed',
      pending: 'blocked',
    },
  },
  securityBlocked: {
    packageState: 'PACKAGE_SECURITY_BLOCKED',
    tagColor: 'red',
    activeStep: 0,
    alertType: 'error',
    checks: {
      preflight: 'failed',
      manifest: 'blocked',
      hash: 'blocked',
      pending: 'blocked',
    },
  },
};

const checkStateColors: Record<CheckState, string> = {
  ready: 'green',
  waiting: 'orange',
  failed: 'red',
  blocked: 'default',
};

const failureReasons = ['401 package file', 'PACKAGE_HASH_MISMATCH', 'PACKAGE_SECURITY_BLOCKED'];

export default function WebBridgeMockStatusPanel() {
  const t = useTranslations('pet.webbridgeMock');
  const [scenarioKey, setScenarioKey] = useState<MockScenarioKey>('pendingActivation');
  const scenario = mockScenarios[scenarioKey];
  const scenarioOptions = useMemo(
    () =>
      (Object.keys(mockScenarios) as MockScenarioKey[]).map((value) => ({
        label: t(`scenario.${value}.label`),
        value,
      })),
    [t],
  );
  const nextAction = t(`scenario.${scenarioKey}.nextAction`);

  return (
    <OperationPanel
      data-testid="webbridge-mock-simulation-panel"
      title={
        <Space size="small" wrap>
          <ApiOutlined />
          <span>{t('title')}</span>
          <StatusChip tone="neutral">{t('simulationOnly')}</StatusChip>
        </Space>
      }
    >
      <Space vertical size="large" style={{ width: '100%' }}>
        <Alert type="info" showIcon title={t('readOnlyNotice')} />

        <div>
          <Text strong>{t('scenarioLabel')}</Text>
          <div style={{ marginTop: 8, maxWidth: '100%', overflowX: 'auto', paddingBottom: 2 }}>
            <Segmented
              options={scenarioOptions}
              value={scenarioKey}
              onChange={(value) => setScenarioKey(value as MockScenarioKey)}
              style={{ minWidth: 'max-content' }}
            />
          </div>
        </div>

        <EvidenceGrid data-testid="webbridge-mock-evidence-grid">
          <MetricTile label={t('runtime')} value="Alife .NET 9" />
          <MetricTile
            label={t('packageState')}
            value={<Tag color={scenario.tagColor}>{scenario.packageState}</Tag>}
          />
          <MetricTile label={t('nextAction')} value={nextAction} />
          <MetricTile
            label={t('isolation')}
            value={<StatusChip tone="neutral">{t('noLiveCalls')}</StatusChip>}
          />
        </EvidenceGrid>

        <Steps
          size="small"
          current={scenario.activeStep}
          items={mockChecks.map((check) => ({
            title: t(`check.${check.key}.label`),
            status: toStepStatus(scenario.checks[check.key]),
            content: (
              <Space vertical size={2}>
                <Text type="secondary">{t(`check.${check.key}.detail`)}</Text>
                <Tag color={checkStateColors[scenario.checks[check.key]]}>
                  {t(`state.${scenario.checks[check.key]}`)}
                </Tag>
              </Space>
            ),
            icon: check.icon,
          }))}
        />

        <Descriptions column={1} size="small">
          <Descriptions.Item label={t('packageRoot')}>
            <Text code>{PACKAGE_ROOT}</Text>
          </Descriptions.Item>
          <Descriptions.Item label={t('manifest')}>current-pet-character-bundle</Descriptions.Item>
          <Descriptions.Item label={t('file')}>characters/current-pet/card.json</Descriptions.Item>
          <Descriptions.Item label={t('scenarioDetail')}>
            {t(`scenario.${scenarioKey}.detail`)}
          </Descriptions.Item>
        </Descriptions>

        <Alert
          type="warning"
          showIcon
          icon={<ExclamationCircleOutlined />}
          title={t('failureStates')}
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
          title={t('activationGuard')}
          description={
            <Space vertical size={4}>
              <Text>{nextAction}</Text>
              <Text code>{t('autoApplyGuard')}</Text>
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
