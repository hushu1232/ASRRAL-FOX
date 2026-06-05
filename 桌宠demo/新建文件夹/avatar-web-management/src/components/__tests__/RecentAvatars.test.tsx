/**
 * @jest-environment jsdom
 */

import { render, screen, fireEvent } from '@testing-library/react';
import { App } from 'antd';
import RecentAvatars from '@/components/dashboard/RecentAvatars';

const mockPush = jest.fn();

jest.mock('next/navigation', () => ({
  useRouter: () => ({ push: mockPush }),
}));

jest.mock('@ant-design/icons', () => ({
  EditOutlined: () => <span data-testid="icon-edit" />,
  EyeOutlined: () => <span data-testid="icon-eye" />,
}));

function Wrapper({ children }: { children: React.ReactNode }) {
  return <App>{children}</App>;
}

const mockData = [
  { id: 'a1', name: 'MyAvatar', style: 'anime', status: 'draft', updated_at: '2026-05-01' },
  { id: 'a2', name: 'CoolBot', style: 'robot', status: 'published', updated_at: '2026-05-02' },
  { id: 'a3', name: 'FoxGirl', style: 'chibi', status: 'pending_review', updated_at: '2026-04-28' },
];

describe('RecentAvatars', () => {
  beforeEach(() => {
    mockPush.mockClear();
  });

  it('renders title', () => {
    render(<RecentAvatars data={mockData} />, { wrapper: Wrapper });
    expect(screen.getByText('title')).toBeDefined();
  });

  it('renders table column headers', () => {
    render(<RecentAvatars data={mockData} />, { wrapper: Wrapper });
    expect(screen.getByText('name')).toBeDefined();
    expect(screen.getByText('type')).toBeDefined();
    expect(screen.getByText('status')).toBeDefined();
    expect(screen.getByText('date')).toBeDefined();
    expect(screen.getByText('actions')).toBeDefined();
  });

  it('renders avatar names', () => {
    render(<RecentAvatars data={mockData} />, { wrapper: Wrapper });
    expect(screen.getByText('MyAvatar')).toBeDefined();
    expect(screen.getByText('CoolBot')).toBeDefined();
    expect(screen.getByText('FoxGirl')).toBeDefined();
  });

  it('renders empty state when no data', () => {
    render(<RecentAvatars data={[]} />, { wrapper: Wrapper });
    expect(screen.getByText('noAvatars')).toBeDefined();
  });

  it('renders empty state text with centered layout', () => {
    render(<RecentAvatars data={[]} />, { wrapper: Wrapper });
    const emptyDiv = screen.getByText('noAvatars');
    expect(emptyDiv.className).toContain('text-center');
  });

  it('navigates to avatar detail on eye icon click', () => {
    render(<RecentAvatars data={[mockData[0]]} />, { wrapper: Wrapper });
    const eyeBtns = screen.getAllByTestId('icon-eye');
    fireEvent.click(eyeBtns[0].closest('button')!);
    expect(mockPush).toHaveBeenCalledWith('/avatars/a1');
  });

  it('navigates to avatar edit on edit icon click', () => {
    render(<RecentAvatars data={[mockData[1]]} />, { wrapper: Wrapper });
    const editBtns = screen.getAllByTestId('icon-edit');
    fireEvent.click(editBtns[0].closest('button')!);
    expect(mockPush).toHaveBeenCalledWith('/avatars/a2/edit');
  });
});
