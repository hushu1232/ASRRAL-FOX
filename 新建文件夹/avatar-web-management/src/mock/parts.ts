import { Part, PartCategory } from '@/types/part';

export const MOCK_PARTS: Part[] = [
  // Hair
  { id: 'hair-1', asset_id: null, name: '长发飘逸', category: 'hair', slot: 'Head', gender: 'female', style_tags: ['anime', 'korean'], thumbnail_url: null, prefab_url: '/models/parts/hair-long.glb', default_material: {}, created_at: '' },
  { id: 'hair-2', asset_id: null, name: '短发干练', category: 'hair', slot: 'Head', gender: 'unisex', style_tags: ['realistic', 'western'], thumbnail_url: null, prefab_url: '/models/parts/hair-short.glb', default_material: {}, created_at: '' },
  { id: 'hair-3', asset_id: null, name: '双马尾', category: 'hair', slot: 'Head', gender: 'female', style_tags: ['anime', 'chibi'], thumbnail_url: null, prefab_url: '/models/parts/hair-twintail.glb', default_material: {}, created_at: '' },
  { id: 'hair-4', asset_id: null, name: '束发髻', category: 'hair', slot: 'Head', gender: 'female', style_tags: ['anime', 'korean'], thumbnail_url: null, prefab_url: '/models/parts/hair-bun.glb', default_material: {}, created_at: '' },
  // Tops
  { id: 'top-1', asset_id: null, name: 'T恤', category: 'top', slot: 'Spine2', gender: 'unisex', style_tags: ['anime', 'realistic'], thumbnail_url: null, prefab_url: '/models/parts/top-tshirt.glb', default_material: {}, created_at: '' },
  { id: 'top-2', asset_id: null, name: '西装外套', category: 'top', slot: 'Spine2', gender: 'unisex', style_tags: ['realistic', 'western'], thumbnail_url: null, prefab_url: '/models/parts/top-jacket.glb', default_material: {}, created_at: '' },
  { id: 'top-3', asset_id: null, name: '水手服', category: 'top', slot: 'Spine2', gender: 'female', style_tags: ['anime'], thumbnail_url: null, prefab_url: '/models/parts/top-sailor.glb', default_material: {}, created_at: '' },
  // Bottoms
  { id: 'bottom-1', asset_id: null, name: '短裙', category: 'bottom', slot: 'Hips', gender: 'female', style_tags: ['anime', 'korean'], thumbnail_url: null, prefab_url: '/models/parts/bottom-skirt.glb', default_material: {}, created_at: '' },
  { id: 'bottom-2', asset_id: null, name: '长裤', category: 'bottom', slot: 'Hips', gender: 'unisex', style_tags: ['realistic', 'western'], thumbnail_url: null, prefab_url: '/models/parts/bottom-pants.glb', default_material: {}, created_at: '' },
  // Shoes
  { id: 'shoe-1', asset_id: null, name: '运动鞋', category: 'shoes', slot: 'RightFoot', gender: 'unisex', style_tags: ['realistic', 'western'], thumbnail_url: null, prefab_url: '/models/parts/shoes-sneaker.glb', default_material: {}, created_at: '' },
  { id: 'shoe-2', asset_id: null, name: '高跟鞋', category: 'shoes', slot: 'RightFoot', gender: 'female', style_tags: ['anime', 'korean', 'western'], thumbnail_url: null, prefab_url: '/models/parts/shoes-heels.glb', default_material: {}, created_at: '' },
  // Accessories
  { id: 'acc-1', asset_id: null, name: '眼镜', category: 'accessory', slot: 'Head', gender: 'unisex', style_tags: ['anime', 'realistic', 'korean'], thumbnail_url: null, prefab_url: '/models/parts/acc-glasses.glb', default_material: {}, created_at: '' },
  { id: 'acc-2', asset_id: null, name: '星星发饰', category: 'accessory', slot: 'Head', gender: 'female', style_tags: ['anime', 'chibi'], thumbnail_url: null, prefab_url: '/models/parts/acc-star-ribbon.glb', default_material: {}, created_at: '' },
  { id: 'acc-3', asset_id: null, name: '帽子', category: 'accessory', slot: 'Head', gender: 'unisex', style_tags: ['realistic', 'western'], thumbnail_url: null, prefab_url: '/models/parts/acc-hat.glb', default_material: {}, created_at: '' },
];

export const PARTS_BY_CATEGORY: Record<PartCategory, Part[]> = {
  hair: [],
  top: [],
  bottom: [],
  shoes: [],
  accessory: [],
  makeup: [],
  body: [],
};

MOCK_PARTS.forEach(part => {
  PARTS_BY_CATEGORY[part.category].push(part);
});
