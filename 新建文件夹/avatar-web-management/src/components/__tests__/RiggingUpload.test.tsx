/**
 * @jest-environment jsdom
 */

import { render, screen } from '@testing-library/react';
import { App } from 'antd';
import RiggingUpload from '@/components/rigging/RiggingUpload';

jest.mock('next-intl', () => ({
  useTranslations: (ns: string) => {
    const keys: Record<string, Record<string, string>> = {
      'rigging.upload': {
        title: '上传插画', description: '上传角色插画',
        dragText: '点击或拖拽上传', dragHint: '支持PNG/JPEG，最大10MB',
        uploading: '上传中', uploadToAI: '上传到AI服务',
        uploaded: '上传完成', generateOptions: '生成选项',
        skeletonTemplate: '骨骼模板', meshDensity: '网格密度',
        startGeneration: '开始生成', uploadSuccess: '上传成功',
        uploadFailed: '上传失败', unsupportedFormat: '不支持的格式',
        fileTooLarge: '文件太大',
      },
      'rigging.templates': { catgirl: '猫娘', human_female: '女性', human_male: '男性' },
      'rigging.mesh': { low: '低', medium: '中', high: '高' },
    };
    return (key: string) => keys[ns]?.[key] ?? key;
  },
}));

jest.mock('@ant-design/icons', () => ({
  InboxOutlined: () => <span data-testid="icon-inbox" />,
  ThunderboltOutlined: () => <span data-testid="icon-thunderbolt" />,
}));

function Wrapper({ children }: { children: React.ReactNode }) {
  return <App>{children}</App>;
}

describe('RiggingUpload', () => {
  const baseProps = { onPipelineStart: jest.fn() };

  beforeEach(() => jest.clearAllMocks());

  describe('rendering', () => {
    it('renders title and description', () => {
      render(<RiggingUpload {...baseProps} />, { wrapper: Wrapper });
      expect(screen.getByText('上传插画')).toBeDefined();
      expect(screen.getByText('上传角色插画')).toBeDefined();
    });

    it('renders upload dragger area', () => {
      render(<RiggingUpload {...baseProps} />, { wrapper: Wrapper });
      expect(screen.getByText('点击或拖拽上传')).toBeDefined();
      expect(screen.getByText('支持PNG/JPEG，最大10MB')).toBeDefined();
    });

    it('renders template selector label', () => {
      render(<RiggingUpload {...baseProps} />, { wrapper: Wrapper });
      expect(screen.getByText('骨骼模板')).toBeDefined();
      expect(screen.getByText('猫娘')).toBeDefined();
    });

    it('renders mesh density label', () => {
      render(<RiggingUpload {...baseProps} />, { wrapper: Wrapper });
      expect(screen.getByText('网格密度')).toBeDefined();
      expect(screen.getByText('中')).toBeDefined();
    });

    it('renders start generation button', () => {
      render(<RiggingUpload {...baseProps} />, { wrapper: Wrapper });
      expect(screen.getByText('开始生成')).toBeDefined();
    });
  });

  describe('button states', () => {
    it('disables start button when no file uploaded', () => {
      render(<RiggingUpload {...baseProps} />, { wrapper: Wrapper });
      const btn = screen.getByText('开始生成').closest('button')!;
      expect(btn).toBeDisabled();
    });

    it('disables button when disabled prop is set', () => {
      render(<RiggingUpload {...baseProps} disabled />, { wrapper: Wrapper });
      const btn = screen.getByText('开始生成').closest('button')!;
      expect(btn).toBeDisabled();
    });
  });
});
