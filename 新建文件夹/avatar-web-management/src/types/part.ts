export type PartCategory = 'hair' | 'top' | 'bottom' | 'shoes' | 'accessory' | 'makeup' | 'body';
export type PartGender = 'male' | 'female' | 'unisex';
export type RuleType = 'mutex' | 'dependency';

export interface Part {
  id: string;
  asset_id: string | null;
  name: string;
  category: PartCategory;
  slot: string;
  gender: PartGender;
  style_tags: string[];
  thumbnail_url: string | null;
  prefab_url: string;
  default_material: Record<string, unknown>;
  created_at: string;
}

export interface PartRule {
  id: string;
  rule_type: RuleType;
  part_a_id: string;
  part_b_id: string;
  message: string | null;
}

export const PART_CATEGORY_LABELS: Record<PartCategory, string> = {
  hair: '发型',
  top: '上装',
  bottom: '下装',
  shoes: '鞋子',
  accessory: '配饰',
  makeup: '妆容',
  body: '身体',
};
