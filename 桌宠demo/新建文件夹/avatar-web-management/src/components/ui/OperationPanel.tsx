import type { CSSProperties, ReactNode } from 'react';
import { Card } from 'antd';
import type { CardProps } from 'antd';

export interface OperationPanelProps extends Omit<
  CardProps,
  'title' | 'extra' | 'children' | 'styles' | 'headStyle' | 'bodyStyle' | 'bordered'
> {
  title: ReactNode;
  extra?: ReactNode;
  children: ReactNode;
  className?: string;
  style?: CSSProperties;
}

export default function OperationPanel({
  title,
  extra,
  children,
  className,
  style,
  ...cardProps
}: OperationPanelProps) {
  return (
    <Card
      {...cardProps}
      title={title}
      extra={extra}
      className={className}
      style={{
        borderRadius: 'var(--ds-panel-radius)',
        background: 'var(--bg-card)',
        borderColor: 'var(--border-subtle)',
        ...style,
      }}
      styles={{
        header: {
          minHeight: 52,
          borderColor: 'var(--border-subtle)',
        },
        body: {
          background: 'var(--bg-card)',
          padding: 'var(--ds-panel-comfortablePadding, 20px)',
        },
      }}
    >
      {children}
    </Card>
  );
}
