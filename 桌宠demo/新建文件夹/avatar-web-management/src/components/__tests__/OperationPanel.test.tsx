/**
 * @jest-environment jsdom
 */

import '@testing-library/jest-dom';
import { SettingOutlined } from '@ant-design/icons';
import { render, screen } from '@testing-library/react';
import { App } from 'antd';
import type { ReactNode } from 'react';
import OperationPanel from '@/components/ui/OperationPanel';
import MetricTile from '@/components/ui/MetricTile';
import StatusChip from '@/components/ui/StatusChip';

function Wrapper({ children }: { children: ReactNode }) {
  return <App>{children}</App>;
}

describe('operational UI primitives', () => {
  it('renders an operation panel with title, extra content, and tokenized body', () => {
    render(
      <OperationPanel
        id="runtime-panel"
        role="region"
        title="Runtime sync"
        extra={<button type="button">Refresh</button>}
        style={{ background: 'var(--bg-card-override)' }}
      >
        <p>Desktop is online</p>
      </OperationPanel>,
      { wrapper: Wrapper },
    );

    const panel = screen.getByRole('region');
    expect(panel).toHaveAttribute('id', 'runtime-panel');
    expect(panel).toHaveStyle({
      borderRadius: 'var(--ds-panel-radius)',
      background: 'var(--bg-card-override)',
    });
    expect(screen.getByText('Runtime sync')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Refresh' })).toBeInTheDocument();
    expect(screen.getByText('Desktop is online')).toBeInTheDocument();
  });

  it('renders metric tile details and root attributes without dropping falsy content', () => {
    render(
      <MetricTile
        id="version-tile"
        role="status"
        className="custom-metric"
        data-testid="metric-tile"
        aria-label="Published web version"
        label="Web version"
        value="12"
        detail={0}
        style={{ padding: '2px' }}
      />,
      {
        wrapper: Wrapper,
      },
    );

    const tile = screen.getByTestId('metric-tile');
    expect(tile).toHaveAttribute('id', 'version-tile');
    expect(tile).toHaveAttribute('role', 'status');
    expect(tile).toHaveAccessibleName('Published web version');
    expect(tile).toHaveClass('custom-metric');
    expect(tile).toHaveStyle({
      borderRadius: 'var(--ds-panel-radius)',
      padding: '2px',
    });
    expect(screen.getByText('Web version')).toBeInTheDocument();
    expect(screen.getByText('12')).toBeInTheDocument();
    expect(screen.getByText('0')).toBeInTheDocument();
  });

  it('maps status chip tones and preserves tag pass-through props', () => {
    render(
      <StatusChip
        tone="warning"
        aria-label="Needs local confirmation"
        className="custom-chip"
        data-testid="status-chip"
        icon={<SettingOutlined aria-hidden />}
        style={{ marginInlineEnd: 8 }}
        title="Local"
      >
        Local confirmation
      </StatusChip>,
      { wrapper: Wrapper },
    );

    const chip = screen.getByTestId('status-chip');
    expect(chip.className).toContain('ant-tag-warning');
    expect(chip).toHaveClass('custom-chip');
    expect(chip).toHaveAttribute('title', 'Local');
    expect(chip).toHaveAccessibleName('Needs local confirmation');
    expect(chip).toHaveStyle({
      borderRadius: 'var(--ds-control-pillRadius)',
      marginInlineEnd: '8px',
    });
    expect(screen.getByText('Local confirmation')).toBeInTheDocument();
  });
});
