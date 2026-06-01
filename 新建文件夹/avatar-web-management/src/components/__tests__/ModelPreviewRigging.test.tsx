/**
 * @jest-environment jsdom
 */

import { render, screen, fireEvent } from '@testing-library/react';
import { App } from 'antd';
import ModelPreview from '@/components/rigging/ModelPreview';

jest.mock('next-intl', () => ({
  useTranslations: (ns: string) => {
    const keys: Record<string, Record<string, string>> = {
      'rigging.preview': {
        title: '生成结果', downloadModel: '下载模型',
        setAsPet: '设为桌宠', publishToMarket: '发布到市场',
        regenerate: '重新生成', template: '模板',
        mesh: '网格密度', duration: '总耗时', modelId: '模型ID',
        setAsPetSuccess: '已设为桌宠', setFailed: '设置失败',
        setFailedRetry: '设置失败，请重试',
      },
      'rigging.templates': { catgirl: '猫娘', human_female: '女性', human_male: '男性' },
      'rigging.mesh': { low: '低', medium: '中', high: '高' },
    };
    return (key: string) => keys[ns]?.[key] ?? key;
  },
}));

jest.mock('@ant-design/icons', () => ({
  DownloadOutlined: () => <span data-testid="icon-download" />,
  PlaySquareOutlined: () => <span data-testid="icon-play-square" />,
  ShoppingCartOutlined: () => <span data-testid="icon-cart" />,
  ReloadOutlined: () => <span data-testid="icon-reload" />,
}));

function Wrapper({ children }: { children: React.ReactNode }) {
  return <App>{children}</App>;
}

const mockResult = {
  modelId: 'model_001',
  previewUrl: '/models/model_001/preview.png',
  moc3Url: '/models/model_001/model.moc3',
  totalTimeMs: 48000,
};

describe('ModelPreview (Rigging)', () => {
  const baseProps = {
    result: mockResult,
    template: 'catgirl',
    meshDensity: 'medium',
    onReset: jest.fn(),
  };

  beforeEach(() => {
    jest.clearAllMocks();
    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ success: true }),
    });
  });

  it('renders title', () => {
    render(<ModelPreview {...baseProps} />, { wrapper: Wrapper });
    expect(screen.getByText('生成结果')).toBeDefined();
  });

  it('renders template and mesh density labels', () => {
    render(<ModelPreview {...baseProps} />, { wrapper: Wrapper });
    expect(screen.getByText('猫娘')).toBeDefined();
    expect(screen.getByText('中')).toBeDefined();
  });

  it('renders labels for template, mesh, duration', () => {
    render(<ModelPreview {...baseProps} />, { wrapper: Wrapper });
    expect(screen.getByText('模板')).toBeDefined();
    expect(screen.getByText('网格密度')).toBeDefined();
    expect(screen.getByText('总耗时')).toBeDefined();
  });

  it('renders action buttons', () => {
    render(<ModelPreview {...baseProps} />, { wrapper: Wrapper });
    expect(screen.getByText('下载模型')).toBeDefined();
    expect(screen.getByText('设为桌宠')).toBeDefined();
    expect(screen.getByText('发布到市场')).toBeDefined();
  });

  it('renders regenerate button', () => {
    render(<ModelPreview {...baseProps} />, { wrapper: Wrapper });
    expect(screen.getByText('重新生成')).toBeDefined();
  });

  it('calls onReset on regenerate click', () => {
    const onReset = jest.fn();
    render(<ModelPreview {...baseProps} onReset={onReset} />, { wrapper: Wrapper });
    fireEvent.click(screen.getByText('重新生成'));
    expect(onReset).toHaveBeenCalled();
  });

  it('shows preview image', () => {
    render(<ModelPreview {...baseProps} />, { wrapper: Wrapper });
    const img = document.querySelector('img');
    expect(img).toBeDefined();
    expect(img?.getAttribute('src')).toBe('/models/model_001/preview.png');
  });
});
