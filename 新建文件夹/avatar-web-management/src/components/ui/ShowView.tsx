import type { ReactNode } from 'react';
import { Button, Space } from 'antd';
import { EditOutlined } from '@ant-design/icons';
import PageTitle from './PageTitle';

interface Props {
  title: string;
  subtitle?: string;
  onEdit?: () => void;
  extraActions?: ReactNode;
  children: ReactNode;
}

export default function ShowView({ title, subtitle, onEdit, extraActions, children }: Props) {
  return (
    <div className="max-w-3xl mx-auto">
      <PageTitle
        title={title}
        subtitle={subtitle}
        actions={
          <Space>
            {extraActions}
            {onEdit && (
              <Button type="primary" icon={<EditOutlined />} onClick={onEdit}>
                Edit
              </Button>
            )}
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
