import { Empty, Button } from 'antd';
import type { ReactNode } from 'react';

interface Props {
  description?: ReactNode;
  icon?: ReactNode;
  actionLabel?: string;
  onAction?: () => void;
  variant?: 'default' | 'compact';
}

export default function EmptyState({
  description,
  icon,
  actionLabel,
  onAction,
  variant = 'default',
}: Props) {
  const densityClass = variant === 'compact' ? 'min-h-[120px] py-8' : 'min-h-[160px] py-16';
  const resolvedDescription = description ? (
    <span style={{ color: 'var(--text-secondary)' }}>{description}</span>
  ) : false;

  return (
    <div
      data-testid="empty-state"
      className={`flex min-w-0 items-center justify-center ${densityClass}`}
    >
      <Empty image={icon || Empty.PRESENTED_IMAGE_SIMPLE} description={resolvedDescription}>
        {actionLabel && onAction && (
          <Button type="primary" onClick={onAction}>
            {actionLabel}
          </Button>
        )}
      </Empty>
    </div>
  );
}
