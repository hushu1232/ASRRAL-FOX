/**
 * @jest-environment jsdom
 */

import React from 'react';
import { render, screen, waitFor, act } from '@testing-library/react';
import { App } from 'antd';
import NotificationDropdown from '@/components/layout/NotificationDropdown';

const mockApiPut = jest.fn();
const mockUseApiGet = jest.fn();
const mockMutateUnread = jest.fn();
const mockMutateList = jest.fn();
let mockUnreadCount = 0;
let mockNotificationItems: unknown[] = [];
let mockListSuccess = true;

jest.mock('@/lib/api-client', () => ({
  apiPut: (...args: unknown[]) => mockApiPut(...args),
}));

jest.mock('@/lib/use-api', () => ({
  useApiGet: (...args: unknown[]) => mockUseApiGet(...args),
}));

// Mock antd Dropdown to render inline — avoids Portal + AggregateError in jsdom
jest.mock('antd', () => {
  const actual = jest.requireActual('antd');
  function MockDropdown({ children, open, onOpenChange, dropdownRender, popupRender }: {
    children: React.ReactNode;
    open?: boolean;
    onOpenChange?: (v: boolean) => void;
    dropdownRender?: () => React.ReactNode;
    popupRender?: () => React.ReactNode;
  }) {
    const renderPopup = popupRender || dropdownRender;
    return (
      <div>
        <span
          data-testid="dropdown-trigger"
          onClick={() => onOpenChange?.(!open)}
        >
          {children}
        </span>
        {open && <div data-testid="dropdown-content">{renderPopup?.()}</div>}
      </div>
    );
  }
  MockDropdown.Button = actual.Dropdown.Button;
  return { ...actual, Dropdown: MockDropdown };
});

jest.mock('@ant-design/icons', () => ({
  BellOutlined: ({ 'aria-label': ariaLabel }: Record<string, unknown>) => (
    <span data-testid="icon-bell" aria-label={ariaLabel as string} />
  ),
  CheckOutlined: () => <span data-testid="icon-check" />,
}));

function Wrapper({ children }: { children: React.ReactNode }) {
  return <App>{children}</App>;
}

async function clickElement(el: Element) {
  const event = new MouseEvent('click', { bubbles: true, cancelable: true });
  await act(async () => {
    el.dispatchEvent(event);
  });
}

beforeEach(() => {
  jest.clearAllMocks();
  mockUnreadCount = 0;
  mockNotificationItems = [];
  mockListSuccess = true;
  mockApiPut.mockResolvedValue({ success: true });
  mockUseApiGet.mockImplementation((path: string | null) => {
    if (path === '/api/notifications/unread-count') {
      return {
        data: { success: true, data: { count: mockUnreadCount } },
        isLoading: false,
        mutate: mockMutateUnread,
      };
    }
    return {
      data: path && mockListSuccess
        ? { success: true, data: { items: mockNotificationItems } }
        : path ? { success: false, error: 'Network error' } : undefined,
      isLoading: false,
      mutate: mockMutateList,
    };
  });
});

