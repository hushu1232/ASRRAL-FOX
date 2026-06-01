/**
 * @jest-environment jsdom
 */

import { render, screen } from '@testing-library/react';
import { App } from 'antd';
import KpiCards from '@/components/dashboard/KpiCards';

jest.mock('@ant-design/icons', () => ({
  PictureOutlined: () => <span data-testid="icon-picture" />,
  FileAddOutlined: () => <span data-testid="icon-file-add" />,
  ClockCircleOutlined: () => <span data-testid="icon-clock" />,
  CloudOutlined: () => <span data-testid="icon-cloud" />,
  ShopOutlined: () => <span data-testid="icon-shop" />,
  DollarOutlined: () => <span data-testid="icon-dollar" />,
}));

function Wrapper({ children }: { children: React.ReactNode }) {
  return <App>{children}</App>;
}

const baseProps = {
  totalAvatars: 42,
  createdThisMonth: 7,
  pendingReviews: 3,
  totalStorage: 524288000, // 500 MB
};

describe('KpiCards', () => {
  it('renders 4 core KPI cards', () => {
    render(<KpiCards {...baseProps} />, { wrapper: Wrapper });
    expect(screen.getByText('totalAvatars')).toBeDefined();
    expect(screen.getByText('thisMonthCreations')).toBeDefined();
    expect(screen.getByText('approvalPending')).toBeDefined();
    expect(screen.getByText('storageUsed')).toBeDefined();
  });

  it('renders numeric values', () => {
    render(<KpiCards {...baseProps} />, { wrapper: Wrapper });
    // Ant Design Statistic renders value in .ant-statistic-content-value
    expect(screen.getByText('42')).toBeDefined();
    expect(screen.getByText('7')).toBeDefined();
    expect(screen.getByText('3')).toBeDefined();
  });

  it('formats storage bytes to readable value', () => {
    render(<KpiCards {...baseProps} />, { wrapper: Wrapper });
    expect(screen.getByText('500.0 MB')).toBeDefined();
  });

  it('renders zero storage as "0 B"', () => {
    render(<KpiCards {...baseProps} totalStorage={0} />, { wrapper: Wrapper });
    expect(screen.getByText('0 B')).toBeDefined();
  });

  it('renders zero avatars as 0, not NaN', () => {
    render(<KpiCards {...baseProps} totalAvatars={0} createdThisMonth={0} pendingReviews={0} />, { wrapper: Wrapper });
    const zeros = screen.getAllByText('0');
    expect(zeros.length).toBeGreaterThanOrEqual(3);
  });

  it('shows market items card when marketItemsCount is provided', () => {
    render(<KpiCards {...baseProps} marketItemsCount={15} />, { wrapper: Wrapper });
    expect(screen.getByText('marketItems')).toBeDefined();
    expect(screen.getByText('15')).toBeDefined();
  });

  it('shows market revenue card when marketRevenue is provided', () => {
    render(<KpiCards {...baseProps} marketRevenue={12800} />, { wrapper: Wrapper });
    expect(screen.getByText('marketRevenue')).toBeDefined();
    expect(screen.getByText('¥12,800')).toBeDefined();
  });

  it('hides market items when marketItemsCount is undefined', () => {
    render(<KpiCards {...baseProps} />, { wrapper: Wrapper });
    expect(screen.queryByText('marketItems')).toBeNull();
    expect(screen.queryByText('marketRevenue')).toBeNull();
  });

  it('renders all 6 cards when both market props provided', () => {
    render(<KpiCards {...baseProps} marketItemsCount={10} marketRevenue={5000} />, { wrapper: Wrapper });
    expect(screen.getByText('totalAvatars')).toBeDefined();
    expect(screen.getByText('thisMonthCreations')).toBeDefined();
    expect(screen.getByText('approvalPending')).toBeDefined();
    expect(screen.getByText('storageUsed')).toBeDefined();
    expect(screen.getByText('marketItems')).toBeDefined();
    expect(screen.getByText('marketRevenue')).toBeDefined();
  });

  it('renders large numbers with locale formatting for revenue', () => {
    render(<KpiCards {...baseProps} marketRevenue={1234567} />, { wrapper: Wrapper });
    expect(screen.getByText('¥1,234,567')).toBeDefined();
  });
});
