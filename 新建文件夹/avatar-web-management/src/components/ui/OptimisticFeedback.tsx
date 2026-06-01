'use client';

import { useEffect } from 'react';
import { Button, App } from 'antd';
import { UndoOutlined } from '@ant-design/icons';

interface Props {
  visible: boolean;
  successMessage: string;
  onUndo?: () => void;
  duration?: number;
}

export default function OptimisticFeedback({ visible, successMessage, onUndo, duration = 5 }: Props) {
  const { message: msgApi } = App.useApp();

  useEffect(() => {
    if (!visible) return;

    const key = `optimistic-${Date.now()}`;
    msgApi.success({
      content: (
        <span>
          {successMessage}
          {onUndo && (
            <Button
              type="link"
              size="small"
              icon={<UndoOutlined />}
              onClick={() => {
                onUndo();
                msgApi.destroy(key);
              }}
              style={{ marginLeft: 8 }}
            >
              Undo
            </Button>
          )}
        </span>
      ),
      key,
      duration,
    });
  }, [visible, successMessage, onUndo, duration, msgApi]);

  return null;
}
