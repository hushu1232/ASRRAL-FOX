/**
 * @jest-environment jsdom
 */

import { render, screen, fireEvent } from '@testing-library/react';
import BulkActionBar from '@/components/layout/BulkActionBar';

describe('BulkActionBar', () => {
  it('returns null when selectedCount is 0', () => {
    const { container } = render(
      <BulkActionBar selectedCount={0} selectedIds={[]} actions={[]} onClear={jest.fn()} />,
    );
    expect(container.firstChild).toBeNull();
  });

  it('shows selected count', () => {
    render(
      <BulkActionBar selectedCount={3} selectedIds={['a', 'b', 'c']} actions={[]} onClear={jest.fn()} />,
    );
    expect(screen.getByText('3 selected')).toBeInTheDocument();
  });

  it('calls action with selectedIds and clears', () => {
    const onAction = jest.fn();
    const onClear = jest.fn();
    render(
      <BulkActionBar
        selectedCount={2}
        selectedIds={['x', 'y']}
        actions={[{ key: 'delete', label: 'Delete', onClick: onAction, danger: true }]}
        onClear={onClear}
      />,
    );
    fireEvent.click(screen.getByText('Delete'));
    expect(onAction).toHaveBeenCalledWith(['x', 'y']);
    expect(onClear).toHaveBeenCalled();
  });
});
