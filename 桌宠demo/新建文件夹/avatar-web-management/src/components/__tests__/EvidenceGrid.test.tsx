/**
 * @jest-environment jsdom
 */

import { render, screen } from '@testing-library/react';
import EvidenceGrid from '@/components/ui/EvidenceGrid';

describe('EvidenceGrid', () => {
  it('renders stable auto-fit evidence tracks with the default panel min width', () => {
    render(
      <EvidenceGrid data-testid="evidence-grid">
        <div>Web version</div>
        <div>Desktop version</div>
      </EvidenceGrid>,
    );

    const grid = screen.getByTestId('evidence-grid');
    expect(grid).toHaveStyle({
      display: 'grid',
      gap: '12px',
      gridTemplateColumns: 'repeat(auto-fit, minmax(var(--ds-panel-gridMinWidth), 1fr))',
    });
    expect(grid.textContent).toContain('Web version');
    expect(grid.textContent).toContain('Desktop version');
  });

  it('allows a custom min width, gap, class name, and merged style', () => {
    render(
      <EvidenceGrid
        data-testid="custom-evidence-grid"
        minWidth="180px"
        gap={16}
        className="scan-grid"
        style={{ marginTop: 12 }}
      >
        <div>Connection</div>
      </EvidenceGrid>,
    );

    const grid = screen.getByTestId('custom-evidence-grid');
    expect(grid).toHaveClass('scan-grid');
    expect(grid).toHaveStyle({
      gap: '16px',
      gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))',
      marginTop: '12px',
    });
  });
});
