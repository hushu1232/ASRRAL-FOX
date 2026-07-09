/**
 * @jest-environment jsdom
 */

import { render, screen, waitFor, act } from '@testing-library/react';
import { App } from 'antd';
import MarketplacePage from '@/app/(auth)/marketplace/page';
import AssetLibraryPage from '@/app/(auth)/assets/page';
import NotificationsPage from '@/app/(auth)/notifications/page';

// ──── mutable refs for per-test configuration ────
const mockApiGet = jest.fn();
let mockPaginatedData: unknown = undefined;
let mockPaginatedLoading = false;

jest.mock('@/lib/api-client', () => ({
  apiGet: (...args: unknown[]) => mockApiGet(...args),
  apiPut: jest.fn(),
  apiPost: jest.fn(),
  apiDelete: jest.fn(),
}));

jest.mock('@/lib/use-api', () => ({
  useApiPaginated: () => ({
    data: mockPaginatedData,
    isLoading: mockPaginatedLoading,
    error: undefined,
    isValidating: false,
    mutate: jest.fn(),
  }),
  useApiGet: () => ({
    data: undefined,
    isLoading: false,
    error: undefined,
    isValidating: false,
    mutate: jest.fn(),
  }),
}));

const mockUser = { id: '1', email: 'test@example.com', username: 'testuser', role: 'user' };

jest.mock('@/stores/authStore', () => {
  const mockHook = Object.assign(
    jest.fn((selector?: (s: unknown) => unknown) => {
      const state = { user: mockUser, isAuthenticated: true, accessToken: 'token-123' };
      if (selector) return selector(state);
      return state;
    }),
    {
      getState: () => ({ user: mockUser, isAuthenticated: true, accessToken: 'token-123' }),
      setState: jest.fn(),
      subscribe: jest.fn(),
    }
  );
  return { useAuthStore: mockHook };
});

jest.mock('@ant-design/icons', () => ({
  SearchOutlined: () => <span data-testid="icon-search" />,
  DownloadOutlined: () => <span data-testid="icon-download" />,
  StarFilled: () => <span data-testid="icon-star" />,
  UploadOutlined: () => <span data-testid="icon-upload" />,
  AppstoreOutlined: () => <span data-testid="icon-grid" />,
  UnorderedListOutlined: () => <span data-testid="icon-list" />,
  FolderOutlined: () => <span data-testid="icon-folder" />,
  FileOutlined: () => <span data-testid="icon-file" />,
  ShopOutlined: () => <span data-testid="icon-shop" />,
  BellOutlined: () => <span data-testid="icon-bell" />,
  CheckOutlined: () => <span data-testid="icon-check" />,
}));

function Wrapper({ children }: { children: React.ReactNode }) {
  return <App>{children}</App>;
}

beforeEach(() => {
  jest.clearAllMocks();
  mockPaginatedData = undefined;
  mockPaginatedLoading = false;
});

// ──── Marketplace ────

