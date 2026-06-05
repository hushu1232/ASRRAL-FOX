/**
 * @jest-environment jsdom
 */

import { render, screen, fireEvent } from '@testing-library/react';
import { App } from 'antd';
import Sidebar from '@/components/layout/Sidebar';

// jest.mock factories are hoisted — use a mutable ref pattern
let mockToggleSidebar = jest.fn();
let mockUserRole = 'user';
let mockSidebarCollapsed = false;
const mockPush = jest.fn();

jest.mock('next/navigation', () => ({
  useRouter: () => ({ push: mockPush, replace: jest.fn(), back: jest.fn(), prefetch: jest.fn() }),
  usePathname: () => '/dashboard',
  useSearchParams: () => new URLSearchParams(''),
}));

jest.mock('@/stores/authStore', () => {
  const mockHook = Object.assign(
    jest.fn((selector?: (s: unknown) => unknown) => {
      const state = {
        user: { id: '1', email: `${mockUserRole}@example.com`, username: mockUserRole, role: mockUserRole },
        isAuthenticated: true,
        isLoading: false,
      };
      if (selector) return selector(state);
      return state;
    }),
    {
      getState: () => ({
        user: { id: '1', email: `${mockUserRole}@example.com`, username: mockUserRole, role: mockUserRole },
        isAuthenticated: true,
        isLoading: false,
      }),
      setState: jest.fn(),
      subscribe: jest.fn(),
    }
  );
  return { useAuthStore: mockHook };
});

jest.mock('@/stores/uiStore', () => ({
  useUIStore: Object.assign(
    jest.fn((selector?: (s: unknown) => unknown) => {
      const store = { sidebarCollapsed: mockSidebarCollapsed, toggleSidebar: mockToggleSidebar };
      if (selector) return selector(store);
      return store;
    }),
    {
      getState: () => ({ sidebarCollapsed: mockSidebarCollapsed, toggleSidebar: mockToggleSidebar }),
      setState: jest.fn(),
      subscribe: jest.fn(),
    }
  ),
}));

jest.mock('@ant-design/icons', () => {
  const createIcon = (name: string) => () => <span data-testid={`icon-${name}`} />;
  return {
    DashboardOutlined: createIcon('dashboard'),
    UserOutlined: createIcon('user'),
    PictureOutlined: createIcon('picture'),
    FolderOutlined: createIcon('folder'),
    ShopOutlined: createIcon('shop'),
    SettingOutlined: createIcon('setting'),
    SafetyOutlined: createIcon('safety'),
    ApiOutlined: createIcon('api'),
    DollarOutlined: createIcon('dollar'),
    QuestionCircleOutlined: createIcon('question'),
    MenuFoldOutlined: createIcon('menu-fold'),
    MenuUnfoldOutlined: createIcon('menu-unfold'),
    PlusOutlined: createIcon('plus'),
    RobotOutlined: createIcon('robot'),
    ShoppingCartOutlined: createIcon('cart'),
    BellOutlined: createIcon('bell'),
    TeamOutlined: createIcon('team'),
    MessageOutlined: createIcon('message'),
    ThunderboltOutlined: createIcon('thunderbolt'),
    PlayCircleOutlined: createIcon('play-circle'),
  };
});

function Wrapper({ children }: { children: React.ReactNode }) {
  return <App>{children}</App>;
}

beforeEach(() => {
  jest.clearAllMocks();
  mockToggleSidebar = jest.fn();
  mockUserRole = 'user';
  mockSidebarCollapsed = false;
});

describe('Sidebar', () => {
  describe('rendering', () => {
    it('renders the sidebar with menu items', () => {
      render(<Sidebar />, { wrapper: Wrapper });
      expect(screen.getByText('dashboard')).toBeDefined();
      expect(screen.getByText('avatars')).toBeDefined();
      expect(screen.getByText('assets')).toBeDefined();
      expect(screen.getByText('settings')).toBeDefined();
    });

    it('renders create avatar button', () => {
      render(<Sidebar />, { wrapper: Wrapper });
      expect(screen.getByText('newAvatar')).toBeDefined();
    });

    it('renders collapse toggle button', () => {
      render(<Sidebar />, { wrapper: Wrapper });
      expect(screen.getByLabelText('collapse')).toBeDefined();
    });

    it('shows brand name when expanded', () => {
      render(<Sidebar />, { wrapper: Wrapper });
      expect(screen.getByText('brand')).toBeDefined();
    });
  });

  describe('role-based visibility', () => {
    it('hides admin menu from regular users', () => {
      render(<Sidebar />, { wrapper: Wrapper });
      expect(screen.queryByText('admin')).toBeNull();
    });

    it('hides workspace_admin menus from regular users', () => {
      render(<Sidebar />, { wrapper: Wrapper });
      expect(screen.queryByText('apiDocs')).toBeNull();
    });
  });

  describe('interaction', () => {
    it('calls toggleSidebar on collapse button click', () => {
      render(<Sidebar />, { wrapper: Wrapper });
      fireEvent.click(screen.getByLabelText('collapse'));
      expect(mockToggleSidebar).toHaveBeenCalled();
    });

    it('navigates to avatars page on create button click', () => {
      render(<Sidebar />, { wrapper: Wrapper });
      fireEvent.click(screen.getByText('newAvatar'));
      expect(mockPush).toHaveBeenCalledWith('/avatars');
    });

    it('navigates to dashboard on menu item click', () => {
      render(<Sidebar />, { wrapper: Wrapper });
      fireEvent.click(screen.getByText('dashboard'));
      expect(mockPush).toHaveBeenCalledWith('/dashboard');
    });

    it('navigates to marketplace on menu item click', () => {
      render(<Sidebar />, { wrapper: Wrapper });
      fireEvent.click(screen.getByText('marketplace'));
      expect(mockPush).toHaveBeenCalledWith('/marketplace');
    });

    it('navigates to settings on menu item click', () => {
      render(<Sidebar />, { wrapper: Wrapper });
      fireEvent.click(screen.getByText('settings'));
      expect(mockPush).toHaveBeenCalledWith('/settings');
    });
  });

  describe('admin visibility', () => {
    it('shows admin and workspace_admin menus for super_admin user', () => {
      mockUserRole = 'super_admin';
      render(<Sidebar />, { wrapper: Wrapper });
      expect(screen.getByText('admin')).toBeDefined();
      expect(screen.getByText('apiDocs')).toBeDefined();
      expect(screen.getByText('sellerCenter')).toBeDefined();
    });
  });

  describe('collapsed state', () => {
    it('hides brand name when collapsed', () => {
      mockSidebarCollapsed = true;
      render(<Sidebar />, { wrapper: Wrapper });
      expect(screen.queryByText('brand')).toBeNull();
    });

    it('hides new avatar button text when collapsed', () => {
      mockSidebarCollapsed = true;
      render(<Sidebar />, { wrapper: Wrapper });
      expect(screen.queryByText('newAvatar')).toBeNull();
    });

    it('shows expand label on toggle button when collapsed', () => {
      mockSidebarCollapsed = true;
      render(<Sidebar />, { wrapper: Wrapper });
      expect(screen.getByLabelText('expand')).toBeDefined();
    });
  });
});
