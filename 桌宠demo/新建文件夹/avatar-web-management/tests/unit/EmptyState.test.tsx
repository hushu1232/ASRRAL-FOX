/**
 * @jest-environment jsdom
 */

import { render, screen, fireEvent } from '@testing-library/react';
import EmptyState from '@/components/ui/EmptyState';

describe('EmptyState', () => {
  it('renders description text', () => {
    render(<EmptyState description="No items found" />);
    expect(screen.getByText('No items found')).toBeInTheDocument();
  });

  it('renders action button when onAction is provided', () => {
    const onAction = jest.fn();
    render(<EmptyState description="Empty" actionLabel="Create" onAction={onAction} />);
    fireEvent.click(screen.getByText('Create'));
    expect(onAction).toHaveBeenCalledTimes(1);
  });

  it('renders compact variant', () => {
    const { container } = render(<EmptyState variant="compact" />);
    expect(container.querySelector('.py-8')).toBeInTheDocument();
  });

  it('renders default variant with py-16', () => {
    const { container } = render(<EmptyState />);
    expect(container.querySelector('.py-16')).toBeInTheDocument();
  });
});
