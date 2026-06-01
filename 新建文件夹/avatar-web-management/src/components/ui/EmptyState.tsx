import { Empty, Button } from 'antd';
import type { ReactNode } from 'react';

interface Props {
  description?: string;
  icon?: ReactNode;
  actionLabel?: string;
  onAction?: () => void;
  variant?: 'default' | 'compact';
}

export default function EmptyState({
  description = 'No data available',
  icon,
  actionLabel,
  onAction,
  variant = 'default',
}: Props) {
  return (
    <div
      className={`flex items-center justify-center ${variant === 'compact' ? 'py-8' : 'py-16'}`}
    >
      <Empty
        image={icon || Empty.PRESENTED_IMAGE_SIMPLE}
        description={<span style={{ color: 'var(--text-secondary)' }}>{description}</span>}
      >
        {actionLabel && onAction && (
          <Button type="primary" onClick={onAction}>
            {actionLabel}
          </Button>
        )}
      </Empty>
    </div>
  );
}
