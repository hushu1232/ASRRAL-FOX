/**
 * @jest-environment jsdom
 */

import { render, screen } from '@testing-library/react';
import LoadingState from '@/components/ui/LoadingState';

describe('LoadingState', () => {
  it('renders a stable shared page loading surface', () => {
    render(<LoadingState />);

    const shell = screen.getByTestId('loading-state');
    expect(shell.className).toContain('min-h-[220px]');
    expect(shell.querySelector('.ant-spin')).toBeDefined();
  });
});
