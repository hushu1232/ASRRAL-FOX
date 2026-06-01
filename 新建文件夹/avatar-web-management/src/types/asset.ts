export type AssetType = 'model' | 'texture' | 'animation' | 'vfx' | 'hdri';
export type AssetFormat = 'gltf' | 'glb' | 'fbx' | 'png' | 'jpg' | 'hdr' | 'exr' | 'mp4';
export type AssetLicense = 'cc0' | 'cc_by' | 'commercial' | 'custom';
export type AssetStatus = 'processing' | 'ready' | 'failed' | 'archived';

export interface Asset {
  id: string;
  workspace_id: string;
  uploader_id: string;
  filename: string;
  file_size: number;
  mime_type: string;
  storage_path: string;
  thumbnail_url: string | null;
  asset_type: AssetType;
  format: AssetFormat;
  license: AssetLicense;
  metadata: AssetMetadata;
  tags: string[];
  version: number;
  status: AssetStatus;
  created_at: string;
}

export interface AssetMetadata {
  polycount?: number;
  textureSize?: string;
  duration?: number;
  [key: string]: unknown;
}
