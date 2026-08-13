// 本地文件系统存储（开发环境回退）
import fs from 'fs';
import path from 'path';
import type { StorageAdapter } from './types';

const BASE_URL = '/uploads';

function ensureDir(dir: string) {
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
}

export class LocalStorageAdapter implements StorageAdapter {
  private baseDir: string;

  constructor(baseDir?: string) {
    this.baseDir = baseDir || process.env.STORAGE_LOCAL_DIR || path.join(process.cwd(), 'public', 'uploads');
  }

  private get chunksDir(): string {
    return path.join(this.baseDir, '.chunks');
  }

  private normalizeKey(key: string): string {
    if (typeof key !== 'string' || key.length === 0 || key.includes('\0')) {
      throw new Error('Invalid storage key');
    }

    let normalizedKey = key.startsWith(BASE_URL + '/')
      ? key.slice(BASE_URL.length + 1)
      : key;
    normalizedKey = normalizedKey.replace(/\\/g, '/');

    if (normalizedKey.startsWith('/') || /^[A-Za-z]:\//.test(normalizedKey)) {
      throw new Error('Invalid storage key');
    }

    const segments = normalizedKey.split('/');
    if (segments.some((segment) => segment === '..')) {
      throw new Error('Invalid storage key');
    }

    normalizedKey = path.posix.normalize(normalizedKey);
    if (normalizedKey === '.' || normalizedKey.startsWith('../') || normalizedKey.includes('/../')) {
      throw new Error('Invalid storage key');
    }
    return normalizedKey;
  }

  private resolveKey(key: string): { normalizedKey: string; filePath: string } {
    const normalizedKey = this.normalizeKey(key);
    const basePath = path.resolve(this.baseDir);
    const filePath = path.resolve(basePath, normalizedKey);
    if (filePath !== basePath && !filePath.startsWith(`${basePath}${path.sep}`)) {
      throw new Error('Invalid storage key');
    }
    return { normalizedKey, filePath };
  }

  private resolveChunkDir(uploadId: string): string {
    if (typeof uploadId !== 'string' || uploadId.length === 0 || uploadId.includes('\0') || /[\\/]/.test(uploadId)) {
      throw new Error('Invalid upload id');
    }
    const chunksRoot = path.resolve(this.chunksDir);
    const chunkDir = path.resolve(chunksRoot, uploadId);
    if (!chunkDir.startsWith(`${chunksRoot}${path.sep}`)) {
      throw new Error('Invalid upload id');
    }
    return chunkDir;
  }

  async upload(key: string, buffer: Buffer, contentType?: string): Promise<string> {
    void contentType;
    const { normalizedKey, filePath } = this.resolveKey(key);
    ensureDir(path.dirname(filePath));
    fs.writeFileSync(filePath, buffer);
    return `${BASE_URL}/${normalizedKey}`;
  }

  async getFileUrl(key: string): Promise<string> {
    const { normalizedKey } = this.resolveKey(key);
    return `${BASE_URL}/${normalizedKey}`;
  }

  getFilePath(key: string): string {
    return this.resolveKey(key).filePath;
  }

  async delete(key: string): Promise<void> {
    const { filePath } = this.resolveKey(key);
    if (fs.existsSync(filePath)) {
      fs.unlinkSync(filePath);
    }
  }

  async exists(key: string): Promise<boolean> {
    return fs.existsSync(this.resolveKey(key).filePath);
  }

  // ---- 分块上传 ----

  async initChunkedUpload(finalKey: string, _contentType?: string): Promise<string> {
    const { normalizedKey } = this.resolveKey(finalKey);
    const uploadId = `upload_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`;
    const chunkDir = this.resolveChunkDir(uploadId);
    ensureDir(chunkDir);

    const meta = {
      uploadId,
      finalKey: normalizedKey,
      contentType: _contentType || 'application/octet-stream',
      createdAt: Date.now(),
    };
    fs.writeFileSync(path.join(chunkDir, '.meta.json'), JSON.stringify(meta));
    return uploadId;
  }

  async uploadChunk(uploadId: string, chunkIndex: number, buffer: Buffer): Promise<void> {
    const chunkDir = this.resolveChunkDir(uploadId);
    ensureDir(chunkDir);
    fs.writeFileSync(path.join(chunkDir, `chunk_${chunkIndex.toString().padStart(6, '0')}`), buffer);
  }

  async assembleChunks(uploadId: string, chunks: number, finalKey: string, contentType?: string): Promise<string> {
    void contentType;
    const chunkDir = this.resolveChunkDir(uploadId);
    const { normalizedKey, filePath: finalPath } = this.resolveKey(finalKey);

    // Verify all chunks exist before assembling
    for (let i = 0; i < chunks; i++) {
      const chunkPath = path.join(chunkDir, `chunk_${i.toString().padStart(6, '0')}`);
      if (!fs.existsSync(chunkPath)) {
        throw new Error(`Missing chunk ${i} for upload ${uploadId}`);
      }
    }

    ensureDir(path.dirname(finalPath));

    // Concatenate chunks into final file
    const buffers: Buffer[] = [];
    for (let i = 0; i < chunks; i++) {
      const chunkPath = path.join(chunkDir, `chunk_${i.toString().padStart(6, '0')}`);
      buffers.push(fs.readFileSync(chunkPath));
    }
    fs.writeFileSync(finalPath, Buffer.concat(buffers));

    // Clean up chunk temp files
    fs.rmSync(chunkDir, { recursive: true, force: true });

    return `${BASE_URL}/${normalizedKey}`;
  }

  async abortChunkedUpload(uploadId: string): Promise<void> {
    const chunkDir = this.resolveChunkDir(uploadId);
    if (fs.existsSync(chunkDir)) {
      fs.rmSync(chunkDir, { recursive: true, force: true });
    }
  }

  async getUploadedChunks(uploadId: string): Promise<number[]> {
    const chunkDir = this.resolveChunkDir(uploadId);
    if (!fs.existsSync(chunkDir)) return [];
    const files = fs.readdirSync(chunkDir);
    return files
      .filter(f => f.startsWith('chunk_'))
      .map(f => parseInt(f.replace('chunk_', ''), 10))
      .filter(n => !isNaN(n));
  }
}
