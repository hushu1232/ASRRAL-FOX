/**
 * @jest-environment jsdom
 */

import { render, screen, fireEvent, waitFor, act } from '@testing-library/react';
import { App } from 'antd';
import AssetPickerModal from '@/components/market/AssetPickerModal';

jest.mock('@/lib/api-client', () => ({
  apiGet: jest.fn(),
}));

jest.mock('next/image', () => ({
  __esModule: true,
  default: (props: any) => {
    const React = require('react');
    const { fill, priority, unoptimized, placeholder, blurDataURL, quality, loader, sizes, onLoad, onError, ...rest } = props;
    void fill; void priority; void unoptimized; void placeholder; void blurDataURL; void quality; void loader; void sizes; void onLoad; void onError;
    return React.createElement('img', rest);
  },
}));

const { apiGet } = require('@/lib/api-client');

function Wrapper({ children }: { children: React.ReactNode }) {
  return <App>{children}</App>;
}

const mockItems = [
  { id: 'as1', filename: 'model_a.fbx', asset_type: 'model', format: 'fbx', file_size: 2048, storage_path: '/models/a.fbx', created_at: '2026-05-01' },
  { id: 'as2', filename: 'texture_b.png', asset_type: 'texture', format: 'png', file_size: 512, storage_path: '/textures/b.png', created_at: '2026-05-02' },
  { id: 'as3', filename: 'anim_c.fbx', asset_type: 'animation', format: 'fbx', file_size: 4096, storage_path: '/anims/c.fbx', created_at: '2026-05-03' },
];

function setupDeferredApi() {
  let resolve: (value: any) => void;
  const deferred = new Promise<any>(r => { resolve = r; });
  apiGet.mockReturnValue(deferred);
  return resolve!;
}

describe('AssetPickerModal', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('renders modal title when open', () => {
    apiGet.mockReturnValue(new Promise(() => {}));
    render(<AssetPickerModal open={true} onClose={jest.fn()} onSelect={jest.fn()} />, { wrapper: Wrapper });
    expect(screen.getByText('picker.title')).toBeDefined();
  });

  it('renders asset items in a grid', async () => {
    const resolve = setupDeferredApi();
    render(<AssetPickerModal open={true} onClose={jest.fn()} onSelect={jest.fn()} />, { wrapper: Wrapper });

    await waitFor(() => { expect(apiGet).toHaveBeenCalled(); });

    await act(async () => {
      resolve({ success: true, data: { items: mockItems, total: 3, page: 1, pageSize: 100, totalPages: 1 } });
    });

    expect(screen.getByText('model_a.fbx')).toBeDefined();
    expect(screen.getByText('texture_b.png')).toBeDefined();
    expect(screen.getByText('anim_c.fbx')).toBeDefined();
  });

  it('selects and deselects assets on click', async () => {
    const resolve = setupDeferredApi();
    render(<AssetPickerModal open={true} onClose={jest.fn()} onSelect={jest.fn()} />, { wrapper: Wrapper });

    await waitFor(() => { expect(apiGet).toHaveBeenCalled(); });

    await act(async () => {
      resolve({ success: true, data: { items: mockItems, total: 3, page: 1, pageSize: 100, totalPages: 1 } });
    });

    const card = screen.getByText('model_a.fbx').closest('.ant-card')!;
    fireEvent.click(card);
    expect(card.className).toContain('bg-purple-500/5');

    fireEvent.click(card);
    expect(card.className).not.toContain('bg-purple-500/5');
  });

  it('calls onSelect with selected storage paths on confirm', async () => {
    const resolve = setupDeferredApi();
    const onSelect = jest.fn();
    render(<AssetPickerModal open={true} onClose={jest.fn()} onSelect={onSelect} />, { wrapper: Wrapper });

    await waitFor(() => { expect(apiGet).toHaveBeenCalled(); });

    await act(async () => {
      resolve({ success: true, data: { items: mockItems, total: 3, page: 1, pageSize: 100, totalPages: 1 } });
    });

    fireEvent.click(screen.getByText('model_a.fbx').closest('.ant-card')!);
    fireEvent.click(screen.getByText('picker.confirm'));

    expect(onSelect).toHaveBeenCalledWith(['/models/a.fbx']);
  });

  it('shows empty state when no assets', async () => {
    const resolve = setupDeferredApi();
    render(<AssetPickerModal open={true} onClose={jest.fn()} onSelect={jest.fn()} />, { wrapper: Wrapper });

    await waitFor(() => { expect(apiGet).toHaveBeenCalled(); });

    await act(async () => {
      resolve({ success: true, data: { items: [], total: 0, page: 1, pageSize: 100, totalPages: 0 } });
    });

    expect(screen.getByText('noAssets')).toBeDefined();
  });

  it('filters assets by type', async () => {
    const resolve = setupDeferredApi();
    render(<AssetPickerModal open={true} onClose={jest.fn()} onSelect={jest.fn()} filterType="model" />, { wrapper: Wrapper });

    await waitFor(() => { expect(apiGet).toHaveBeenCalled(); });

    await act(async () => {
      resolve({ success: true, data: { items: mockItems, total: 3, page: 1, pageSize: 100, totalPages: 1 } });
    });

    expect(screen.getByText('model_a.fbx')).toBeDefined();
    expect(screen.queryByText('texture_b.png')).toBeNull();
    expect(screen.queryByText('anim_c.fbx')).toBeNull();
  });
});
