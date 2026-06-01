// 异步处理管道 — 上传后处理（缩略图生成、元数据提取）
import sharp from 'sharp';
import { getDb } from '@/lib/db';
import { getStorageAdapter } from './index';
import { createLogger } from '@/lib/logger';

const log = createLogger('storage:pipeline');

interface PipelineJob {
  assetId: string;
  storagePath: string;
  mimeType: string;
  assetType: string;
}

const queue: PipelineJob[] = [];
let running = false;
const CONCURRENCY = 2;

export function enqueueJob(job: PipelineJob) {
  queue.push(job);
  if (!running) {
    running = true;
    processQueue();
  }
}

async function processQueue() {
  while (queue.length > 0) {
    const batch = queue.splice(0, CONCURRENCY);
    await Promise.all(batch.map(processJob));
  }
  running = false;
}

async function processJob(job: PipelineJob) {
  const db = getDb();
  try {
    db.prepare("UPDATE assets SET status = 'processing' WHERE id = ?").run(job.assetId);

    if (job.mimeType.startsWith('image/')) {
      await generateImageThumbnail(job);
    }

    db.prepare("UPDATE assets SET status = 'ready' WHERE id = ?").run(job.assetId);
  } catch (err) {
    log.error({ err, assetId: job.assetId }, 'Failed to process asset');
    db.prepare("UPDATE assets SET status = 'failed' WHERE id = ?").run(job.assetId);
  }
}

async function generateImageThumbnail(job: PipelineJob) {
  const storage = getStorageAdapter();
  let url = await storage.getFileUrl(job.storagePath);

  // 相对路径补全为绝对 URL（本地存储场景）
  if (url.startsWith('/')) {
    const baseUrl = process.env.STORAGE_PUBLIC_URL || 'http://localhost:3000';
    url = baseUrl + url;
  }

  const response = await fetch(url);
  if (!response.ok) return;
  const buffer = Buffer.from(await response.arrayBuffer());

  const thumbnail = await sharp(buffer)
    .resize(256, 256, { fit: 'inside' })
    .jpeg({ quality: 80 })
    .toBuffer();

  const thumbKey = job.storagePath.replace(/(\.[^.]+)$/, '_thumb.jpg');
  const thumbPath = await storage.upload(thumbKey, thumbnail, 'image/jpeg');

  const db = getDb();
  db.prepare('UPDATE assets SET thumbnail_url = ? WHERE id = ?').run(thumbPath, job.assetId);
}
export function getQueueLength(): number {
  return queue.length;
}
