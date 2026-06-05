// 管线编排器 — 分阶段调用 rigging 服务，实时推送进度
import { separateLayers, rigModel, exportModel, deployModel, downloadModelZip } from './client';
import { pushPipelineProgress } from '@/lib/ws/server';
import { createLogger } from '@/lib/logger';
import type { PipelineStage, PipelineOptions, PipelineStatus, LayerResult } from './types';

const log = createLogger('rigging-pipeline');

// In-memory status store (fallback when Redis unavailable)
const statusStore = new Map<string, PipelineStatus>();

export function getPipelineStatus(imageId: string): PipelineStatus | undefined {
  return statusStore.get(imageId);
}

function updateStatus(imageId: string, update: Partial<PipelineStatus>) {
  const existing = statusStore.get(imageId);
  const status: PipelineStatus = existing
    ? { ...existing, ...update }
    : {
        imageId,
        stage: 'uploading',
        percent: 0,
        message: 'Starting...',
        startedAt: Date.now(),
        ...update,
      };
  statusStore.set(imageId, status);

  // Push via WebSocket
  pushPipelineProgress(imageId, {
    stage: status.stage,
    percent: status.percent,
    message: status.message,
    error: status.error,
    result: status.result as Record<string, unknown> | undefined,
  });

  // Auto-cleanup after 1 hour
  setTimeout(() => statusStore.delete(imageId), 3_600_000);
}

export async function orchestratePipeline(
  imageId: string,
  options: PipelineOptions,
): Promise<PipelineStatus> {
  const startedAt = Date.now();
  updateStatus(imageId, { stage: 'uploading', percent: 0, message: '准备中...', startedAt });

  try {
    // Stage 1: Layer Separation (0-25%)
    updateStatus(imageId, { stage: 'separating', percent: 5, message: 'AI 图层分离中...' });
    log.info({ imageId }, 'Starting layer separation');

    const sepResult = await separateLayers(imageId);
    updateStatus(imageId, { stage: 'separating', percent: 25, message: `图层分离完成 (${sepResult.layers.length} 层, ${Math.round(sepResult.processingTimeMs / 1000)}s)` });

    // Stage 2: Rigging (25-55%)
    updateStatus(imageId, { stage: 'rigging', percent: 25, message: '骨骼预测中...' });
    log.info({ imageId, template: options.template }, 'Starting rigging');

    const layersForRig: { label: string; texture_url: string; mask_url: string; bbox: number[] }[] =
      sepResult.layers.map((l: LayerResult) => ({
        label: l.label,
        texture_url: l.textureUrl,
        mask_url: l.maskUrl,
        bbox: l.bbox,
      }));

    const rigResult = await rigModel(imageId, layersForRig, options.template, options.meshDensity);
    updateStatus(imageId, { stage: 'rigging', percent: 55, message: `骨骼绑定完成 (${rigResult.meshCount} 网格, ${Math.round(rigResult.processingTimeMs / 1000)}s)` });

    // Stage 3: Export (55-85%)
    updateStatus(imageId, { stage: 'exporting', percent: 55, message: 'Cubism 格式导出中...' });
    log.info({ imageId }, 'Starting export');

    const exportResult = await exportModel(
      imageId,
      rigResult.skeleton,
      layersForRig,
      rigResult.meshes,
      rigResult.weights,
    );
    updateStatus(imageId, { stage: 'exporting', percent: 85, message: `模型导出完成 (${Math.round(exportResult.processingTimeMs / 1000)}s)` });

    // Stage 4: Pull model files (85-95%)
    updateStatus(imageId, { stage: 'pulling_assets', percent: 85, message: '下载模型文件中...' });

    let modelZip: ArrayBuffer;
    try {
      modelZip = await downloadModelZip(imageId);
      updateStatus(imageId, { stage: 'pulling_assets', percent: 95, message: '模型文件下载完成' });
    } catch (err) {
      log.warn({ err, imageId }, 'Failed to download model ZIP — continuing without local copy');
      modelZip = new ArrayBuffer(0);
      updateStatus(imageId, { stage: 'pulling_assets', percent: 95, message: '模型文件下载跳过' });
    }

    // Stage 5: Deploy (95-100%) — optional
    let deployedPath: string | undefined;
    if (options.autoDeploy) {
      updateStatus(imageId, { stage: 'deploying', percent: 95, message: '部署到桌面端...' });
      try {
        const deployResult = await deployModel(imageId, undefined, options.targetName);
        deployedPath = deployResult.deployedPath;
        updateStatus(imageId, { stage: 'deploying', percent: 100, message: `部署完成: ${deployResult.deployedPath}` });
      } catch (err) {
        log.error({ err, imageId }, 'Deploy failed');
        updateStatus(imageId, { stage: 'deploying', percent: 100, message: '部署失败，模型已生成可手动部署' });
      }
    }

    const totalTimeMs = Date.now() - startedAt;
    const result = {
      modelId: imageId,
      previewUrl: exportResult.texturesUrls[0] || '',
      moc3Url: exportResult.moc3Url || exportResult.cmo3Url,
      totalTimeMs,
    };

    updateStatus(imageId, {
      stage: options.autoDeploy ? 'deploying' : 'pulling_assets',
      percent: 100,
      message: `完成! (${Math.round(totalTimeMs / 1000)}s)`,
      result: { ...result, deployedPath },
    });

    log.info({ imageId, totalTimeMs }, 'Pipeline completed successfully');
    return statusStore.get(imageId)!;

  } catch (err) {
    const errorMsg = (err as Error).message;
    log.error({ err, imageId }, 'Pipeline failed');
    updateStatus(imageId, { error: errorMsg, message: `失败: ${errorMsg}` });
    throw err;
  }
}
