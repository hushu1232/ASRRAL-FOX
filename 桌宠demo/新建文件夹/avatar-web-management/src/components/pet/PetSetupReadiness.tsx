'use client';

import {
  ApiOutlined,
  CheckCircleOutlined,
  DownloadOutlined,
  KeyOutlined,
  PlayCircleOutlined,
  RobotOutlined,
} from '@ant-design/icons';
import { Alert, Button, Steps } from 'antd';
import { useTranslations } from 'next-intl';
import type { CSSProperties } from 'react';

export type PetSetupReadinessProps = {
  current: number;
  onDismiss: () => void;
  className?: string;
  style?: CSSProperties;
};

function StepContent({ children }: { children: React.ReactNode }) {
  return (
    <span className="text-xs" style={{ color: 'var(--text-secondary)' }}>
      {children}
    </span>
  );
}

export default function PetSetupReadiness({
  current,
  onDismiss,
  className,
  style,
}: PetSetupReadinessProps) {
  const t = useTranslations('pet');

  return (
    <Alert
      type="info"
      showIcon
      closable={{
        onClose: onDismiss,
        closeIcon: <span aria-label="Close setup readiness">×</span>,
      }}
      className={className}
      style={style}
      title={
        <div className="flex flex-wrap items-center justify-between gap-2">
          <span style={{ color: 'var(--text-primary)', fontWeight: 500 }}>{t('wizard.title')}</span>
          <Button
            size="small"
            type="text"
            style={{ color: 'var(--text-muted)' }}
            onClick={onDismiss}
          >
            {t('wizard.skip')}
          </Button>
        </div>
      }
      description={
        <Steps
          size="small"
          responsive
          current={current}
          orientation="horizontal"
          className="mt-3"
          items={[
            {
              title: t('wizard.step1Title'),
              content: (
                <StepContent>
                  {t.rich('wizard.step1Desc', {
                    link: (chunks) => (
                      <a href="/downloads" style={{ color: 'var(--accent)' }}>
                        {chunks}
                      </a>
                    ),
                  })}
                </StepContent>
              ),
              icon: <DownloadOutlined />,
            },
            {
              title: t('wizard.step2Title'),
              content: <StepContent>{t('wizard.step2Desc')}</StepContent>,
              icon: <KeyOutlined />,
            },
            {
              title: t('wizard.step3Title'),
              content: <StepContent>{t('wizard.step3Desc')}</StepContent>,
              icon: <RobotOutlined />,
            },
            {
              title: t('wizard.step4Title'),
              content: <StepContent>{t('wizard.step4Desc')}</StepContent>,
              icon: <PlayCircleOutlined />,
            },
            {
              title: t('wizard.step5Title'),
              content: <StepContent>{t('wizard.step5Desc')}</StepContent>,
              icon: <ApiOutlined />,
            },
            {
              title: t('wizard.step6Title'),
              content: <StepContent>{t('wizard.step6Desc')}</StepContent>,
              icon: <CheckCircleOutlined />,
            },
          ]}
        />
      }
      styles={{
        root: {
          background: 'var(--bg-card)',
          borderColor: 'var(--border-subtle)',
          borderRadius: 'var(--ds-panel-radius)',
        },
      }}
    />
  );
}
