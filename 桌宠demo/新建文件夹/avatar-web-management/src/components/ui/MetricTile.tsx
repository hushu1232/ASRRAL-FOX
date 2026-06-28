import type { AriaRole, CSSProperties, ReactNode } from 'react';
import { Typography } from 'antd';

const { Text } = Typography;

export interface MetricTileProps {
  label: ReactNode;
  value: ReactNode;
  detail?: ReactNode;
  className?: string;
  style?: CSSProperties;
  id?: string;
  role?: AriaRole;
  'aria-label'?: string;
  'aria-labelledby'?: string;
  'data-testid'?: string;
}

export default function MetricTile({
  label,
  value,
  detail,
  className,
  style,
  id,
  role,
  'aria-label': ariaLabel,
  'aria-labelledby': ariaLabelledBy,
  'data-testid': dataTestId,
}: MetricTileProps) {
  return (
    <div
      id={id}
      role={role}
      className={className}
      data-testid={dataTestId}
      aria-label={ariaLabel}
      aria-labelledby={ariaLabelledBy}
      style={{
        minHeight: 86,
        border: '1px solid var(--border-subtle)',
        borderRadius: 'var(--ds-panel-radius)',
        background: 'var(--bg-card-hover)',
        padding: 'var(--ds-panel-densePadding)',
        ...style,
      }}
    >
      <Text
        style={{
          display: 'block',
          fontSize: 'var(--ds-type-metadata-size)',
          color: 'var(--text-secondary)',
          lineHeight: 1.4,
        }}
      >
        {label}
      </Text>
      <div
        style={{
          marginTop: 6,
          fontSize: 'var(--ds-type-cardTitle-size)',
          fontWeight: 650,
          lineHeight: 1.35,
          color: 'var(--text-primary)',
        }}
      >
        {value}
      </div>
      {detail != null && (
        <Text type="secondary" style={{ display: 'block', marginTop: 4 }}>
          {detail}
        </Text>
      )}
    </div>
  );
}
