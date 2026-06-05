// SWR 客户端数据缓存 Hook — 自动去重、缓存、重新验证
import useSWR, { type SWRConfiguration } from 'swr';
import { apiGet } from '@/lib/api-client';
import type { ApiResponse, PaginatedResponse } from '@/lib/api-client';

/**
 * SWR fetcher — 包装 apiGet
 */
function fetcher<T>(url: string): Promise<ApiResponse<T>> {
  return apiGet<T>(url);
}

/**
 * 通用 GET 请求 Hook（列表、详情均适用）
 * 默认 dedupingInterval = 30s，避免短时间内重复请求
 */
export function useApiGet<T>(
  path: string | null,
  params?: Record<string, string>,
  config?: SWRConfiguration,
) {
  // Build SWR key with query params
  const searchParams = params
    ? '?' + new URLSearchParams(params).toString()
    : '';
  const key = path ? `${path}${searchParams}` : null;

  return useSWR<ApiResponse<T>>(key, fetcher, {
    dedupingInterval: 5_000,
    revalidateOnFocus: true,
    ...config,
  });
}

/**
 * 分页列表 Hook
 */
export function useApiPaginated<T>(
  path: string | null,
  params?: Record<string, string>,
  config?: SWRConfiguration,
) {
  return useApiGet<PaginatedResponse<T>>(path, params, config);
}

export type { ApiResponse, PaginatedResponse };
