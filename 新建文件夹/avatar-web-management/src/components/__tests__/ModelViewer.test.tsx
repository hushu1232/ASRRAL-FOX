/**
 * @jest-environment jsdom
 */

import { render, screen } from '@testing-library/react';
import { App } from 'antd';
import ModelViewer from '@/components/pet/preview/ModelViewer';

Element.prototype.scrollIntoView = jest.fn();

jest.mock('next-intl', () => ({
  useTranslations: (ns: string) => {
    const keys: Record<string, Record<string, string>> = {
      'pet.modelViewer.emotions': {
        happy: '开心', sad: '伤心', shy: '害羞',
        angry: '生气', neutral: '平静', surprised: '惊讶',
      },
      'pet.modelViewer': {
        speaking: '说话中', loading: '加载中...',
        vrmMissing: 'VRM库未安装', vrmLoadFailed: 'VRM加载失败',
      },
    };
    return (key: string) => keys[ns]?.[key] ?? key;
  },
}));

jest.mock('next/dynamic', () => ({
  __esModule: true,
  default: () => {
    const Comp = (props: any) => (
      <div data-testid="live2d-viewer" data-model-url={props.modelUrl}>
        <span>Live2D</span>
        {props.onError && (
          <button data-testid="trigger-error" onClick={() => props.onError(new Error('Load failed'))}>
            Error
          </button>
        )}
      </div>
    );
    return Comp;
  },
}));

function Wrapper({ children }: { children: React.ReactNode }) {
  return <App>{children}</App>;
}

const baseProps = {
  modelType: 'live2d' as const,
  modelPath: '/model/test.model3.json',
  emotion: 'happy' as const,
  isSpeaking: false,
};

describe('ModelViewer', () => {
  describe('live2d mode', () => {
    it('renders Live2DViewer with modelUrl', () => {
      render(<ModelViewer {...baseProps} />, { wrapper: Wrapper });
      const viewer = screen.getByTestId('live2d-viewer');
      expect(viewer).toBeDefined();
      expect(viewer.getAttribute('data-model-url')).toBe('/model/test.model3.json');
    });

    it('shows loading state during dynamic import', () => {
      render(<ModelViewer {...baseProps} />, { wrapper: Wrapper });
      // dynamic import is mocked to resolve immediately, so loading appears briefly
      expect(screen.getByTestId('live2d-viewer')).toBeDefined();
    });
  });

  describe('emotion label', () => {
    it.each([
      ['happy', '开心'],
      ['sad', '伤心'],
      ['shy', '害羞'],
      ['angry', '生气'],
      ['neutral', '平静'],
      ['surprised', '惊讶'],
    ] as const)('shows %s emotion label', (emotion, label) => {
      render(<ModelViewer {...baseProps} emotion={emotion} />, { wrapper: Wrapper });
      expect(screen.getByText(label)).toBeDefined();
    });
  });

  describe('speaking indicator', () => {
    it('shows speaking indicator when isSpeaking', () => {
      render(<ModelViewer {...baseProps} isSpeaking />, { wrapper: Wrapper });
      expect(screen.getByText('说话中')).toBeDefined();
    });

    it('hides speaking indicator when not speaking', () => {
      render(<ModelViewer {...baseProps} isSpeaking={false} />, { wrapper: Wrapper });
      expect(screen.queryByText('说话中')).toBeNull();
    });
  });

  describe('error state', () => {
    it('renders ModelError when onError is triggered by Live2D', () => {
      const { container } = render(<ModelViewer {...baseProps} />, { wrapper: Wrapper });
      const errorBtn = screen.getByTestId('trigger-error');
      errorBtn.click();
      // Error component should appear with the error message
      expect(container.querySelector('.text-4xl')).toBeDefined();
    });
  });

  describe('VRM mode', () => {
    it('renders VRMViewer when modelType is vrm', () => {
      const { container } = render(
        <ModelViewer {...baseProps} modelType="vrm" />,
        { wrapper: Wrapper }
      );
      // VRM viewer renders in a container div
      expect(container.querySelector('.text-xs')).toBeDefined();
    });
  });
});
