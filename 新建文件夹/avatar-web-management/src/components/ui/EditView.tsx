import type { ReactNode } from 'react';
import { Button, Space } from 'antd';
import PageTitle from './PageTitle';

interface Props {
  title: string;
  subtitle?: string;
  onSave: () => void;
  onCancel: () => void;
  saveLabel?: string;
  cancelLabel?: string;
  loading?: boolean;
  children: ReactNode;
}

export default function EditView({
  title,
  subtitle,
  onSave,
  onCancel,
  saveLabel = 'Save',
  cancelLabel = 'Cancel',
  loading,
  children,
}: Props) {
  return (
    <div className="max-w-3xl mx-auto">
      <PageTitle
        title={title}
        subtitle={subtitle}
        actions={
          <Space>
            <Button onClick={onCancel}>{cancelLabel}</Button>
            <Button type="primary" onClick={onSave} loading={loading}>
              {saveLabel}
            </Button>
          </Space>
        }
      />
      <div
        className="p-6 rounded-lg"
        style={{ background: 'var(--bg-card)', border: '1px solid var(--border-subtle)' }}
      >
        {children}
      </div>
    </div>
  );
}
