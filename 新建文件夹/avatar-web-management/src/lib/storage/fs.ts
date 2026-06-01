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
    let normalizedKey = key;
    if (normalizedKey.startsWith(BASE_URL + '/')) {
      normalizedKey = normalizedKey.slice(BASE_URL.length + 1);
    } else if (normalizedKey.startsWith('/uploads/') && BASE_URL !== '/uploads') {
      normalizedKey = normalizedKey.slice('/uploads/'.length);
    }
    return normalizedKey;
  }

  async upload(key: string, buffer: Buffer, _contentType?: string): Promise<string> {
    const normalizedKey = this.normalizeKey(key);
    const filePath = path.join(this.baseDir, normalizedKey);
    ensureDir(path.dirname(filePath));
    fs.writeFileSync(filePath, buffer);
    return `${BASE_URL}/${normalizedKey}`;
  }

  async getFileUrl(key: string): Promise<string> {
    if (key.startsWith('/uploads/') || key.startsWith(BASE_URL + '/')) {
      return key;
    }
    return `${BASE_URL}/${key}`;
  }

  async delete(key: string): Promise<void> {
    const filePath = path.join(this.baseDir, key);
    if (fs.existsSync(filePath)) {
      fs.unlinkSync(filePath);
    }
  }

  async exists(key: string): Promise<boolean> {
    return fs.existsSync(path.join(this.baseDir, key));
  }

  // ---- 分块上传 ----

  async initChunkedUpload(finalKey: string, _contentType?: string): Promise<string> {
    const normalizedKey = this.normalizeKey(finalKey);
    const uploadId = `upload_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`;
    const chunkDir = path.join(this.chunksDir, uploadId);
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
    const chunkDir = path.join(this.chunksDir, uploadId);
    ensureDir(chunkDir);
    fs.writeFileSync(path.join(chunkDir, `chunk_${chunkIndex.toString().padStart(6, '0')}`), buffer);
  }

  async assembleChunks(uploadId: string, chunks: number, finalKey: string, _contentType?: string): Promise<string> {
    const chunkDir = path.join(this.chunksDir, uploadId);
    const normalizedKey = this.normalizeKey(finalKey);
    const finalPath = path.join(this.baseDir, normalizedKey);

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
    const chunkDir = path.join(this.chunksDir, uploadId);
    if (fs.existsSync(chunkDir)) {
      fs.rmSync(chunkDir, { recursive: true, force: true });
    }
  }

  async getUploadedChunks(uploadId: string): Promise<number[]> {
    const chunkDir = path.join(this.chunksDir, uploadId);
    if (!fs.existsSync(chunkDir)) return [];
    const files = fs.readdirSync(chunkDir);
    return files
      .filter(f => f.startsWith('chunk_'))
      .map(f => parseInt(f.replace('chunk_', ''), 10))
      .filter(n => !isNaN(n));
  }
}