describe('MarketplacePage', () => {
  it('renders heading', () => {
    render(<MarketplacePage />, { wrapper: Wrapper });
    expect(screen.getByText('title')).toBeDefined();
  });

  it('renders "上架商品" button', () => {
    render(<MarketplacePage />, { wrapper: Wrapper });
    expect(screen.getByText('listItem')).toBeDefined();
  });

  it('renders search input with placeholder', () => {
    render(<MarketplacePage />, { wrapper: Wrapper });
    expect(screen.getByPlaceholderText('searchPlaceholder')).toBeDefined();
  });

  it('renders category tabs', () => {
    render(<MarketplacePage />, { wrapper: Wrapper });
    expect(screen.getByText('all')).toBeDefined();
    expect(screen.getByText('model')).toBeDefined();
    expect(screen.getByText('personality')).toBeDefined();
    expect(screen.getByText('voice')).toBeDefined();
    expect(screen.getByText('animation')).toBeDefined();
    expect(screen.getByText('theme')).toBeDefined();
  });

  it('renders sort select with default "最新"', () => {
    render(<MarketplacePage />, { wrapper: Wrapper });
    expect(screen.getByText('latest')).toBeDefined();
  });

  it('shows loading spinner when data is loading', () => {
    mockPaginatedLoading = true;
    const { container } = render(<MarketplacePage />, { wrapper: Wrapper });
    expect(container.querySelector('.ant-spin')).toBeDefined();
  });

  it('shows empty state when no items', () => {
    mockPaginatedData = { success: true, data: { items: [], total: 0 } };
    render(<MarketplacePage />, { wrapper: Wrapper });
    expect(screen.getByTestId('marketplace-empty-panel')).toBeDefined();
    expect(screen.getByTestId('empty-state')).toBeDefined();
    expect(screen.getByText('noItems')).toBeDefined();
  });

  it('renders product cards when items available', () => {
    mockPaginatedData = {
      success: true,
      data: {
        items: [
          {
            id: '1',
            seller_id: 's1',
            seller_username: 'sellerA',
            title: '酷炫机器人模型',
            description: 'A cool robot',
            category: 'model',
            price: 9900,
            currency: 'CNY',
            preview_images: ['https://img.example.com/robot.png'],
            rating: 4.5,
            download_count: 1200,
            applied_count: 300,
            status: 'published',
            created_at: '2026-01-01T00:00:00Z',
          },
        ],
        total: 1,
      },
    };
    render(<MarketplacePage />, { wrapper: Wrapper });
    expect(screen.getByTestId('marketplace-grid')).toBeDefined();
    expect(screen.getByText('酷炫机器人模型')).toBeDefined();
    expect(screen.getByText('sellerA')).toBeDefined();
    expect(screen.getByText('¥9900')).toBeDefined();
  });

  it('renders pagination when total exceeds pageSize', () => {
    mockPaginatedData = {
      success: true,
      data: {
        items: Array.from({ length: 24 }, (_, i) => ({
          id: String(i + 1),
          seller_id: 's1',
          seller_username: `seller${i}`,
          title: `商品 ${i + 1}`,
          description: '',
          category: 'model',
          price: 100,
          currency: 'CNY',
          preview_images: [],
          rating: 4,
          download_count: 10,
          applied_count: 0,
          status: 'published',
          created_at: '2026-01-01T00:00:00Z',
        })),
        total: 50,
      },
    };
    render(<MarketplacePage />, { wrapper: Wrapper });
    expect(screen.getByText('paginationTotal')).toBeDefined();
  });

  it('shows "免费" badge for zero-price items', () => {
    mockPaginatedData = {
      success: true,
      data: {
        items: [
          {
            id: '2',
            seller_id: 's2',
            seller_username: 'freebie',
            title: '免费资源包',
            description: '',
            category: 'model',
            price: 0,
            currency: 'CNY',
            preview_images: [],
            rating: 3.5,
            download_count: 500,
            applied_count: 100,
            status: 'published',
            created_at: '2026-01-01T00:00:00Z',
          },
        ],
        total: 1,
      },
    };
    render(<MarketplacePage />, { wrapper: Wrapper });
    expect(screen.getByText('free')).toBeDefined();
  });
});

// ──── Notifications ────

describe('NotificationsPage', () => {
  it('shows the shared empty state when there are no notifications', () => {
    mockPaginatedData = { success: true, data: { items: [], total: 0 } };
    render(<NotificationsPage />, { wrapper: Wrapper });

    expect(screen.getByTestId('notifications-empty-panel')).toBeDefined();
    expect(screen.getByTestId('empty-state')).toBeDefined();
    expect(screen.getByText('noNotifications')).toBeDefined();
  });

  it('renders notifications inside the shared list panel', async () => {
    mockPaginatedData = {
      success: true,
      data: {
        items: [
          {
            id: 'n1',
            type: 'system',
            title: 'Desktop sync ready',
            body: 'Your pet package can be reviewed now.',
            resource_type: null,
            resource_id: null,
            is_read: 0,
            created_at: new Date().toISOString(),
          },
        ],
        total: 1,
      },
    };

    render(<NotificationsPage />, { wrapper: Wrapper });

    await waitFor(() => {
      expect(screen.getByTestId('notifications-list-panel')).toBeDefined();
    });
    expect(screen.getByText('Desktop sync ready')).toBeDefined();
  });

  it('clears stale notifications when refreshed data is empty', async () => {
    mockPaginatedData = {
      success: true,
      data: {
        items: [
          {
            id: 'n1',
            type: 'system',
            title: 'Desktop sync ready',
            body: 'Your pet package can be reviewed now.',
            resource_type: null,
            resource_id: null,
            is_read: 0,
            created_at: new Date().toISOString(),
          },
        ],
        total: 1,
      },
    };

    const { rerender } = render(<NotificationsPage />, { wrapper: Wrapper });

    await waitFor(() => {
      expect(screen.getByText('Desktop sync ready')).toBeDefined();
    });

    mockPaginatedData = { success: true, data: { items: [], total: 0 } };
    rerender(<NotificationsPage />);

    await waitFor(() => {
      expect(screen.getByTestId('notifications-empty-panel')).toBeDefined();
    });
    expect(screen.queryByText('Desktop sync ready')).toBeNull();
  });
});

