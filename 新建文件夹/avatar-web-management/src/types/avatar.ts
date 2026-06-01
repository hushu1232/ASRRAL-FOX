export type AvatarStyle = 'anime' | 'realistic' | 'lowpoly' | 'korean' | 'western' | 'chibi';
export type AvatarStatus = 'draft' | 'published' | 'archived';
export type VersionStatus = 'draft' | 'pending_review' | 'approved' | 'rejected' | 'published';

export interface Avatar {
  id: string;
  workspace_id: string;
  creator_id: string;
  name: string;
  style: AvatarStyle;
  base_model: string;
  thumbnail_url: string | null;
  status: AvatarStatus;
  current_version_id: string | null;
  is_template: boolean;
  created_at: string;
  updated_at: string;
}

export interface AvatarVersion {
  id: string;
  avatar_id: string;
  version_number: number;
  blendshape_snapshot: Record<string, number>;
  body_params: BodyParams;
  equipped_parts: EquippedPartData[];
  material_overrides: Record<string, MaterialOverride>;
  preview_screenshot_url: string | null;
  status: VersionStatus;
  review_comment: string | null;
  parent_version_id: string | null;
  created_at: string;
}

export interface EquippedPartData {
  slot: string;
  part_id: string;
  material_overrides?: MaterialOverride;
}

export interface MaterialOverride {
  albedo: string;
  roughness: number;
  metallic: number;
}

export interface BodyParams {
  height: number;
  shoulder: number;
  waist: number;
  arm_length: number;
  leg_length: number;
}

export const DEFAULT_BODY_PARAMS: BodyParams = {
  height: 0,
  shoulder: 0,
  waist: 0,
  arm_length: 0,
  leg_length: 0,
};
