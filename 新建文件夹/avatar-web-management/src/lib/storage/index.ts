// 存储适配器工厂 — 根据环境变量选择本地或 MinIO 存储
import { createLogger } from '@/lib/logger';
import type { StorageAdapter } from './types';
import { LocalStorageAdapter } from './fs';
import { MinioStorageAdapter } from './minio';

const log = createLogger('storage');

let _adapter: StorageAdapter | null = null;

export type { StorageAdapter } from './types';
export { LocalStorageAdapter } from './fs';
export { MinioStorageAdapter } from './minio';

export function getStorageAdapter(): StorageAdapter {
  if (_adapter) return _adapter;

  const useMinio = process.env.STORAGE_DRIVER === 'minio' || process.env.STORAGE_ENDPOINT;
  if (useMinio) {
    log.info('Using MinIO/S3 adapter');
    _adapter = new MinioStorageAdapter();
  } else {
    log.info('Using local filesystem adapter');
    _adapter = new LocalStorageAdapter();
  }
  return _adapter;
}