// ──── Assets ────

describe('AssetLibraryPage', () => {
  function mockEmptyAssets() {
    mockApiGet.mockResolvedValue({
      success: true,
      data: { items: [], total: 0 },
    });
  }

  function mockAssetsWithData() {
    mockApiGet.mockResolvedValue({
      success: true,
      data: {
        items: [
          {
            id: 'a1',
            filename: 'character.glb',
            asset_type: 'model',
            format: 'glb',
            file_size: 2048000,
            status: 'ready',
            storage_path: '/storage/a1.glb',
            created_at: '2026-03-15T10:00:00Z',
          },
          {
            id: 'a2',
            filename: 'texture_diffuse.png',
            asset_type: 'texture',
            format: 'png',
            file_size: 512000,
            status: 'ready',
            storage_path: '/storage/a2.png',
            created_at: '2026-03-14T08:00:00Z',
          },
        ],
        total: 2,
      },
    });
  }

  async function renderAssetLibraryPage() {
    const result = render(<AssetLibraryPage />, { wrapper: Wrapper });
    await act(async () => {
      await new Promise(resolve => setTimeout(resolve, 100));
    });
    return result;
  }

  it('renders heading', async () => {
    mockEmptyAssets();
    await renderAssetLibraryPage();
    expect(screen.getByText('title')).toBeDefined();
  });

  it('renders "uploadButton" button', async () => {
    mockEmptyAssets();
    await renderAssetLibraryPage();
    expect(screen.getByText('uploadButton')).toBeDefined();
  });

  it('renders search input', async () => {
    mockEmptyAssets();
    await renderAssetLibraryPage();
    expect(screen.getByPlaceholderText('upload.searchFiles')).toBeDefined();
  });

  it('renders Tree sidebar with category labels', async () => {
    mockEmptyAssets();
    await renderAssetLibraryPage();
    expect(screen.getByText('upload.allAssets')).toBeDefined();
    expect(screen.getByText('upload.directory')).toBeDefined();
  });

  it('renders view mode toggle buttons', async () => {
    mockEmptyAssets();
    await renderAssetLibraryPage();
    expect(screen.getByTestId('icon-grid')).toBeDefined();
    expect(screen.getByTestId('icon-list')).toBeDefined();
  });

  it('fetches assets on mount', async () => {
    mockEmptyAssets();
    await renderAssetLibraryPage();
    expect(mockApiGet).toHaveBeenCalledTimes(1);
    expect(mockApiGet).toHaveBeenCalledWith('/api/assets', { page: '1', pageSize: '24' });
  });

  it('shows empty state after loading', async () => {
    mockEmptyAssets();
    await renderAssetLibraryPage();
    await waitFor(() => {
      expect(screen.getByText('noAssets')).toBeDefined();
    });
  });

  it('renders asset cards in grid view', async () => {
    mockAssetsWithData();
    await renderAssetLibraryPage();
    await waitFor(() => {
      expect(screen.getByText('character.glb')).toBeDefined();
      expect(screen.getByText('texture_diffuse.png')).toBeDefined();
    });
  });

  it('renders pagination when total > pageSize', async () => {
    mockApiGet.mockResolvedValue({
      success: true,
      data: {
        items: Array.from({ length: 24 }, (_, i) => ({
          id: String(i + 1),
          filename: `file_${i}.glb`,
          asset_type: 'model',
          format: 'glb',
          file_size: 1024,
          status: 'ready',
          storage_path: `/storage/${i}.glb`,
          created_at: '2026-01-01T00:00:00Z',
        })),
        total: 50,
      },
    });
    await renderAssetLibraryPage();
    await waitFor(() => {
      expect(screen.getByText('upload.paginationTotal')).toBeDefined();
    });
  });
});
