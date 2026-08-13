/**
 * @jest-environment jsdom
 */

import { render, screen, fireEvent } from '@testing-library/react';
import { App } from 'antd';
import AssetPickerModal from '@/components/market/AssetPickerModal';

const mockUseApiPaginated = jest.fn();

jest.mock('@/lib/use-api', () => ({
  useApiPaginated: (...args: unknown[]) => mockUseApiPaginated(...args),
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

function Wrapper({ children }: { children: React.ReactNode }) {
  return <App>{children}</App>;
}

const mockItems = [
  { id: 'as1', filename: 'model_a.fbx', asset_type: 'model', format: 'fbx', file_size: 2048, storage_path: '/models/a.fbx', created_at: '2026-05-01' },
  { id: 'as2', filename: 'texture_b.png', asset_type: 'texture', format: 'png', file_size: 512, storage_path: '/textures/b.png', created_at: '2026-05-02' },
  { id: 'as3', filename: 'anim_c.fbx', asset_type: 'animation', format: 'fbx', file_size: 4096, storage_path: '/anims/c.fbx', created_at: '2026-05-03' },
];

describe('AssetPickerModal', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockUseApiPaginated.mockReturnValue({
      data: { success: true, data: { items: mockItems, total: 3 } },
      isLoading: false,
      error: undefined,
    });
  });

  it('renders modal title when open', () => {
    render(<AssetPickerModal open={true} onClose={jest.fn()} onSelect={jest.fn()} />, { wrapper: Wrapper });
    expect(screen.getByText('picker.title')).toBeDefined();
    expect(mockUseApiPaginated).toHaveBeenCalledWith('/api/assets', { pageSize: '100' });
  });

  it('renders asset items in a grid', () => {
    render(<AssetPickerModal open={true} onClose={jest.fn()} onSelect={jest.fn()} />, { wrapper: Wrapper });

    expect(screen.getByText('model_a.fbx')).toBeDefined();
    expect(screen.getByText('texture_b.png')).toBeDefined();
    expect(screen.getByText('anim_c.fbx')).toBeDefined();
  });

  it('selects and deselects assets on click', () => {
    render(<AssetPickerModal open={true} onClose={jest.fn()} onSelect={jest.fn()} />, { wrapper: Wrapper });

    const card = screen.getByText('model_a.fbx').closest('.ant-card')!;
    fireEvent.click(card);
    expect(card.className).toContain('bg-purple-500/5');

    fireEvent.click(card);
    expect(card.className).not.toContain('bg-purple-500/5');
  });

  it('calls onSelect with selected storage paths on confirm', () => {
    const onSelect = jest.fn();
    render(<AssetPickerModal open={true} onClose={jest.fn()} onSelect={onSelect} />, { wrapper: Wrapper });

    fireEvent.click(screen.getByText('model_a.fbx').closest('.ant-card')!);
    fireEvent.click(screen.getByText('picker.confirm'));

    expect(onSelect).toHaveBeenCalledWith(['/models/a.fbx']);
  });

  it('shows empty state when no assets', () => {
    mockUseApiPaginated.mockReturnValue({
      data: { success: true, data: { items: [], total: 0 } },
      isLoading: false,
      error: undefined,
    });
    render(<AssetPickerModal open={true} onClose={jest.fn()} onSelect={jest.fn()} />, { wrapper: Wrapper });

    expect(screen.getByText('noAssets')).toBeDefined();
  });

  it('filters assets by type', () => {
    render(<AssetPickerModal open={true} onClose={jest.fn()} onSelect={jest.fn()} filterType="model" />, { wrapper: Wrapper });

    expect(screen.getByText('model_a.fbx')).toBeDefined();
    expect(screen.queryByText('texture_b.png')).toBeNull();
    expect(screen.queryByText('anim_c.fbx')).toBeNull();
  });
});
