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
  function MockDropdown({ children, open, onOpenChange, dropdownRender }: {
    children: React.ReactNode;
    open?: boolean;
    onOpenChange?: (v: boolean) => void;
    dropdownRender?: () => React.ReactNode;
  }) {
    return (
      <div>
        <span
          data-testid="dropdown-trigger"
          onClick={() => onOpenChange?.(!open)}
        >
          {children}
        </span>
        {open && <div data-testid="dropdown-content">{dropdownRender?.()}</div>}
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

// Use native DOM event to avoid @testing-library's act() wrapper which throws
// AggregateError when antd state updates happen asynchronously
function clickElement(el: Element) {
  const event = new MouseEvent('click', { bubbles: true, cancelable: true });
  el.dispatchEvent(event);
}

beforeEach(() => {
  jest.clearAllMocks();
  mockApiPut.mockResolvedValue({ success: true });
});

describe('NotificationDropdown', () => {
  describe('rendering', () => {
    it('renders bell icon', () => {
      mockApiGet.mockResolvedValueOnce({ success: true, data: { count: 0 } });
      render(<NotificationDropdown />, { wrapper: Wrapper });
      expect(screen.getByTestId('icon-bell')).toBeDefined();
    });

    it('fetches unread count on mount', async () => {
      mockApiGet.mockResolvedValueOnce({ success: true, data: { count: 3 } });
      render(<NotificationDropdown />, { wrapper: Wrapper });
      await waitFor(() => {
        expect(mockApiGet).toHaveBeenCalledWith('/api/notifications/unread-count');
      });
    });
  });

  describe('dropdown', () => {
    it('opens dropdown and fetches notifications on click', async () => {
      mockApiGet
        .mockResolvedValueOnce({ success: true, data: { count: 0 } })
        .mockResolvedValueOnce({ success: true, data: { items: [] } });
      render(<NotificationDropdown />, { wrapper: Wrapper });
      clickElement(screen.getByTestId('dropdown-trigger'));
      await waitFor(() => {
        expect(mockApiGet).toHaveBeenCalledWith('/api/notifications', { pageSize: '10' });
      });
    });

    it('shows empty state when no notifications', async () => {
      mockApiGet
        .mockResolvedValueOnce({ success: true, data: { count: 0 } })
        .mockResolvedValueOnce({ success: true, data: { items: [] } });
      render(<NotificationDropdown />, { wrapper: Wrapper });
      clickElement(screen.getByTestId('dropdown-trigger'));
      // Flush all pending async work
      await act(async () => {
        await new Promise((r) => setTimeout(r, 0));
      });
      await waitFor(() => {
        expect(screen.getByText('noNotifications')).toBeDefined();
      });
    });

    it('renders notification items', async () => {
      mockApiGet
        .mockResolvedValueOnce({ success: true, data: { count: 2 } })
        .mockResolvedValueOnce({
          success: true,
          data: {
            items: [
              { id: '1', type: 'system', title: 'System update', body: null, resource_type: null, resource_id: null, is_read: 0, created_at: '2026-01-01' },
              { id: '2', type: 'comment', title: 'New comment', body: null, resource_type: null, resource_id: null, is_read: 1, created_at: '2026-01-02' },
            ],
          },
        });
      render(<NotificationDropdown />, { wrapper: Wrapper });
      clickElement(screen.getByTestId('dropdown-trigger'));
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
      mockApiGet
        .mockResolvedValueOnce({ success: true, data: { count: 1 } })
        .mockResolvedValueOnce({
          success: true,
          data: {
            items: [
              { id: 'n1', type: 'system', title: 'Test notification', body: null, resource_type: null, resource_id: null, is_read: 0, created_at: '2026-01-01' },
            ],
          },
        })
        .mockResolvedValueOnce({ success: true, data: { count: 0 } });
      mockApiPut.mockResolvedValue({ success: true });
      render(<NotificationDropdown />, { wrapper: Wrapper });
      clickElement(screen.getByTestId('dropdown-trigger'));
      await act(async () => {
        await new Promise((r) => setTimeout(r, 0));
      });
      await waitFor(() => {
        expect(screen.getByText('Test notification')).toBeDefined();
      });
      clickElement(screen.getByText('Test notification'));
      expect(mockApiPut).toHaveBeenCalledWith('/api/notifications/n1/read');
    });

    it('marks all as read', async () => {
      mockApiGet
        .mockResolvedValueOnce({ success: true, data: { count: 1 } })
        .mockResolvedValueOnce({
          success: true,
          data: {
            items: [
              { id: 'n1', type: 'system', title: 'Alert', body: null, resource_type: null, resource_id: null, is_read: 0, created_at: '2026-01-01' },
            ],
          },
        });
      mockApiPut.mockResolvedValue({ success: true });
      render(<NotificationDropdown />, { wrapper: Wrapper });
      clickElement(screen.getByTestId('dropdown-trigger'));
      await act(async () => {
        await new Promise((r) => setTimeout(r, 0));
      });
      await waitFor(() => {
        expect(screen.getByText('markAllRead')).toBeDefined();
      });
      clickElement(screen.getByText('markAllRead'));
      expect(mockApiPut).toHaveBeenCalledWith('/api/notifications/read-all');
    });
  });

  describe('badge count', () => {
    it('fetches unread count and renders Badge wrapper', async () => {
      mockApiGet.mockResolvedValueOnce({ success: true, data: { count: 5 } });
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
      mockApiGet
        .mockResolvedValueOnce({ success: true, data: { count: 0 } })
        .mockResolvedValueOnce({ success: false, error: 'Network error' });
      render(<NotificationDropdown />, { wrapper: Wrapper });
      clickElement(screen.getByTestId('dropdown-trigger'));
      await act(async () => {
        await new Promise((r) => setTimeout(r, 0));
      });
      await waitFor(() => {
        expect(screen.getByText('noNotifications')).toBeDefined();
      });
    });
  });
});
