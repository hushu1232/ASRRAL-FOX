import { BlendShapeDefinition } from '@/types/editor';

export const BLEND_SHAPE_DEFINITIONS: BlendShapeDefinition[] = [
  // Face
  { name: 'brow_raise', displayName: '眉骨高度', category: '脸部', index: 0, min: -1, max: 1, step: 0.01, defaultValue: 0 },
  { name: 'brow_width', displayName: '眉间距', category: '脸部', index: 1, min: -1, max: 1, step: 0.01, defaultValue: 0 },
  { name: 'eye_size', displayName: '眼睛大小', category: '脸部', index: 2, min: -1, max: 1, step: 0.01, defaultValue: 0 },
  { name: 'eye_angle', displayName: '眼角角度', category: '脸部', index: 3, min: -1, max: 1, step: 0.01, defaultValue: 0 },
  { name: 'nose_height', displayName: '鼻梁高度', category: '脸部', index: 4, min: -1, max: 1, step: 0.01, defaultValue: 0 },
  { name: 'nose_width', displayName: '鼻翼宽度', category: '脸部', index: 5, min: -1, max: 1, step: 0.01, defaultValue: 0 },
  { name: 'mouth_width', displayName: '嘴巴宽度', category: '脸部', index: 6, min: -1, max: 1, step: 0.01, defaultValue: 0 },
  { name: 'mouth_height', displayName: '嘴唇厚度', category: '脸部', index: 7, min: -1, max: 1, step: 0.01, defaultValue: 0 },
  { name: 'jaw_width', displayName: '下颌宽度', category: '脸部', index: 8, min: -1, max: 1, step: 0.01, defaultValue: 0 },
  { name: 'jaw_angle', displayName: '下颌角度', category: '脸部', index: 9, min: -1, max: 1, step: 0.01, defaultValue: 0 },
  { name: 'cheekbone', displayName: '颧骨突出', category: '脸部', index: 10, min: -1, max: 1, step: 0.01, defaultValue: 0 },
  { name: 'chin_length', displayName: '下巴长度', category: '脸部', index: 11, min: -1, max: 1, step: 0.01, defaultValue: 0 },
  // Hair / Ornaments (was "Ears" for fox model)
  { name: 'ear_size', displayName: '发饰大小', category: '发饰', index: 12, min: -1, max: 1, step: 0.01, defaultValue: 0 },
  { name: 'ear_angle', displayName: '发饰角度', category: '发饰', index: 13, min: -1, max: 1, step: 0.01, defaultValue: 0 },
];

export const BLEND_SHAPE_CATEGORIES = ['脸部', '发饰', '身体'];

export const BLEND_SHAPE_INDEX_MAP: Record<string, number> = {};
BLEND_SHAPE_DEFINITIONS.forEach(def => {
  BLEND_SHAPE_INDEX_MAP[def.name] = def.index;
});
