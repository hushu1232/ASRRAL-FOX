/**
 * @jest-environment jsdom
 */

import { fireEvent, render, screen } from '@testing-library/react';
import EmptyState from '@/components/ui/EmptyState';

describe('EmptyState', () => {
  it('renders a stable shared empty surface with explicit copy and action', () => {
    const onAction = jest.fn();

    render(<EmptyState description="No assets yet" actionLabel="Upload" onAction={onAction} />);

    const shell = screen.getByTestId('empty-state');
    expect(shell.className).toContain('min-h-[160px]');
    expect(screen.getByText('No assets yet')).toBeDefined();

    fireEvent.click(screen.getByRole('button', { name: 'Upload' }));

    expect(onAction).toHaveBeenCalledTimes(1);
  });

  it('does not inject a hard-coded English default message', () => {
    render(<EmptyState />);

    expect(screen.getByTestId('empty-state')).toBeDefined();
    expect(screen.queryByText('No data available')).toBeNull();
  });
});
