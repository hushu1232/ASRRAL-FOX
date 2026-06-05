// Rigging 模型文件拉取 — 从 rigging 服务下载模型文件 → 存入 Storage → 创建 Asset 记录
import { getStorageAdapter } from '@/lib/storage';
import { getPrisma } from '@/lib/db';
import { createLogger } from '@/lib/logger';
import { RIGGING_BASE_URL } from './circuit';
import type { ExportResponse } from './types';

const log = createLogger('model-fetcher');

interface PulledModel {
  assetId: string;
  moc3Url: string;
  model3JsonUrl: string;
  texturesUrls: string[];
}

async function fetchAndStore(url: string, storageKey: string, contentType: string): Promise<string> {
  const res = await fetch(`${RIGGING_BASE_URL}${url}`);
  if (!res.ok) throw new Error(`Failed to fetch ${url}: ${res.status}`);
  const buffer = Buffer.from(await res.arrayBuffer());
  const storage = getStorageAdapter();
  return storage.upload(storageKey, buffer, contentType);
}

export async function pullAndStoreModel(
  exportResult: ExportResponse,
  userId: string,
  workspaceId: string,
  originalImageId: string,
  template: string,
): Promise<PulledModel> {
  const modelId = originalImageId;
  const baseKey = `models/${userId}/${modelId}`;

  log.info({ modelId, userId }, 'Pulling model files from rigging');

  // Download and store each file
  const [moc3Url, model3JsonUrl] = await Promise.all([
    exportResult.moc3Url
      ? fetchAndStore(exportResult.moc3Url, `${baseKey}/model.moc3`, 'application/octet-stream')
      : Promise.resolve(null),
    fetchAndStore(exportResult.model3JsonUrl, `${baseKey}/model.model3.json`, 'application/json'),
  ]);

  // Download textures
  const texturesUrls = await Promise.all(
    exportResult.texturesUrls.map((url, i) => {
      const ext = url.split('.').pop() || 'png';
      return fetchAndStore(url, `${baseKey}/textures/${i}.${ext}`, 'image/png');
    }),
  );

  // Create Asset record
  const prisma = getPrisma();
  const metadata = {
    rigging: {
      template,
      imageId: originalImageId,
      generatedAt: new Date().toISOString(),
    },
    modelFiles: {
      moc3: moc3Url,
      model3Json: model3JsonUrl,
      textures: texturesUrls,
    },
  };

  const asset = await prisma.asset.create({
    data: {
      workspaceId,
      uploaderId: userId,
      filename: `rigged_model_${modelId}`,
      mimeType: 'application/x-live2d-model',
      storagePath: `${baseKey}/model.model3.json`,
      assetType: 'live2d_model',
      format: 'cubism4',
      license: 'cc_by',
      metadata: JSON.stringify(metadata),
      tags: JSON.stringify(['live2d', 'rigged', template]),
      status: 'ready',
      fileSize: 0, // will be updated by post-processing
    },
  });

  log.info({ assetId: asset.id, modelId }, 'Model asset created');

  return {
    assetId: asset.id,
    moc3Url: moc3Url || '',
    model3JsonUrl,
    texturesUrls,
  };
}
