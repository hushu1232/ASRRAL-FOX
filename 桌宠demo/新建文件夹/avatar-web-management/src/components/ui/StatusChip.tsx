import type { ReactNode } from 'react';
import { Tag } from 'antd';
import type { TagProps } from 'antd';

export type StatusChipTone = 'neutral' | 'success' | 'warning' | 'error' | 'processing';

const TONE_COLORS: Record<StatusChipTone, string> = {
  neutral: 'default',
  success: 'success',
  warning: 'warning',
  error: 'error',
  processing: 'processing',
};

export interface StatusChipProps extends Omit<
  TagProps,
  'color' | 'children' | 'bordered' | 'prefixCls'
> {
  tone: StatusChipTone;
  children: ReactNode;
}

export default function StatusChip({ tone, children, style, ...tagProps }: StatusChipProps) {
  return (
    <Tag
      {...tagProps}
      color={TONE_COLORS[tone]}
      style={{
        borderRadius: 'var(--ds-control-pillRadius)',
        fontWeight: 600,
        marginInlineEnd: 0,
        ...style,
      }}
    >
      {children}
    </Tag>
  );
}
