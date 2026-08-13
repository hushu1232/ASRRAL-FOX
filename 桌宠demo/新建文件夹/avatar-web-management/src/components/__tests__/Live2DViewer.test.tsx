/**
 * @jest-environment jsdom
 */

import { act, render, screen, waitFor } from '@testing-library/react';
import Live2DViewer from '@/components/live2d/Live2DViewer';

const mockEnsureCoreLoaded = jest.fn();
const mockCreateAppDelegate = jest.fn();
const mockAttachCanvas = jest.fn();

jest.mock('@/lib/live2d/adapter', () => ({
  ensureCoreLoaded: (...args: unknown[]) => mockEnsureCoreLoaded(...args),
  createAppDelegate: (...args: unknown[]) => mockCreateAppDelegate(...args),
  attachCanvas: (...args: unknown[]) => mockAttachCanvas(...args),
  dispatchPointerMove: jest.fn(),
  dispatchPointerDown: jest.fn(),
  dispatchPointerUp: jest.fn(),
}));

function createDelegate() {
  return {
    initialize: jest.fn(),
    changeModel: jest.fn(),
    run: jest.fn(),
    stop: jest.fn(),
    release: jest.fn(),
  };
}

function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>(res => { resolve = res; });
  return { promise, resolve };
}

describe('Live2DViewer', () => {
  beforeAll(() => {
    (window as any).Live2DCubismCore = {};
    Object.defineProperty(window, 'devicePixelRatio', { value: 2, configurable: true });
  });

  beforeEach(() => {
    mockEnsureCoreLoaded.mockReset();
    mockCreateAppDelegate.mockReset();
    mockAttachCanvas.mockReset();
    mockEnsureCoreLoaded.mockReturnValue(new Promise(() => {}));
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

  it('releases the active delegate when unmounted', async () => {
    const delegate = createDelegate();
    mockEnsureCoreLoaded.mockResolvedValue(undefined);
    mockCreateAppDelegate.mockResolvedValue(delegate);
    const { unmount } = render(<Live2DViewer modelUrl="/test.model3.json" />);

    await waitFor(() => expect(delegate.run).toHaveBeenCalled());
    unmount();

    expect(delegate.stop).toHaveBeenCalledTimes(1);
    expect(delegate.release).toHaveBeenCalledTimes(1);
  });

  it('releases a delegate created after the viewer was unmounted', async () => {
    const delegate = createDelegate();
    const delegateDeferred = deferred<ReturnType<typeof createDelegate>>();
    mockEnsureCoreLoaded.mockResolvedValue(undefined);
    mockCreateAppDelegate.mockReturnValue(delegateDeferred.promise);
    const { unmount } = render(<Live2DViewer modelUrl="/test.model3.json" />);

    await waitFor(() => expect(mockCreateAppDelegate).toHaveBeenCalled());
    unmount();
    await act(async () => delegateDeferred.resolve(delegate));

    expect(delegate.release).toHaveBeenCalledTimes(1);
    expect(delegate.run).not.toHaveBeenCalled();
    expect(mockAttachCanvas).not.toHaveBeenCalled();
  });

  it('reports initialization failures without leaving a delegate active', async () => {
    const onError = jest.fn();
    mockEnsureCoreLoaded.mockRejectedValue(new Error('Core unavailable'));
    render(<Live2DViewer modelUrl="/test.model3.json" onError={onError} />);

    await waitFor(() => expect(mockEnsureCoreLoaded).toHaveBeenCalled());
    await waitFor(() => expect(onError).toHaveBeenCalled());
    expect(mockEnsureCoreLoaded).toHaveBeenCalledTimes(1);
    expect(onError).toHaveBeenCalledWith(expect.objectContaining({ message: 'Core unavailable' }));
  });
});
