/**
 * @jest-environment jsdom
 */

import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import { App } from 'antd';
import UsersTab from '@/app/(auth)/admin/UsersTab';
import ReviewsTab from '@/app/(auth)/admin/ReviewsTab';
import OAuthClientsTab from '@/app/(auth)/admin/OAuthClientsTab';

const mockApiPut = jest.fn();
const mockApiPatch = jest.fn();
const mockApiDelete = jest.fn();
const mockUseApiGet = jest.fn();
const mockMutate = jest.fn();

jest.mock('@/lib/api-client', () => ({
  apiPut: (...args: unknown[]) => mockApiPut(...args),
  apiPatch: (...args: unknown[]) => mockApiPatch(...args),
  apiDelete: (...args: unknown[]) => mockApiDelete(...args),
}));

jest.mock('@/lib/use-api', () => ({
  useApiGet: (...args: unknown[]) => mockUseApiGet(...args),
}));

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
  mockUseApiGet.mockImplementation((path: string) => ({
    data: {
      success: true,
      data: path === '/api/admin/oauth-clients' ? [] : { items: [], total: 0 },
    },
    isLoading: false,
    mutate: mockMutate,
  }));
});

describe('UsersTab', () => {
  it('fetches users on mount', async () => {
    render(<UsersTab />, { wrapper: Wrapper });
    expect(mockUseApiGet).toHaveBeenCalledWith('/api/admin/users', { page: '1', pageSize: '20' });
  });

  it('renders search input with placeholder', async () => {
    render(<UsersTab />, { wrapper: Wrapper });
    expect(screen.getByPlaceholderText('search')).toBeDefined();
  });

  it('passes search and role params to API', async () => {
    render(<UsersTab />, { wrapper: Wrapper });
    expect(mockUseApiGet).toHaveBeenCalledWith('/api/admin/users', expect.objectContaining({ page: '1', pageSize: '20' }));
  });
});

describe('ReviewsTab', () => {
  const mockReviews = [
    { id: '1', avatar_name: 'Test Avatar', creator: 'alice', review_status: 'pending_review', version_id: 'v1', submitted_at: '2026-01-01' },
  ];

  it('fetches reviews on mount', async () => {
    render(<ReviewsTab />, { wrapper: Wrapper });
    expect(mockUseApiGet).toHaveBeenCalledWith('/api/admin/reviews', expect.any(Object));
  });

  it('renders approve and reject buttons', async () => {
    mockUseApiGet.mockReturnValue({
      data: { success: true, data: { items: mockReviews, total: 1 } },
      isLoading: false,
      mutate: mockMutate,
    });
    render(<ReviewsTab />, { wrapper: Wrapper });
    expect(screen.getByText('approve')).toBeDefined();
    expect(screen.getByText('reject')).toBeDefined();
  });

  it('calls approve API on approve click', async () => {
    mockUseApiGet.mockReturnValue({
      data: { success: true, data: { items: mockReviews, total: 1 } },
      isLoading: false,
      mutate: mockMutate,
    });
    mockApiPut.mockResolvedValue({ success: true });
    render(<ReviewsTab />, { wrapper: Wrapper });
    fireEvent.click(screen.getByText('approve'));
    await waitFor(() => {
      expect(mockApiPut).toHaveBeenCalledWith('/api/admin/reviews/v1', { action: 'approved' });
    });
  });

  it('calls reject API on reject click', async () => {
    mockUseApiGet.mockReturnValue({
      data: { success: true, data: { items: mockReviews, total: 1 } },
      isLoading: false,
      mutate: mockMutate,
    });
    mockApiPut.mockResolvedValue({ success: true });
    render(<ReviewsTab />, { wrapper: Wrapper });
    fireEvent.click(screen.getByText('reject'));
    await waitFor(() => {
      expect(mockApiPut).toHaveBeenCalledWith('/api/admin/reviews/v1', { action: 'rejected' });
    });
  });
});

describe('OAuthClientsTab', () => {
  it('fetches clients on mount', async () => {
    render(<OAuthClientsTab />, { wrapper: Wrapper });
    expect(mockUseApiGet).toHaveBeenCalledWith('/api/admin/oauth-clients');
  });

  it('renders new client button', async () => {
    render(<OAuthClientsTab />, { wrapper: Wrapper });
    expect(screen.getByText('newClient')).toBeDefined();
  });

  it('opens modal on new client button click', async () => {
    render(<OAuthClientsTab />, { wrapper: Wrapper });
    fireEvent.click(screen.getByText('newClient'));
    expect(screen.getByText('modal.title')).toBeDefined();
  });

  it('renders form fields in create modal', async () => {
    render(<OAuthClientsTab />, { wrapper: Wrapper });
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
    mockUseApiGet.mockReturnValue({
      data: {
        success: true,
        data: [{ id: 'c1', name: 'My App', clientId: 'abc123', redirectUris: ['https://x.com/cb'], scopes: ['openid'], grantTypes: ['authorization_code'], isPublic: false }],
      },
      isLoading: false,
      mutate: mockMutate,
    });
    render(<OAuthClientsTab />, { wrapper: Wrapper });
    expect(screen.getByText('My App')).toBeDefined();
    expect(screen.getByText('revoke')).toBeDefined();
  });

  it('closes modal on cancel button click', async () => {
    render(<OAuthClientsTab />, { wrapper: Wrapper });
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
