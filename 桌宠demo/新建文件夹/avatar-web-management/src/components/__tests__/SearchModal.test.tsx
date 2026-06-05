/**
 * @jest-environment jsdom
 */

import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import SearchModal from '@/components/layout/SearchModal';

const mockPush = jest.fn();

jest.mock('next/navigation', () => ({
  useRouter: () => ({ push: mockPush }),
  usePathname: () => '/',
}));

jest.mock('@/lib/api-client', () => ({
  apiGet: jest.fn(),
}));

const { apiGet } = require('@/lib/api-client');

const mockResults = {
  success: true,
  data: {
    avatars: [
      { id: 'a1', name: 'CoolAvatar', style: 'anime', thumbnail_url: null, status: 'published' },
    ],
    assets: [
      { id: 'as1', filename: 'model.fbx', asset_type: 'model', format: 'fbx', file_size: 1024 },
    ],
    templates: [
      { id: 't1', name: 'CatTemplate', style: 'chibi', thumbnail_url: null },
    ],
  },
};

describe('SearchModal', () => {
  beforeEach(() => {
    mockPush.mockClear();
    jest.clearAllMocks();
  });

  it('renders search input when open', () => {
    render(<SearchModal open={true} onClose={jest.fn()} />);
    expect(screen.getByPlaceholderText('placeholder')).toBeDefined();
  });

  it('shows loading spinner while searching', async () => {
    let resolvePromise: (v: any) => void;
    const deferred = new Promise(r => { resolvePromise = r; });
    apiGet.mockReturnValue(deferred);

    render(<SearchModal open={true} onClose={jest.fn()} />);
    fireEvent.change(screen.getByPlaceholderText('placeholder'), { target: { value: 'cool' } });

    await waitFor(() => {
      expect(document.querySelector('.ant-spin')).toBeDefined();
    });

    resolvePromise!(mockResults);
  });

  it('renders search results across categories', async () => {
    apiGet.mockResolvedValue(mockResults);

    render(<SearchModal open={true} onClose={jest.fn()} />);
    fireEvent.change(screen.getByPlaceholderText('placeholder'), { target: { value: 'cool' } });

    await waitFor(() => {
      expect(screen.getByText('CoolAvatar')).toBeDefined();
    });
    expect(screen.getByText('model.fbx')).toBeDefined();
    expect(screen.getByText('CatTemplate')).toBeDefined();
  });

  it('shows empty state when no results', async () => {
    apiGet.mockResolvedValue({ success: true, data: { avatars: [], assets: [], templates: [] } });

    render(<SearchModal open={true} onClose={jest.fn()} />);
    fireEvent.change(screen.getByPlaceholderText('placeholder'), { target: { value: 'zzz' } });

    await waitFor(() => {
      expect(screen.getByText('noResults')).toBeDefined();
    });
  });

  it('clears results when query is empty', async () => {
    apiGet.mockResolvedValue(mockResults);

    render(<SearchModal open={true} onClose={jest.fn()} />);
    fireEvent.change(screen.getByPlaceholderText('placeholder'), { target: { value: 'cool' } });

    await waitFor(() => {
      expect(screen.getByText('CoolAvatar')).toBeDefined();
    });

    fireEvent.change(screen.getByPlaceholderText('placeholder'), { target: { value: '' } });
    expect(screen.queryByText('CoolAvatar')).toBeNull();
  });

  it('navigates to avatar detail on result click', async () => {
    apiGet.mockResolvedValue(mockResults);

    render(<SearchModal open={true} onClose={jest.fn()} />);
    fireEvent.change(screen.getByPlaceholderText('placeholder'), { target: { value: 'cool' } });

    await waitFor(() => {
      fireEvent.click(screen.getByText('CoolAvatar'));
    });

    expect(mockPush).toHaveBeenCalledWith('/avatars/a1');
  });

  it('supports keyboard navigation (Enter on result)', async () => {
    apiGet.mockResolvedValue(mockResults);

    render(<SearchModal open={true} onClose={jest.fn()} />);
    fireEvent.change(screen.getByPlaceholderText('placeholder'), { target: { value: 'cool' } });

    await waitFor(() => {
      const avatarItem = screen.getByText('CoolAvatar');
      fireEvent.keyDown(avatarItem.closest('[role="button"]')!, { key: 'Enter' });
    });

    expect(mockPush).toHaveBeenCalledWith('/avatars/a1');
  });
});
