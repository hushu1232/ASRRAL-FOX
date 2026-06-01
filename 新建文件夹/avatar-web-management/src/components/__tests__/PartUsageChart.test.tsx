/**
 * @jest-environment jsdom
 */

import { render, screen } from '@testing-library/react';
import PartUsageChart from '@/components/dashboard/PartUsageChart';

jest.mock('recharts', () => {
  const React = require('react');
  const actual = jest.requireActual('recharts');
  return {
    ...actual,
    ResponsiveContainer: ({ children }: any) =>
      React.cloneElement(children, { width: 600, height: 240 }),
  };
});

describe('PartUsageChart', () => {
  const baseData = [
    { name: 'head', count: 45 },
    { name: 'hair', count: 38 },
    { name: 'body', count: 30 },
    { name: 'tail', count: 22 },
  ];

  it('renders SVG chart', () => {
    const { container } = render(<PartUsageChart data={baseData} />);
    const svg = container.querySelector('svg');
    expect(svg).toBeDefined();
    expect(svg).not.toBeNull();
  });

  it('renders part names as y-axis labels', () => {
    render(<PartUsageChart data={baseData} />);
    expect(screen.getByText('head')).toBeDefined();
    expect(screen.getByText('hair')).toBeDefined();
    expect(screen.getByText('body')).toBeDefined();
    expect(screen.getByText('tail')).toBeDefined();
  });

  it('renders bar chart with correct layout', () => {
    const { container } = render(<PartUsageChart data={baseData} />);
    const svg = container.querySelector('svg')!;
    // Horizontal bar chart renders bars for each data point
    expect(svg.querySelector('.recharts-bar-rectangles')).toBeDefined();
    expect(svg.querySelector('.recharts-cartesian-grid-horizontal')).toBeDefined();
  });

  it('renders Empty fallback when no data', () => {
    const { container } = render(<PartUsageChart data={[]} />);
    expect(screen.getByText('noData')).toBeDefined();
    expect(container.querySelector('.recharts-bar-rectangles')).toBeNull();
  });

  it('renders with single data point', () => {
    render(<PartUsageChart data={[{ name: 'head', count: 5 }]} />);
    expect(screen.getByText('head')).toBeDefined();
  });

  it('handles long part names', () => {
    render(<PartUsageChart data={[{ name: 'very_long_part_name_test', count: 10 }]} />);
    expect(screen.getByText('very_long_part_name_test')).toBeDefined();
  });
});
