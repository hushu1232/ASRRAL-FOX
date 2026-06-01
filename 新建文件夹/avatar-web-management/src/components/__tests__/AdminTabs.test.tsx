/**
 * @jest-environment jsdom
 */

import { render, screen, waitFor, fireEvent, act } from '@testing-library/react';
import { App } from 'antd';
import UsersTab from '@/app/(auth)/admin/UsersTab';
import ReviewsTab from '@/app/(auth)/admin/ReviewsTab';
import OAuthClientsTab from '@/app/(auth)/admin/OAuthClientsTab';

// Deferred promise helper — gives explicit control over when async mocks resolve
function deferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (reason?: unknown) => void;
  const promise = new Promise<T>((res, rej) => { resolve = res; reject = rej; });
  return { promise, resolve, reject };
}

const mockApiGet = jest.fn();
const mockApiPut = jest.fn();
const mockApiDelete = jest.fn();

jest.mock('@/lib/api-client', () => ({
  apiGet: (...args: unknown[]) => mockApiGet(...args),
  apiPut: (...args: unknown[]) => mockApiPut(...args),
  apiDelete: (...args: unknown[]) => mockApiDelete(...args),
}));

const mockFetch = jest.fn();
global.fetch = mockFetch;

jest.mock('@ant-design/icons', () => ({
  SearchOutlined: () => <span data-testid="icon-search" />,
  CheckOutlined: () => <span data-testid="icon-check" />,
  CloseOutlined: () => <span data-testid="icon-close" />,
  PlusOutlined: () => <span data-testid="icon-plus" />,
  CopyOutlined: () => <span data-testid="icon-copy" />,
  DeleteOutlined: () => <span data-testid="icon-delete" />,
  EyeOutlined: () => <span data-testid="icon-eye" />,
}));

function Wrapper({ children }: { children: React.ReactNode }) {
  return <App>{children}</App>;
}

beforeEach(() => {
  jest.clearAllMocks();
  mockFetch.mockReset();
});

describe('UsersTab', () => {
  it('fetches users on mount', async () => {
    mockApiGet.mockResolvedValue({ success: true, data: { items: [], total: 0 } });
    render(<UsersTab />, { wrapper: Wrapper });
    await waitFor(() => {
      expect(mockApiGet).toHaveBeenCalledWith(expect.stringContaining('/api/admin/users'));
    });
  });

  it('renders search input with placeholder', () => {
    mockApiGet.mockResolvedValue({ success: true, data: { items: [], total: 0 } });
    render(<UsersTab />, { wrapper: Wrapper });
    expect(screen.getByPlaceholderText('search')).toBeDefined();
  });

  it('passes search and role params to API', async () => {
    mockApiGet.mockResolvedValue({ success: true, data: { items: [], total: 0 } });
    render(<UsersTab />, { wrapper: Wrapper });
    await waitFor(() => {
      expect(mockApiGet).toHaveBeenCalledWith(expect.stringContaining('page='));
    });
  });
});

describe('ReviewsTab', () => {
  const mockReviews = [
    { id: '1', avatar_name: 'Test Avatar', creator: 'alice', review_status: 'pending_review', version_id: 'v1', submitted_at: '2026-01-01' },
  ];

  it('fetches reviews on mount', async () => {
    mockApiGet.mockResolvedValue({ success: true, data: { items: [], total: 0 } });
    render(<ReviewsTab />, { wrapper: Wrapper });
    await waitFor(() => {
      expect(mockApiGet).toHaveBeenCalledWith(expect.stringContaining('/api/admin/reviews'));
    });
  });

  it('renders approve and reject buttons', async () => {
    const d = deferred<{ success: boolean; data: { items: typeof mockReviews; total: number } }>();
    mockApiGet.mockReturnValue(d.promise);
    render(<ReviewsTab />, { wrapper: Wrapper });
    // Resolve the fetch inside act() so React 19 flushes the resulting state update
    await act(async () => {
      d.resolve({ success: true, data: { items: mockReviews, total: 1 } });
    });
    expect(screen.getByText('approve')).toBeDefined();
    expect(screen.getByText('reject')).toBeDefined();
  });

  it('calls approve API on approve click', async () => {
    const d = deferred<{ success: boolean; data: { items: typeof mockReviews; total: number } }>();
    mockApiGet.mockReturnValue(d.promise);
    mockApiPut.mockResolvedValue({ success: true });
    render(<ReviewsTab />, { wrapper: Wrapper });
    await act(async () => {
      d.resolve({ success: true, data: { items: mockReviews, total: 1 } });
    });
    fireEvent.click(screen.getByText('approve'));
    await waitFor(() => {
      expect(mockApiPut).toHaveBeenCalledWith('/api/admin/reviews/v1', { action: 'approved' });
    });
  });

  it('calls reject API on reject click', async () => {
    const d = deferred<{ success: boolean; data: { items: typeof mockReviews; total: number } }>();
    mockApiGet.mockReturnValue(d.promise);
    mockApiPut.mockResolvedValue({ success: true });
    render(<ReviewsTab />, { wrapper: Wrapper });
    await act(async () => {
      d.resolve({ success: true, data: { items: mockReviews, total: 1 } });
    });
    fireEvent.click(screen.getByText('reject'));
    await waitFor(() => {
      expect(mockApiPut).toHaveBeenCalledWith('/api/admin/reviews/v1', { action: 'rejected' });
    });
  });
});

