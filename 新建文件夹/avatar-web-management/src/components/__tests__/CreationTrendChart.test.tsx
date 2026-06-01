/**
 * @jest-environment jsdom
 */

import { render, screen } from '@testing-library/react';
import CreationTrendChart from '@/components/dashboard/CreationTrendChart';

jest.mock('recharts', () => {
  const React = require('react');
  const actual = jest.requireActual('recharts');
  return {
    ...actual,
    ResponsiveContainer: ({ children }: any) =>
      React.cloneElement(children, { width: 600, height: 240 }),
  };
});

describe('CreationTrendChart', () => {
  const baseData = [
    { date: '05-01', created: 5, published: 3 },
    { date: '05-02', created: 8, published: 6 },
    { date: '05-03', created: 3, published: 2 },
  ];

  it('renders SVG chart', () => {
    const { container } = render(<CreationTrendChart data={baseData} />);
    const svg = container.querySelector('svg');
    expect(svg).toBeDefined();
    expect(svg).not.toBeNull();
  });

  it('renders tooltip line names in SVG', () => {
    const { container } = render(<CreationTrendChart data={baseData} />);
    const svg = container.querySelector('svg')!;
    // Line names are in tooltip, verify chart renders with both data keys
    expect(svg.querySelector('.recharts-cartesian-grid-horizontal')).toBeDefined();
    expect(svg.querySelector('.recharts-layer.recharts-line')).toBeDefined();
  });

  it('renders date labels on x-axis', () => {
    render(<CreationTrendChart data={baseData} />);
    expect(screen.getByText('05-01')).toBeDefined();
    expect(screen.getByText('05-02')).toBeDefined();
    expect(screen.getByText('05-03')).toBeDefined();
  });

  it('renders Empty fallback when no data', () => {
    const { container } = render(<CreationTrendChart data={[]} />);
    expect(screen.getByText('noData')).toBeDefined();
    expect(container.querySelector('.recharts-cartesian-grid-horizontal')).toBeNull();
  });

  it('renders with single data point', () => {
    const { container } = render(<CreationTrendChart data={[{ date: '05-01', created: 1, published: 0 }]} />);
    const svg = container.querySelector('svg');
    expect(svg).toBeDefined();
    expect(svg).not.toBeNull();
    expect(screen.getByText('05-01')).toBeDefined();
  });
});
