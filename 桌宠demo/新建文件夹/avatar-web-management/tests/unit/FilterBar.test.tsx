/**
 * @jest-environment jsdom
 */

import { render, screen } from '@testing-library/react';
import FilterBar from '@/components/layout/FilterBar';

describe('FilterBar', () => {
  it('renders filter icon and search input', () => {
    render(
      <FilterBar
        filters={[{ key: 'q', label: 'Search', type: 'search', placeholder: 'Search...' }]}
      />,
    );
    expect(screen.getByPlaceholderText('Search...')).toBeInTheDocument();
  });

  it('renders select filters', () => {
    render(
      <FilterBar
        filters={[
          {
            key: 'status',
            label: 'Status',
            type: 'select',
            options: [
              { value: 'published', label: 'Published' },
              { value: 'draft', label: 'Draft' },
            ],
          },
        ]}
      />,
    );
    expect(screen.getByText('Status')).toBeInTheDocument();
  });

  it('renders sort select when options provided', () => {
    render(
      <FilterBar
        filters={[]}
        sortOptions={[
          { value: 'updated_at', label: 'Last Updated' },
          { value: 'created_at', label: 'Created' },
        ]}
      />,
    );
    expect(screen.getByText('Sort by')).toBeInTheDocument();
  });
});