describe('OAuthClientsTab', () => {
  it('fetches clients on mount', async () => {
    mockFetch.mockResolvedValue({ json: () => Promise.resolve({ success: true, data: [] }) });
    render(<OAuthClientsTab />, { wrapper: Wrapper });
    await waitFor(() => {
      expect(mockFetch).toHaveBeenCalledWith('/api/admin/oauth-clients', expect.any(Object));
    });
  });

  it('renders new client button', async () => {
    const d = deferred<{ json: () => Promise<unknown> }>();
    mockFetch.mockReturnValue(d.promise);
    render(<OAuthClientsTab />, { wrapper: Wrapper });
    await act(async () => {
      d.resolve({ json: () => Promise.resolve({ success: true, data: [] }) });
    });
    expect(screen.getByText('newClient')).toBeDefined();
  });

  it('opens modal on new client button click', async () => {
    const d = deferred<{ json: () => Promise<unknown> }>();
    mockFetch.mockReturnValue(d.promise);
    render(<OAuthClientsTab />, { wrapper: Wrapper });
    await act(async () => {
      d.resolve({ json: () => Promise.resolve({ success: true, data: [] }) });
    });
    fireEvent.click(screen.getByText('newClient'));
    expect(screen.getByText('modal.title')).toBeDefined();
  });

  it('renders form fields in create modal', async () => {
    const d = deferred<{ json: () => Promise<unknown> }>();
    mockFetch.mockReturnValue(d.promise);
    render(<OAuthClientsTab />, { wrapper: Wrapper });
    await act(async () => {
      d.resolve({ json: () => Promise.resolve({ success: true, data: [] }) });
    });
    fireEvent.click(screen.getByText('newClient'));
    expect(screen.getByText('modal.title')).toBeDefined();
    expect(screen.getByText('modal.appName')).toBeDefined();
    // Table column header uses 'callbackUrl', form label uses 'modal.callbackUrl'
    expect(screen.getByText('callbackUrl')).toBeDefined();
    expect(screen.getByText('modal.callbackUrl')).toBeDefined();
    expect(screen.getByText('modal.scopes')).toBeDefined();
    expect(screen.getByText('modal.publicClient')).toBeDefined();
  });

  it('renders client list and revoke button', async () => {
    const d = deferred<{ json: () => Promise<unknown> }>();
    mockFetch.mockReturnValue(d.promise);
    render(<OAuthClientsTab />, { wrapper: Wrapper });
    await act(async () => {
      d.resolve({
        json: () => Promise.resolve({
          success: true,
          data: [{ id: 'c1', name: 'My App', clientId: 'abc123', redirectUris: ['https://x.com/cb'], scopes: ['openid'], grantTypes: ['authorization_code'], isPublic: false }],
        }),
      });
    });
    expect(screen.getByText('My App')).toBeDefined();
    expect(screen.getByText('revoke')).toBeDefined();
  });

  it('closes modal on cancel button click', async () => {
    const d = deferred<{ json: () => Promise<unknown> }>();
    mockFetch.mockReturnValue(d.promise);
    render(<OAuthClientsTab />, { wrapper: Wrapper });
    await act(async () => {
      d.resolve({ json: () => Promise.resolve({ success: true, data: [] }) });
    });
    fireEvent.click(screen.getByText('newClient'));
    expect(screen.getByText('modal.title')).toBeDefined();
    // antd Modal renders Cancel button as the non-primary button in the footer
    const cancelBtn = document.querySelector('.ant-modal-footer .ant-btn:not(.ant-btn-primary)');
    expect(cancelBtn).not.toBeNull();
    fireEvent.click(cancelBtn!);
    // After closing, antd Modal is still in DOM but hidden — check it's no longer visible
    await waitFor(() => {
      expect(screen.queryByText('modal.title')).not.toBeVisible();
    });
  });
});
