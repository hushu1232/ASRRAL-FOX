/**
 * @jest-environment jsdom
 */

import { render, screen } from '@testing-library/react';
import { App } from 'antd';
import PipelineProgress from '@/components/rigging/PipelineProgress';

class MockWebSocket {
  static OPEN = 1;
  static CONNECTING = 0;
  readyState = MockWebSocket.OPEN;
  onopen: (() => void) | null = null;
  onclose: (() => void) | null = null;
  onerror: (() => void) | null = null;
  onmessage: ((event: { data: string }) => void) | null = null;
  send = jest.fn();
  close = jest.fn();
}
(global as any).WebSocket = MockWebSocket;

global.fetch = jest.fn().mockResolvedValue({
  ok: true,
  json: () => Promise.resolve({ success: true, data: null }),
});

jest.mock('next-intl', () => ({
  useTranslations: (ns: string) => {
    const keys: Record<string, Record<string, string>> = {
      'rigging': { generationFailed: '生成失败' },
      'rigging.stages': {
        uploading: '上传中', separating: '图层分离', rigging: '骨骼绑定',
        exporting: 'Cubism导出', pulling_assets: '拉取资产', deploying: '部署',
      },
      'rigging.progress': {
        title: 'AI生成中', estimatedRemaining: '预计剩余 {seconds}s',
        unknownError: '未知错误', complete: '生成完成',
        totalTime: '总耗时 {seconds}s', wsDisconnected: '连接断开',
      },
    };
    return (key: string) => keys[ns]?.[key] ?? key;
  },
}));

jest.mock('@ant-design/icons', () => ({
  LoadingOutlined: () => <span data-testid="icon-loading" />,
  CheckCircleOutlined: () => <span data-testid="icon-check" />,
  CloseCircleOutlined: () => <span data-testid="icon-close" />,
}));

function Wrapper({ children }: { children: React.ReactNode }) {
  return <App>{children}</App>;
}

describe('PipelineProgress', () => {
  beforeEach(() => jest.clearAllMocks());

  it('renders title', () => {
    render(<PipelineProgress imageId="img_001" />, { wrapper: Wrapper });
    expect(screen.getByText('AI生成中')).toBeDefined();
  });

  it('renders stage steps', () => {
    render(<PipelineProgress imageId="img_001" />, { wrapper: Wrapper });
    expect(screen.getByText('上传中')).toBeDefined();
    expect(screen.getByText('图层分离')).toBeDefined();
    expect(screen.getByText('骨骼绑定')).toBeDefined();
    expect(screen.getByText('Cubism导出')).toBeDefined();
  });

  it('renders preview image when previewUrl provided', () => {
    render(<PipelineProgress imageId="img_001" previewUrl="/preview/test.png" />, { wrapper: Wrapper });
    const img = document.querySelector('img');
    expect(img).toBeDefined();
    expect(img?.getAttribute('src')).toBe('/preview/test.png');
  });
});
