/**
 * @jest-environment jsdom
 */

import { render, screen } from '@testing-library/react';
import Live2DViewer from '@/components/live2d/Live2DViewer';

jest.mock('@/lib/live2d/cubism5.js', () => ({
  AppDelegate: class MockAppDelegate {
    initialize() {}
    run() {}
    stop() {}
    release() {}
    changeModel(_path: string) {}
  },
}));

describe('Live2DViewer', () => {
  beforeAll(() => {
    (window as any).Live2DCubismCore = {};
    Object.defineProperty(window, 'devicePixelRatio', { value: 2, configurable: true });
  });

  it('renders loading state initially', () => {
    render(<Live2DViewer modelUrl="/test.model3.json" />);
    expect(screen.getByText('loading')).toBeDefined();
  });

  it('renders canvas element', () => {
    render(<Live2DViewer modelUrl="/test.model3.json" />);
    expect(document.querySelector('canvas')).toBeDefined();
  });

  it('sets canvas dimensions from props', () => {
    render(<Live2DViewer modelUrl="/test.model3.json" width={300} height={400} />);
    const canvas = document.querySelector('canvas')!;
    expect(canvas.style.width).toBe('300px');
    expect(canvas.style.height).toBe('400px');
  });

  it('shows grab cursor when interactive', () => {
    render(<Live2DViewer modelUrl="/test.model3.json" interactive={true} />);
    expect(document.querySelector('canvas')!.style.cursor).toBe('grab');
  });

  it('shows default cursor when non-interactive', () => {
    render(<Live2DViewer modelUrl="/test.model3.json" interactive={false} />);
    expect(document.querySelector('canvas')!.style.cursor).toBe('default');
  });
});
