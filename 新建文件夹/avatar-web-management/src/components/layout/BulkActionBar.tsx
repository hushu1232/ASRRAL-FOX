'use client';

import { Button, Space, Typography } from 'antd';
import { CloseOutlined } from '@ant-design/icons';

interface BulkAction {
  key: string;
  label: string;
  onClick: (selectedIds: string[]) => void;
  danger?: boolean;
}

interface Props {
  selectedCount: number;
  selectedIds: string[];
  actions: BulkAction[];
  onClear: () => void;
}

export default function BulkActionBar({ selectedCount, selectedIds, actions, onClear }: Props) {
  if (selectedCount === 0) return null;

  return (
    <div
      className="flex items-center justify-between px-4 py-3 rounded-lg mb-4"
      style={{
        background: 'var(--accent)',
        color: '#ffffff',
      }}
    >
      <Typography.Text style={{ color: '#ffffff' }}>
        {selectedCount} selected
      </Typography.Text>
      <Space size="small">
        {actions.map((action) => (
          <Button
            key={action.key}
            size="small"
            danger={action.danger}
            onClick={() => { action.onClick(selectedIds); onClear(); }}
            ghost={!action.danger}
          >
            {action.label}
          </Button>
        ))}
        <Button
          size="small"
          type="text"
          icon={<CloseOutlined />}
          onClick={onClear}
          style={{ color: '#ffffff' }}
        />
      </Space>
    </div>
  );
}
