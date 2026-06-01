// AI Rigging 类型定义 — 对应 astralfox-rigging api/schemas.py 所有模型
export type LayerLabel =
  | 'hair_back' | 'body' | 'hair_front' | 'face'
  | 'eye_L' | 'eye_R' | 'eyebrow_L' | 'eyebrow_R'
  | 'mouth' | 'accessory';

export type MeshDensity = 'low' | 'medium' | 'high';

export type PipelineStage =
  | 'uploading' | 'separating' | 'rigging'
  | 'exporting' | 'deploying' | 'pulling_assets';

export interface LayerResult {
  label: LayerLabel;
  textureUrl: string;
  maskUrl: string;
  bbox: [number, number, number, number]; // [x, y, w, h]
}

export interface BoneNode {
  name: string;
  position: [number, number];
  children: BoneNode[];
}

export interface MeshData {
  label: string;
  vertexCount: number;
  triangleCount: number;
  vertices: [number, number][];
  uvs: [number, number][];
  indices: number[];
}

export interface WeightData {
  label: string;
  boneNames: string[];
  vertexCount: number;
  boneCount: number;
  weights: { BoneIndex: number; Weight: number }[][];
}

export interface SeparateResponse {
  imageId: string;
  layers: LayerResult[];
  processingTimeMs: number;
}

export interface RigResponse {
  imageId: string;
  skeleton: BoneNode;
  meshCount: number;
  meshes: MeshData[];
  weights: WeightData[];
  processingTimeMs: number;
}

export interface ExportResponse {
  cmo3Url: string;
  moc3Url: string | null;
  model3JsonUrl: string;
  texturesUrls: string[];
  processingTimeMs: number;
}

export interface DeployResponse {
  modelId: string;
  deployedPath: string;
  reloadTriggered: boolean;
  configsWritten: string[];
  processingTimeMs: number;
}

export interface PipelineResponse {
  separate: SeparateResponse;
  rig: RigResponse;
  export: ExportResponse;
  deploy: DeployResponse | null;
  totalTimeMs: number;
}

export interface PipelineStatus {
  imageId: string;
  stage: PipelineStage;
  percent: number;
  message: string;
  startedAt: number;
  error?: string;
  result?: {
    modelId: string;
    previewUrl: string;
    moc3Url: string;
    totalTimeMs: number;
    deployedPath?: string;
  };
}

export interface PipelineOptions {
  template: string;
  meshDensity: MeshDensity;
  autoDeploy?: boolean;
  targetName?: string;
}

export const RIGGING_TEMPLATES = ['catgirl', 'human_female', 'human_male'] as const;
export type RiggingTemplate = typeof RIGGING_TEMPLATES[number];

export const MESH_DENSITY_OPTIONS: { value: MeshDensity; label: string }[] = [
  { value: 'low', label: '低面数' },
  { value: 'medium', label: '中等面数' },
  { value: 'high', label: '高面数' },
];