describe('NotificationDropdown', () => {
  function mockNotificationApi(count: number, items: unknown[], listSuccess = true) {
    mockUnreadCount = count;
    mockNotificationItems = items;
    mockListSuccess = listSuccess;
  }

  describe('rendering', () => {
    it('renders bell icon', () => {
      render(<NotificationDropdown />, { wrapper: Wrapper });
      expect(screen.getByTestId('icon-bell')).toBeDefined();
    });

    it('subscribes to unread count on mount', () => {
      mockNotificationApi(3, []);
      render(<NotificationDropdown />, { wrapper: Wrapper });
      expect(mockUseApiGet).toHaveBeenCalledWith('/api/notifications/unread-count');
    });
  });

  describe('dropdown', () => {
    it('opens dropdown and enables the notification data source on click', async () => {
      render(<NotificationDropdown />, { wrapper: Wrapper });
      await clickElement(screen.getByTestId('dropdown-trigger'));
      expect(mockUseApiGet).toHaveBeenCalledWith('/api/notifications', { pageSize: '10' });
    });

    it('shows empty state when no notifications', async () => {
      render(<NotificationDropdown />, { wrapper: Wrapper });
      await clickElement(screen.getByTestId('dropdown-trigger'));
      // Flush all pending async work
      await act(async () => {
        await new Promise((r) => setTimeout(r, 0));
      });
      await waitFor(() => {
        expect(screen.getByText('noNotifications')).toBeDefined();
      });
    });

    it('renders notification items', async () => {
      mockNotificationApi(2, [
        { id: '1', type: 'system', title: 'System update', body: null, resource_type: null, resource_id: null, is_read: 0, created_at: '2026-01-01' },
        { id: '2', type: 'comment', title: 'New comment', body: null, resource_type: null, resource_id: null, is_read: 1, created_at: '2026-01-02' },
      ]);
      render(<NotificationDropdown />, { wrapper: Wrapper });
      await clickElement(screen.getByTestId('dropdown-trigger'));
      await act(async () => {
        await new Promise((r) => setTimeout(r, 0));
      });
      await waitFor(() => {
        expect(screen.getByText('System update')).toBeDefined();
        expect(screen.getByText('New comment')).toBeDefined();
      });
    });
  });

  describe('mark as read', () => {
    it('marks notification as read on click', async () => {
      mockNotificationApi(1, [
        { id: 'n1', type: 'system', title: 'Test notification', body: null, resource_type: null, resource_id: null, is_read: 0, created_at: '2026-01-01' },
      ]);
      mockApiPut.mockResolvedValue({ success: true });
      render(<NotificationDropdown />, { wrapper: Wrapper });
      await clickElement(screen.getByTestId('dropdown-trigger'));
      await act(async () => {
        await new Promise((r) => setTimeout(r, 0));
      });
      await waitFor(() => {
        expect(screen.getByText('Test notification')).toBeDefined();
      });
      await clickElement(screen.getByText('Test notification'));
      expect(mockApiPut).toHaveBeenCalledWith('/api/notifications/n1/read');
      expect(mockMutateList).toHaveBeenCalledWith(expect.any(Function), { revalidate: true });
      expect(mockMutateUnread).toHaveBeenCalled();
    });

    it('does not update caches when marking one notification fails', async () => {
      mockNotificationApi(1, [
        { id: 'n1', type: 'system', title: 'Still unread', body: null, resource_type: null, resource_id: null, is_read: 0, created_at: '2026-01-01' },
      ]);
      mockApiPut.mockResolvedValue({ success: false, error: 'Request failed' });
      render(<NotificationDropdown />, { wrapper: Wrapper });
      await clickElement(screen.getByTestId('dropdown-trigger'));
      await clickElement(screen.getByText('Still unread'));

      await waitFor(() => expect(mockApiPut).toHaveBeenCalled());
      expect(mockMutateList).not.toHaveBeenCalled();
      expect(mockMutateUnread).not.toHaveBeenCalled();
    });

    it('marks all as read', async () => {
      mockNotificationApi(1, [
        { id: 'n1', type: 'system', title: 'Alert', body: null, resource_type: null, resource_id: null, is_read: 0, created_at: '2026-01-01' },
      ]);
      mockApiPut.mockResolvedValue({ success: true });
      render(<NotificationDropdown />, { wrapper: Wrapper });
      await clickElement(screen.getByTestId('dropdown-trigger'));
      await act(async () => {
        await new Promise((r) => setTimeout(r, 0));
      });
      await waitFor(() => {
        expect(screen.getByText('markAllRead')).toBeDefined();
      });
      await clickElement(screen.getByText('markAllRead'));
      expect(mockApiPut).toHaveBeenCalledWith('/api/notifications/read-all');
      expect(mockMutateList).toHaveBeenCalledWith(expect.any(Function), { revalidate: true });
      expect(mockMutateUnread).toHaveBeenCalledWith(
        { success: true, data: { count: 0 } },
        { revalidate: true },
      );
    });
  });

  describe('badge count', () => {
    it('reads the unread count and renders Badge wrapper', () => {
      mockNotificationApi(5, []);
      render(<NotificationDropdown />, { wrapper: Wrapper });
      expect(mockUseApiGet).toHaveBeenCalledWith('/api/notifications/unread-count');
      const badge = document.querySelector('.ant-badge');
      expect(badge).toBeDefined();
    });
  });

  describe('error handling', () => {
    it('shows empty state when fetch fails', async () => {
      mockNotificationApi(0, [], false);
      render(<NotificationDropdown />, { wrapper: Wrapper });
      await clickElement(screen.getByTestId('dropdown-trigger'));
      await act(async () => {
        await new Promise((r) => setTimeout(r, 0));
      });
      await waitFor(() => {
        expect(screen.getByText('noNotifications')).toBeDefined();
      });
    });
  });
});
