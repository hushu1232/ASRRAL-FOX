// TODO: BEM-migrate
import type { ReactNode } from 'react';
import PageTitle from './PageTitle';
import EmptyState from './EmptyState';

interface Props {
  title: string;
  subtitle?: string;
  actions?: ReactNode;
  filters?: ReactNode;
  bulkActions?: ReactNode;
  empty?: boolean;
  emptyDescription?: string;
  onCreateAction?: () => void;
  createLabel?: string;
  children: ReactNode;
}

export default function ListView({
  title,
  subtitle,
  actions,
  filters,
  bulkActions,
  empty,
  emptyDescription,
  onCreateAction,
  createLabel,
  children,
}: Props) {
  return (
    <div>
      <PageTitle title={title} subtitle={subtitle} actions={actions} />
      {filters}
      {bulkActions}
      {empty ? (
        <EmptyState
          description={emptyDescription || `No ${title.toLowerCase()} found`}
          actionLabel={createLabel}
          onAction={onCreateAction}
        />
      ) : (
        children
      )}
    </div>
  );
}