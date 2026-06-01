// MinIO / S3 兼容对象存储
import { Client as MinioClient, CopySourceOptions, CopyDestinationOptions } from 'minio';
import { createLogger } from '@/lib/logger';
import type { StorageAdapter } from './types';

const log = createLogger('storage:minio');

function getMinioConfig() {
  const endpoint = process.env.STORAGE_ENDPOINT || 'localhost';
  const port = parseInt(process.env.STORAGE_PORT || '9000', 10);
  const useSSL = process.env.STORAGE_USE_SSL === 'true';
  const accessKey = process.env.STORAGE_ACCESS_KEY || 'minioadmin';
  const secretKey = process.env.STORAGE_SECRET_KEY || 'minioadmin123';
  const bucket = process.env.STORAGE_BUCKET || 'avatar-assets';
  const publicUrl = process.env.STORAGE_PUBLIC_URL || `http://localhost:${port}`;

  return { endpoint, port, useSSL, accessKey, secretKey, bucket, publicUrl };
}

let _client: MinioClient | null = null;
let _bucket: string | null = null;
let _publicUrl: string | null = null;

function getClient(): { client: MinioClient; bucket: string; publicUrl: string } {
  if (!_client) {
    const config = getMinioConfig();
    _client = new MinioClient({
      endPoint: config.endpoint,
      port: config.port,
      useSSL: config.useSSL,
      accessKey: config.accessKey,
      secretKey: config.secretKey,
    });
    _bucket = config.bucket;
    _publicUrl = config.publicUrl;
  }
  return { client: _client, bucket: _bucket!, publicUrl: _publicUrl! };
}

async function ensureBucket(client: MinioClient, bucket: string) {
  const exists = await client.bucketExists(bucket);
  if (!exists) {
    await client.makeBucket(bucket);
    // 允许公开读取
    await client.setBucketPolicy(
      bucket,
      JSON.stringify({
        Version: '2012-10-17',
        Statement: [
          {
            Effect: 'Allow',
            Principal: { AWS: ['*'] },
            Action: ['s3:GetObject'],
            Resource: [`arn:aws:s3:::${bucket}/*`],
          },
        ],
      })
    );
    log.info('Created bucket: %s', bucket);
  }
}

export class MinioStorageAdapter implements StorageAdapter {
  async upload(key: string, buffer: Buffer, contentType?: string): Promise<string> {
    const { client, bucket } = getClient();
    await ensureBucket(client, bucket);

    await client.putObject(bucket, key, buffer, buffer.length, {
      'Content-Type': contentType || 'application/octet-stream',
    });

    return key;
  }

  async getFileUrl(key: string): Promise<string> {
    const { client, bucket, publicUrl } = getClient();
    return client.presignedGetObject(bucket, key, 7 * 24 * 60 * 60);
  }

  async delete(key: string): Promise<void> {
    const { client, bucket } = getClient();
    await client.removeObject(bucket, key);
  }

  async exists(key: string): Promise<boolean> {
    try {
      const { client, bucket } = getClient();
      await client.statObject(bucket, key);
      return true;
    } catch {
      return false;
    }
  }

  // ---- Chunked upload ----
  // Chunk objects are stored as: .chunks/<uploadId>/chunk_000000
  // Uses MinIO composeObject for server-side assembly

  private chunkPrefix(uploadId: string): string {
    return `.chunks/${uploadId}`;
  }

  private chunkKey(uploadId: string, chunkIndex: number): string {
    return `${this.chunkPrefix(uploadId)}/chunk_${chunkIndex.toString().padStart(6, '0')}`;
  }

  async initChunkedUpload(finalKey: string, contentType?: string): Promise<string> {
    const { client, bucket } = getClient();
    await ensureBucket(client, bucket);

    const uploadId = `upload_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`;
    const meta = JSON.stringify({
      uploadId,
      finalKey,
      contentType: contentType || 'application/octet-stream',
      createdAt: Date.now(),
    });
    await client.putObject(bucket, `${this.chunkPrefix(uploadId)}/.meta.json`, meta, meta.length, {
      'Content-Type': 'application/json',
    });

    return uploadId;
  }

