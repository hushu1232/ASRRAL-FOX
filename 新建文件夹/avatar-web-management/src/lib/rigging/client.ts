// AI Rigging HTTP 客户端 — 封装对 astralfox-rigging 微服务的 HTTP 调用
import { createLogger } from '@/lib/logger';
import { AppError } from '@/lib/errors';
import { riggingBreaker, RIGGING_TIMEOUT_MS, RIGGING_BASE_URL } from './circuit';
import type {
  SeparateResponse, RigResponse, ExportResponse,
  DeployResponse, PipelineResponse, PipelineOptions,
} from './types';

const log = createLogger('rigging-client');

async function riggingFetch<T>(
  path: string,
  options: RequestInit = {},
  timeoutMs = RIGGING_TIMEOUT_MS,
): Promise<T> {
  const url = `${RIGGING_BASE_URL}${path}`;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const res = await fetch(url, {
      ...options,
      signal: controller.signal,
      headers: {
        ...(options.headers as Record<string, string>),
      },
    });

    if (!res.ok) {
      let detail = `Rigging service returned ${res.status}`;
      try {
        const body = await res.json();
        if (body.detail) detail = body.detail;
      } catch { /* use default */ }
      throw new AppError(502, detail, 'RIGGING_ERROR');
    }

    return (await res.json()) as T;
  } catch (err) {
    if (err instanceof AppError) throw err;
    if ((err as Error).name === 'AbortError') {
      throw new AppError(504, 'Rigging pipeline timed out', 'RIGGING_TIMEOUT');
    }
    throw new AppError(502, `Rigging service unreachable: ${(err as Error).message}`, 'RIGGING_UNREACHABLE');
  } finally {
    clearTimeout(timer);
  }
}

export async function checkHealth(): Promise<boolean> {
  try {
    const res = await fetch(`${RIGGING_BASE_URL}/api/health`, { signal: AbortSignal.timeout(5000) });
    return res.ok;
  } catch {
    return false;
  }
}

export async function uploadImage(file: File | Blob, filename: string): Promise<{ image_id: string; filename: string; size: number; url: string }> {
  const form = new FormData();
  form.append('file', file, filename);
  return riggingBreaker.execute(() =>
    riggingFetch('/api/upload', { method: 'POST', body: form }, RIGGING_TIMEOUT_MS),
  );
}

export async function uploadImageFromBuffer(buffer: Buffer, filename: string): Promise<{ image_id: string; filename: string; size: number; url: string }> {
  const form = new FormData();
  form.append('file', new Blob([new Uint8Array(buffer)]), filename);
  return riggingBreaker.execute(() =>
    riggingFetch('/api/upload', { method: 'POST', body: form }, RIGGING_TIMEOUT_MS),
  );
}

export async function separateLayers(
  imageId: string,
  targetLayers?: string[],
  edgeRefine = true,
): Promise<SeparateResponse> {
  return riggingBreaker.execute(() =>
    riggingFetch('/api/separate', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        image_id: imageId,
        target_layers: targetLayers || [
          'hair_back', 'body', 'hair_front', 'face',
          'eye_L', 'eye_R', 'eyebrow_L', 'eyebrow_R',
          'mouth', 'accessory',
        ],
        edge_refine: edgeRefine,
      }),
    }),
  );
}

export async function rigModel(
  imageId: string,
  layers: { label: string; texture_url: string; mask_url: string; bbox: number[] }[],
  template: string,
  meshDensity = 'medium',
): Promise<RigResponse> {
  return riggingBreaker.execute(() =>
    riggingFetch('/api/rig', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        image_id: imageId,
        layers,
        template,
        mesh_density: meshDensity,
      }),
    }),
  );
}

export async function exportModel(
  imageId: string,
  skeleton: unknown,
  layers: { label: string; texture_url: string; mask_url: string; bbox: number[] }[],
  meshes: unknown[],
  weights: unknown[],
): Promise<ExportResponse> {
  return riggingBreaker.execute(() =>
    riggingFetch('/api/export', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        image_id: imageId,
        skeleton,
        layers,
        meshes,
        weights,
        canvas_width: 3000,
        canvas_height: 4000,
        texture_size: 2048,
        generate_moc3: true,
      }),
    }),
  );
}

export async function deployModel(
  modelId: string,
  animParams?: Record<string, Record<string, unknown>>,
  targetName?: string,
): Promise<DeployResponse> {
  return riggingBreaker.execute(() =>
    riggingFetch('/api/deploy', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model_id: modelId,
        anim_params: animParams || {},
        target_name: targetName || null,
      }),
    }),
  );
}

export async function runPipeline(
  imageId: string,
  options: PipelineOptions,
): Promise<PipelineResponse> {
  log.info({ imageId, template: options.template }, 'Starting rigging pipeline');
  return riggingBreaker.execute(() =>
    riggingFetch<PipelineResponse>('/api/pipeline', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        image_id: imageId,
        template: options.template,
        mesh_density: options.meshDensity,
        auto_deploy: options.autoDeploy || false,
        target_name: options.targetName || null,
      }),
    }),
  );
}

export async function downloadModelZip(imageId: string): Promise<ArrayBuffer> {
  const url = `${RIGGING_BASE_URL}/api/export/download/${imageId}`;
  const res = await fetch(url);
  if (!res.ok) throw new AppError(502, 'Failed to download model ZIP', 'RIGGING_ERROR');
  return res.arrayBuffer();
}
