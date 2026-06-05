import { z } from 'zod';

function stripHtml(s: string): string {
  return s.replace(/<[^>]*>/g, '').trim();
}

export const loginSchema = z.object({
  email: z.string().email('请输入有效的邮箱地址'),
  password: z.string().min(6, '密码至少6个字符').max(128),
});

export const registerSchema = z.object({
  email: z.string().email('请输入有效的邮箱地址'),
  username: z.string().min(2, '用户名至少2个字符').max(32).regex(/^[a-zA-Z0-9_一-龥]+$/, '用户名只能包含字母、数字、下划线和中文'),
  password: z.string().min(8, '密码至少8个字符').max(128),
});

export const avatarCreateSchema = z.object({
  name: z.string().min(1, '名称不能为空').max(64).transform(stripHtml),
  style: z.enum(['anime', 'realistic', 'lowpoly', 'korean', 'western', 'chibi']).default('anime'),
  base_model: z.enum(['male', 'female']).default('female'),
});

export const avatarUpdateSchema = z.object({
  name: z.string().min(1).max(64).transform(stripHtml).optional(),
  style: z.enum(['anime', 'realistic', 'lowpoly', 'korean', 'western', 'chibi']).optional(),
  status: z.enum(['draft', 'published', 'archived']).optional(),
});

const defaultBodyParams = { height: 0, shoulder: 0, waist: 0, arm_length: 0, leg_length: 0 };
const emptyEquippedParts: { slot: string; part_id: string }[] = [];
const emptyMaterialOverrides: Record<string, { albedo: string; roughness: number; metallic: number }> = {};

export const versionCreateSchema = z.object({
  blendshape_snapshot: z.record(z.string(), z.number()).default({}),
  body_params: z.object({
    height: z.number().min(-1).max(1).default(0),
    shoulder: z.number().min(-1).max(1).default(0),
    waist: z.number().min(-1).max(1).default(0),
    arm_length: z.number().min(-1).max(1).default(0),
    leg_length: z.number().min(-1).max(1).default(0),
  }).default(defaultBodyParams),
  equipped_parts: z.array(z.object({
    slot: z.string(),
    part_id: z.string(),
  })).default(emptyEquippedParts),
  material_overrides: z.record(z.string(), z.object({
    albedo: z.string(),
    roughness: z.number().min(0).max(1),
    metallic: z.number().min(0).max(1),
  })).default(emptyMaterialOverrides),
});

export const assetCreateSchema = z.object({
  filename: z.string().min(1),
  file_size: z.number().min(0),
  mime_type: z.string(),
  asset_type: z.enum(['model', 'texture', 'animation', 'vfx', 'hdri']),
  format: z.enum(['gltf', 'glb', 'fbx', 'png', 'jpg', 'hdr', 'exr', 'mp4']),
  license: z.enum(['cc0', 'cc_by', 'commercial', 'custom']).default('cc_by'),
  tags: z.array(z.string()).default([]),
});
export const profileUpdateSchema = z.object({
  username: z.string().min(2).max(32).regex(/^[a-zA-Z0-9_一-龥]+$/, '用户名只能包含字母、数字、下划线和中文').optional(),
  bio: z.string().max(500).optional(),
});