  async uploadChunk(uploadId: string, chunkIndex: number, buffer: Buffer): Promise<void> {
    const { client, bucket } = getClient();
    await client.putObject(bucket, this.chunkKey(uploadId, chunkIndex), buffer, buffer.length, {
      'Content-Type': 'application/octet-stream',
    });
  }

  async assembleChunks(uploadId: string, chunks: number, finalKey: string, contentType?: string): Promise<string> {
    const { client, bucket } = getClient();
    await ensureBucket(client, bucket);

    const sources = [];
    for (let i = 0; i < chunks; i++) {
      sources.push(new CopySourceOptions({ Bucket: bucket, Object: this.chunkKey(uploadId, i) }));
    }

    // Limit batch size — MinIO/S3 composeObject supports at most 32 sources per call
    const MAX_SOURCES = 32;
    let mergedKey = finalKey;

    if (chunks <= MAX_SOURCES) {
      await client.composeObject(
        new CopyDestinationOptions({
          Bucket: bucket,
          Object: finalKey,
          Headers: { 'Content-Type': contentType || 'application/octet-stream' },
        }),
        sources
      );
    } else {
      // Multi-step merge for large number of chunks
      await client.composeObject(
        new CopyDestinationOptions({ Bucket: bucket, Object: finalKey }),
        sources.slice(0, MAX_SOURCES)
      );

      // Merge remaining in batches to a temp key, then combine
      let offset = MAX_SOURCES;
      const tempKey = `${finalKey}.tmp_merge`;
      while (offset < chunks) {
        const batch = sources.slice(offset, offset + MAX_SOURCES);
        await client.composeObject(
          new CopyDestinationOptions({ Bucket: bucket, Object: tempKey }),
          [new CopySourceOptions({ Bucket: bucket, Object: finalKey }), ...batch]
        );
        // Copy temp back to final
        await client.copyObject(
          new CopySourceOptions({ Bucket: bucket, Object: tempKey }),
          new CopyDestinationOptions({ Bucket: bucket, Object: finalKey })
        );
        await client.removeObject(bucket, tempKey);
        offset += MAX_SOURCES;
      }
    }

    // Cleanup chunk objects
    const chunkPrefix = this.chunkPrefix(uploadId);
    const stream = client.listObjects(bucket, chunkPrefix, true);
    const deleteKeys: string[] = [];
    await new Promise<void>((resolve, reject) => {
      stream.on('data', (obj: { name: string }) => {
        deleteKeys.push(obj.name);
      });
      stream.on('end', () => resolve());
      stream.on('error', reject);
    });

    if (deleteKeys.length > 0) {
      await client.removeObjects(bucket, deleteKeys);
    }

    return finalKey;
  }

  async abortChunkedUpload(uploadId: string): Promise<void> {
    const { client, bucket } = getClient();
    const prefix = this.chunkPrefix(uploadId);
    const stream = client.listObjects(bucket, prefix, true);
    const deleteKeys: string[] = [];
    await new Promise<void>((resolve, reject) => {
      stream.on('data', (obj: { name: string }) => {
        deleteKeys.push(obj.name);
      });
      stream.on('end', () => resolve());
      stream.on('error', reject);
    });

    if (deleteKeys.length > 0) {
      await client.removeObjects(bucket, deleteKeys);
    }
  }

  async getUploadedChunks(uploadId: string): Promise<number[]> {
    const { client, bucket } = getClient();
    const prefix = this.chunkPrefix(uploadId);
    const chunks: number[] = [];

    const stream = client.listObjects(bucket, `${prefix}/chunk_`, true);
    await new Promise<void>((resolve, reject) => {
      stream.on('data', (obj: { name: string }) => {
        const match = obj.name.match(/chunk_(\d+)$/);
        if (match) {
          chunks.push(parseInt(match[1], 10));
        }
      });
      stream.on('end', () => resolve());
      stream.on('error', reject);
    });

    return chunks;
  }
}
