/**
 * @jest-environment jsdom
 */

import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import CommandPalette from '@/components/layout/CommandPalette';

const mockPush = jest.fn();
const mockApiGet = jest.fn();

jest.mock('next/navigation', () => ({
  useRouter: () => ({ push: mockPush }),
}));

jest.mock('@/lib/api-client', () => ({
  apiGet: (...args: unknown[]) => mockApiGet(...args),
}));

const results = {
  success: true,
  data: {
    avatars: [{ id: 'a1', name: 'CoolAvatar', style: 'anime' }],
    assets: [{ id: 'as1', filename: 'model.fbx', asset_type: 'model' }],
    templates: [{ id: 't1', name: 'CatTemplate', style: 'chibi' }],
  },
};

async function waitForDebounce() {
  await act(async () => {
    await new Promise(resolve => setTimeout(resolve, 200));
  });
}

describe('CommandPalette', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('shows quick navigation before searching', () => {
    render(<CommandPalette onClose={jest.fn()} />);

    expect(screen.getByText('快速导航')).toBeDefined();
    expect(screen.getByText('工作台')).toBeDefined();
  });

  it('searches and clears results from input events', async () => {
    mockApiGet.mockResolvedValue(results);
    render(<CommandPalette onClose={jest.fn()} />);

    const input = screen.getByPlaceholderText('placeholder');
    fireEvent.change(input, { target: { value: 'cool' } });
    await waitForDebounce();

    await waitFor(() => expect(screen.getByText('CoolAvatar')).toBeDefined());
    expect(mockApiGet).toHaveBeenCalledWith('/api/search', { q: 'cool' });

    fireEvent.change(input, { target: { value: '' } });
    expect(screen.queryByText('CoolAvatar')).toBeNull();
    expect(screen.getByText('快速导航')).toBeDefined();
  });

  it('ignores a stale response after the query changes', async () => {
    let resolveFirst!: (value: typeof results) => void;
    const firstRequest = new Promise<typeof results>((resolve) => { resolveFirst = resolve; });
    mockApiGet
      .mockReturnValueOnce(firstRequest)
      .mockResolvedValueOnce({
        success: true,
        data: { avatars: [{ id: 'a2', name: 'FreshAvatar', style: 'realistic' }], assets: [], templates: [] },
      });

    render(<CommandPalette onClose={jest.fn()} />);
    const input = screen.getByPlaceholderText('placeholder');
    fireEvent.change(input, { target: { value: 'old' } });
    await waitForDebounce();
    await waitFor(() => expect(mockApiGet).toHaveBeenCalledWith('/api/search', { q: 'old' }));

    fireEvent.change(input, { target: { value: 'fresh' } });
    await waitForDebounce();
    await waitFor(() => expect(screen.getByText('FreshAvatar')).toBeDefined());

    await act(async () => {
      resolveFirst(results);
      await firstRequest;
    });

    expect(screen.queryByText('CoolAvatar')).toBeNull();
    expect(screen.getByText('FreshAvatar')).toBeDefined();
  });
});
