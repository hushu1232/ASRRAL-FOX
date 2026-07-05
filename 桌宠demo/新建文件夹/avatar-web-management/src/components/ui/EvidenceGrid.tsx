import type { CSSProperties, ReactNode } from 'react';

export interface EvidenceGridProps {
  children: ReactNode;
  minWidth?: string;
  gap?: number;
  className?: string;
  style?: CSSProperties;
  'data-testid'?: string;
}

export default function EvidenceGrid({
  children,
  minWidth = 'var(--ds-panel-gridMinWidth)',
  gap = 12,
  className,
  style,
  'data-testid': dataTestId,
}: EvidenceGridProps) {
  return (
    <div
      className={className}
      data-testid={dataTestId}
      style={{
        display: 'grid',
        gap,
        gridTemplateColumns: `repeat(auto-fit, minmax(${minWidth}, 1fr))`,
        ...style,
      }}
    >
      {children}
    </div>
  );
}
