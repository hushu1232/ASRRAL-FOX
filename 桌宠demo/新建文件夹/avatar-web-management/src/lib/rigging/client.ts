// AI Rigging HTTP 客户端 — 封装对 astralfox-rigging 微服务的 HTTP 调用
import { createLogger } from '@/lib/logger';
import { AppError } from '@/lib/errors';
import { riggingBreaker, RIGGING_TIMEOUT_MS, RIGGING_BASE_URL } from './circuit';
import type {
  LayerLabel, LayerResult, SeparateResponse, RigResponse, ExportResponse,
  DeployResponse, PipelineResponse, PipelineOptions, MeshData, WeightData,
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

type RawLayerResult = {
  label: string;
  texture_url?: string;
  textureUrl?: string;
  mask_url?: string;
  maskUrl?: string;
  bbox: [number, number, number, number];
};

type RawMeshData = {
  label: string;
  vertex_count?: number;
  vertexCount?: number;
  triangle_count?: number;
  triangleCount?: number;
  vertices: [number, number][];
  uvs: [number, number][];
  indices: number[];
};

type RawWeightData = {
  label: string;
  bone_names?: string[];
  boneNames?: string[];
  vertex_count?: number;
  vertexCount?: number;
  bone_count?: number;
  boneCount?: number;
  weights: WeightData['weights'];
};

function normalizeLayer(layer: RawLayerResult): LayerResult {
  return {
    label: layer.label as LayerLabel,
    textureUrl: layer.textureUrl ?? layer.texture_url ?? '',
    maskUrl: layer.maskUrl ?? layer.mask_url ?? '',
    bbox: layer.bbox,
  };
}

function normalizeMesh(mesh: RawMeshData): MeshData {
  return {
    label: mesh.label,
    vertexCount: mesh.vertexCount ?? mesh.vertex_count ?? 0,
    triangleCount: mesh.triangleCount ?? mesh.triangle_count ?? 0,
    vertices: mesh.vertices,
    uvs: mesh.uvs,
    indices: mesh.indices,
  };
}

function normalizeWeight(weight: RawWeightData): WeightData {
  return {
    label: weight.label,
    boneNames: weight.boneNames ?? weight.bone_names ?? [],
    vertexCount: weight.vertexCount ?? weight.vertex_count ?? 0,
    boneCount: weight.boneCount ?? weight.bone_count ?? 0,
    weights: weight.weights,
  };
}

type RiggingResponseRecord = Record<string, unknown>;

function normalizeSeparateResponse(raw: RiggingResponseRecord): SeparateResponse {
  return {
    imageId: String(raw.imageId ?? raw.image_id ?? ''),
    layers: ((raw.layers as RawLayerResult[] | undefined) ?? []).map(normalizeLayer),
    processingTimeMs: Number(raw.processingTimeMs ?? raw.processing_time_ms ?? 0),
  };
}

function normalizeRigResponse(raw: RiggingResponseRecord): RigResponse {
  return {
    imageId: String(raw.imageId ?? raw.image_id ?? ''),
    skeleton: raw.skeleton as RigResponse['skeleton'],
    meshCount: Number(raw.meshCount ?? raw.mesh_count ?? 0),
    meshes: ((raw.meshes as RawMeshData[] | undefined) ?? []).map(normalizeMesh),
    weights: ((raw.weights as RawWeightData[] | undefined) ?? []).map(normalizeWeight),
    processingTimeMs: Number(raw.processingTimeMs ?? raw.processing_time_ms ?? 0),
  };
}

function normalizeExportResponse(raw: RiggingResponseRecord): ExportResponse {
  return {
    cmo3Url: String(raw.cmo3Url ?? raw.cmo3_url ?? ''),
    moc3Url: raw.moc3Url || raw.moc3_url ? String(raw.moc3Url ?? raw.moc3_url) : null,
    model3JsonUrl: String(raw.model3JsonUrl ?? raw.model3_json_url ?? ''),
    texturesUrls: (raw.texturesUrls ?? raw.textures_urls ?? []) as string[],
    processingTimeMs: Number(raw.processingTimeMs ?? raw.processing_time_ms ?? 0),
  };
}

function normalizeDeployResponse(raw: RiggingResponseRecord): DeployResponse {
  return {
    modelId: String(raw.modelId ?? raw.model_id ?? ''),
    deployedPath: String(raw.deployedPath ?? raw.deployed_path ?? ''),
    reloadTriggered: Boolean(raw.reloadTriggered ?? raw.reload_triggered ?? false),
    configsWritten: (raw.configsWritten ?? raw.configs_written ?? []) as string[],
    processingTimeMs: Number(raw.processingTimeMs ?? raw.processing_time_ms ?? 0),
  };
}

function normalizePipelineResponse(raw: RiggingResponseRecord): PipelineResponse {
  return {
    separate: normalizeSeparateResponse((raw.separate as RiggingResponseRecord | undefined) ?? {}),
    rig: normalizeRigResponse((raw.rig as RiggingResponseRecord | undefined) ?? {}),
    export: normalizeExportResponse((raw.export as RiggingResponseRecord | undefined) ?? {}),
    deploy: raw.deploy ? normalizeDeployResponse(raw.deploy as RiggingResponseRecord) : null,
    totalTimeMs: Number(raw.totalTimeMs ?? raw.total_time_ms ?? 0),
  };
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
  const response = await riggingBreaker.execute(() =>
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
  return normalizeSeparateResponse(response as RiggingResponseRecord);
}

export async function rigModel(
  imageId: string,
  layers: { label: string; texture_url: string; mask_url: string; bbox: number[] }[],
  template: string,
  meshDensity = 'medium',
): Promise<RigResponse> {
  const response = await riggingBreaker.execute(() =>
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
  return normalizeRigResponse(response as RiggingResponseRecord);
}

export async function exportModel(
  imageId: string,
  skeleton: unknown,
  layers: { label: string; texture_url: string; mask_url: string; bbox: number[] }[],
  meshes: unknown[],
  weights: unknown[],
): Promise<ExportResponse> {
  const response = await riggingBreaker.execute(() =>
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
  return normalizeExportResponse(response as RiggingResponseRecord);
}

export async function deployModel(
  modelId: string,
  animParams?: Record<string, Record<string, unknown>>,
  targetName?: string,
): Promise<DeployResponse> {
  const response = await riggingBreaker.execute(() =>
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
  return normalizeDeployResponse(response as RiggingResponseRecord);
}

export async function runPipeline(
  imageId: string,
  options: PipelineOptions,
): Promise<PipelineResponse> {
  log.info({ imageId, template: options.template }, 'Starting rigging pipeline');
  const response = await riggingBreaker.execute(() =>
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
  return normalizePipelineResponse(response as unknown as RiggingResponseRecord);
}

export async function downloadModelZip(imageId: string): Promise<ArrayBuffer> {
  const url = `${RIGGING_BASE_URL}/api/export/download/${imageId}`;
  const res = await fetch(url);
  if (!res.ok) throw new AppError(502, 'Failed to download model ZIP', 'RIGGING_ERROR');
  return res.arrayBuffer();
}
