// TODO: BEM-migrate
'use client';

import { Button, Space } from 'antd';

export interface AppBarAction {
  key: string;
  label: string;
  icon?: React.ReactNode;
  onClick: () => void;
  type?: 'primary' | 'default';
}

interface Props {
  actions: AppBarAction[];
}

export default function AppBarActions({ actions }: Props) {
  if (actions.length === 0) return null;

  return (
    <Space size="small">
      {actions.map((action) => (
        <Button
          key={action.key}
          type={action.type === 'primary' ? 'primary' : 'default'}
          icon={action.icon}
          onClick={action.onClick}
          size="small"
        >
          {action.label}
        </Button>
      ))}
    </Space>
  );
}