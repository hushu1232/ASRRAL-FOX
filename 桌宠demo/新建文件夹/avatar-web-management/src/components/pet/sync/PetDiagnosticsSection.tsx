'use client';

import { useState, type ReactNode } from 'react';
import { BugOutlined, DownOutlined, UpOutlined } from '@ant-design/icons';
import { Button, Space, Typography } from 'antd';
import { useTranslations } from 'next-intl';

const { Text } = Typography;

interface PetDiagnosticsSectionProps {
  children: ReactNode;
}

const contentId = 'pet-diagnostics-content';

export default function PetDiagnosticsSection({ children }: PetDiagnosticsSectionProps) {
  const t = useTranslations('pet.diagnostics');
  const [open, setOpen] = useState(false);

  return (
    <section
      aria-label={t('title')}
      data-testid="pet-diagnostics-section"
      style={{
        background: 'var(--bg-card)',
        border: '1px solid var(--border-subtle)',
        borderRadius: 'var(--ds-panel-radius)',
        padding: 'var(--ds-panel-densePadding)',
      }}
    >
      <div
        style={{
          alignItems: 'flex-start',
          display: 'flex',
          gap: 12,
          justifyContent: 'space-between',
          width: '100%',
          flexWrap: 'wrap',
        }}
      >
        <Space align="start" size="middle">
          <span
            aria-hidden="true"
            style={{
              alignItems: 'center',
              color: 'var(--text-secondary)',
              display: 'inline-flex',
              fontSize: 18,
              minHeight: 24,
            }}
          >
            <BugOutlined />
          </span>
          <Space orientation="vertical" size={2}>
            <Text strong style={{ color: 'var(--text-primary)' }}>
              {t('title')}
            </Text>
            <Text type="secondary" style={{ color: 'var(--text-secondary)' }}>
              {t('description')}
            </Text>
          </Space>
        </Space>

        <Button
          aria-controls={contentId}
          aria-expanded={open}
          icon={open ? <UpOutlined /> : <DownOutlined />}
          onClick={() => setOpen((current) => !current)}
        >
          {open ? t('hide') : t('show')}
        </Button>
      </div>

      <div id={contentId} hidden={!open} style={{ marginTop: open ? 16 : 0 }}>
        {open ? children : null}
      </div>
    </section>
  );
}
