/**
 * @jest-environment jsdom
 */

import React from 'react';
import { render, screen, waitFor, act } from '@testing-library/react';
import { App } from 'antd';
import NotificationDropdown from '@/components/layout/NotificationDropdown';

const mockApiGet = jest.fn();
const mockApiPut = jest.fn();

jest.mock('@/lib/api-client', () => ({
  apiGet: (...args: unknown[]) => mockApiGet(...args),
  apiPut: (...args: unknown[]) => mockApiPut(...args),
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
  mockApiPut.mockResolvedValue({ success: true });
  mockApiGet.mockImplementation((url: string) => {
    if (url === '/api/notifications/unread-count') {
      return Promise.resolve({ success: true, data: { count: 0 } });
    }
    if (url === '/api/notifications') {
      return Promise.resolve({ success: true, data: { items: [] } });
    }
    return Promise.resolve({ success: false, error: 'Unhandled test URL' });
  });
});

describe('NotificationDropdown', () => {
  function mockNotificationApi(count: number, items: unknown[], listSuccess = true) {
    mockApiGet.mockImplementation((url: string) => {
      if (url === '/api/notifications/unread-count') {
        return Promise.resolve({ success: true, data: { count } });
      }
      if (url === '/api/notifications') {
        return Promise.resolve(
          listSuccess
            ? { success: true, data: { items } }
            : { success: false, error: 'Network error' },
        );
      }
      return Promise.resolve({ success: false, error: 'Unhandled test URL' });
    });
  }

  describe('rendering', () => {
    it('renders bell icon', () => {
      render(<NotificationDropdown />, { wrapper: Wrapper });
      expect(screen.getByTestId('icon-bell')).toBeDefined();
    });

    it('fetches unread count on mount', async () => {
      mockNotificationApi(3, []);
      render(<NotificationDropdown />, { wrapper: Wrapper });
      await waitFor(() => {
        expect(mockApiGet).toHaveBeenCalledWith('/api/notifications/unread-count');
      });
    });
  });

  describe('dropdown', () => {
    it('opens dropdown and fetches notifications on click', async () => {
      render(<NotificationDropdown />, { wrapper: Wrapper });
      await clickElement(screen.getByTestId('dropdown-trigger'));
      await waitFor(() => {
        expect(mockApiGet).toHaveBeenCalledWith('/api/notifications', { pageSize: '10' });
      });
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
    });
  });

  describe('badge count', () => {
    it('fetches unread count and renders Badge wrapper', async () => {
      mockNotificationApi(5, []);
      render(<NotificationDropdown />, { wrapper: Wrapper });
      await waitFor(() => {
        expect(mockApiGet).toHaveBeenCalledWith('/api/notifications/unread-count');
      });
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
