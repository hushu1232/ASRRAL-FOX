import { NextResponse } from 'next/server';
import { AppError } from './errors';
import { createLogger } from '@/lib/logger';

const log = createLogger('api');

export function success<T>(data: T, status = 200) {
  return NextResponse.json({ success: true, data }, { status });
}

export function error(err: unknown) {
  if (err instanceof AppError) {
    return NextResponse.json(
      { success: false, error: err.message, code: err.code },
      { status: err.statusCode }
    );
  }
  log.error({ err }, 'API Error');
  return NextResponse.json(
    { success: false, error: 'Internal server error' },
    { status: 500 }
  );
}

export function paginated<T>(items: T[], total: number, page: number, pageSize: number) {
  return NextResponse.json({
    success: true,
    data: {
      items,
      total,
      page,
      pageSize,
      totalPages: Math.ceil(total / pageSize),
    },
  });
}
