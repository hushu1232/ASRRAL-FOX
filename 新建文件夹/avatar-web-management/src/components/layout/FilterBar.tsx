'use client';

import { Input, Select, Space, Button } from 'antd';
import { SearchOutlined, FilterOutlined, SortAscendingOutlined } from '@ant-design/icons';
import { useSearchParams, useRouter, usePathname } from 'next/navigation';
import { useCallback } from 'react';

export interface FilterField {
  key: string;
  label: string;
  type: 'search' | 'select';
  options?: { value: string; label: string }[];
  placeholder?: string;
}

export interface SortOption {
  value: string;
  label: string;
}

interface Props {
  filters: FilterField[];
  sortOptions?: SortOption[];
  defaultSort?: string;
}

export default function FilterBar({ filters, sortOptions, defaultSort }: Props) {
  const searchParams = useSearchParams();
  const router = useRouter();
  const pathname = usePathname();

  const updateParam = useCallback(
    (key: string, value: string) => {
      const params = new URLSearchParams(searchParams.toString());
      if (value) {
        params.set(key, value);
      } else {
        params.delete(key);
      }
      router.push(`${pathname}?${params.toString()}`);
    },
    [searchParams, router, pathname],
  );

  const clearAll = () => {
    router.push(pathname);
  };

  const hasFilters = Array.from(searchParams.keys()).some((k) => k !== 'page');

  return (
    <div
      className="flex flex-wrap items-center gap-3 p-3 rounded-lg mb-4"
      style={{
        background: 'var(--bg-card)',
        border: '1px solid var(--border-subtle)',
      }}
    >
      <FilterOutlined style={{ color: 'var(--text-muted)' }} />
      <Space wrap size="small">
        {filters.map((field) => {
          if (field.type === 'search') {
            return (
              <Input
                key={field.key}
                prefix={<SearchOutlined style={{ color: 'var(--text-muted)' }} />}
                placeholder={field.placeholder || field.label}
                value={searchParams.get(field.key) || ''}
                onChange={(e) => updateParam(field.key, e.target.value)}
                allowClear
                style={{ width: 200 }}
              />
            );
          }
          return (
            <Select
              key={field.key}
              placeholder={field.label}
              value={searchParams.get(field.key) || undefined}
              onChange={(v) => updateParam(field.key, v || '')}
              allowClear
              options={field.options}
              style={{ minWidth: 120 }}
            />
          );
        })}
        {sortOptions && (
          <Select
            prefix={<SortAscendingOutlined style={{ color: 'var(--text-muted)' }} />}
            placeholder="Sort by"
            value={searchParams.get('sort') || defaultSort || undefined}
            onChange={(v) => updateParam('sort', v || '')}
            options={sortOptions}
            style={{ minWidth: 140 }}
          />
        )}
        {hasFilters && (
          <Button type="link" size="small" onClick={clearAll}>
            Clear all
          </Button>
        )}
      </Space>
    </div>
  );
}
