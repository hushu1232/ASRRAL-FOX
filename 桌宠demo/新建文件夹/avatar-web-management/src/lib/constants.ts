export const JWT_ACCESS_EXPIRY = '15m';
export const JWT_REFRESH_EXPIRY_DAYS = 7;
export const BCRYPT_ROUNDS = 12;
export const MAX_UNDO_STEPS = 50;
export const MAX_UPLOAD_SIZE = 500 * 1024 * 1024; // 500MB
export const DEFAULT_PAGE_SIZE = 20;

export const ROLE_HIERARCHY: Record<string, number> = {
  super_admin: 100,
  workspace_admin: 80,
  user: 20,
};

export const AVATAR_STYLES = [
  { value: 'anime', label: '二次元' },
  { value: 'realistic', label: '写实' },
  { value: 'lowpoly', label: '低多边形' },
  { value: 'korean', label: '韩系' },
  { value: 'western', label: '欧美' },
  { value: 'chibi', label: 'Q版' },
] as const;

export const AVATAR_STATUS_MAP: Record<string, { color: string; label: string }> = {
  draft: { color: 'default', label: '草稿' },
  published: { color: 'green', label: '已发布' },
  archived: { color: 'red', label: '已归档' },
  pending_review: { color: 'orange', label: '审核中' },
  approved: { color: 'cyan', label: '已通过' },
  rejected: { color: 'red', label: '已驳回' },
};

// ── Level & Title System ──

export const MAX_LEVEL = 5;

export const LEVEL_EXP_TABLE: Record<number, { exp: number; total: number }> = {
  1: { exp: 0, total: 0 },
  2: { exp: 200, total: 200 },
  3: { exp: 800, total: 1000 },
  4: { exp: 2000, total: 3000 },
  5: { exp: 6000, total: 9000 },
};

export const LEVEL_PREFIX: Record<number, string> = {
  1: '新星',
  2: '探索者',
  3: '创造者',
  4: '大师',
  5: '传奇',
};

export const LEVEL_BENEFITS: Record<number, {
  voiceClonesPerMonth: number;
  assetCapacityMB: number;
  savedVoices: number;
  skinSlots: number;
  unlocks: string[];
}> = {
  1: { voiceClonesPerMonth: 5, assetCapacityMB: 500, savedVoices: 1, skinSlots: 1, unlocks: ['工作台', '桌宠设置', '形象管理', '资产库'] },
  2: { voiceClonesPerMonth: 15, assetCapacityMB: 2048, savedVoices: 2, skinSlots: 2, unlocks: ['市场浏览购买', '社区发帖/回复', '私信'] },
  3: { voiceClonesPerMonth: 30, assetCapacityMB: 5120, savedVoices: 3, skinSlots: 3, unlocks: ['可申请项目组管理员角色', '优先内测新功能'] },
  4: { voiceClonesPerMonth: 60, assetCapacityMB: 15360, savedVoices: 5, skinSlots: 4, unlocks: ['声音卡交易资格', '高级TTS音色'] },
  5: { voiceClonesPerMonth: 100, assetCapacityMB: 51200, savedVoices: 10, skinSlots: 5, unlocks: ['全功能开放', '专属客服', '限量定制标识'] },
};

export const EXP_ACTIONS: Record<string, { exp: number; dailyLimit: number; description: string }> = {
  daily_login:       { exp: 10, dailyLimit: 1, description: '每日登录' },
  voice_chat_3round: { exp: 5,  dailyLimit: 30, description: '完成≥3轮语音对话' },
  asset_upload:      { exp: 20, dailyLimit: 999, description: '上传资产并通过审核' },
  avatar_create:     { exp: 30, dailyLimit: 999, description: '创建并保存虚拟形象' },
  voice_clone_save:  { exp: 15, dailyLimit: 5, description: '使用声音克隆并保存' },
  share_screenshot:  { exp: 10, dailyLimit: 30, description: '分享形象/桌宠截图' },
  post_featured:     { exp: 50, dailyLimit: 999, description: '社区发帖被加精' },
  event_participate: { exp: 50, dailyLimit: 999, description: '参与官方活动/调研' },
  report_valid:      { exp: 20, dailyLimit: 999, description: '有效举报违规内容' },
  pet_online_hour:   { exp: 1,  dailyLimit: 8, description: '桌宠在线时长(小时)' },
  market_purchase:   { exp: 10, dailyLimit: 999, description: '购买市场商品' },
};

// ── Title Definitions ──

export interface TitleDef {
  id: string;
  name: string;
  category: 'login' | 'achievement' | 'admin';
  condition: string;
  color: string;
  adminOnly: boolean;
}

export const TITLE_DEFINITIONS: TitleDef[] = [
  // Login milestones
  { id: 'new_arrival', name: '初来乍到', category: 'login', condition: '累计登录1天', color: '#a0a0a0', adminOnly: false },
  { id: 'resident', name: '常驻居民', category: 'login', condition: '累计登录30天', color: '#5e9eff', adminOnly: false },
  { id: 'hundred_days', name: '百日陪伴', category: 'login', condition: '累计登录100天', color: '#8b5cf6', adminOnly: false },
  { id: 'yearly', name: '年年岁岁', category: 'login', condition: '累计登录365天', color: '#f59e0b', adminOnly: false },
  { id: 'three_years', name: '三年之约', category: 'login', condition: '累计登录1095天', color: '#ef4444', adminOnly: false },

  // Achievements
  { id: 'voice_alchemist', name: '声音炼金术士', category: 'achievement', condition: '克隆并保存10个音色', color: '#06b6d4', adminOnly: false },
  { id: 'stylist', name: '万能造型师', category: 'achievement', condition: '创建并发布20个公开形象', color: '#ec4899', adminOnly: false },
  { id: 'pet_whisperer', name: '桌宠语者', category: 'achievement', condition: '累计对话10000轮', color: '#10b981', adminOnly: false },
  { id: 'correction_pioneer', name: '纠错先锋', category: 'achievement', condition: '有效举报10次', color: '#f97316', adminOnly: false },
  { id: 'pioneer', name: '开拓者', category: 'achievement', condition: '内测/公测首批用户', color: '#d946ef', adminOnly: true },
  { id: 'ambassador', name: '星光使节', category: 'achievement', condition: '邀请5位好友注册并达Lv.2', color: '#eab308', adminOnly: false },
  { id: 'collector', name: '收集狂魔', category: 'achievement', condition: '解锁全部免费桌宠皮肤', color: '#14b8a6', adminOnly: false },
  { id: 'night_owl', name: '夜猫子', category: 'achievement', condition: '凌晨0-5点累计对话500轮', color: '#6366f1', adminOnly: false },
  { id: 'music_elf', name: '音乐精灵', category: 'achievement', condition: '屏幕感知伴随音乐摇摆100次', color: '#f472b6', adminOnly: false },

  // Admin titles
  { id: 'discipline_officer', name: '风纪委员', category: 'admin', condition: '审核员专属', color: '#22c55e', adminOnly: true },
  { id: 'tech_helper', name: '技术协管', category: 'admin', condition: '技术志愿者', color: '#3b82f6', adminOnly: true },
  { id: 'ops_assistant', name: '运营助理', category: 'admin', condition: '运营志愿者', color: '#f97316', adminOnly: true },
  { id: 'guardian', name: '星尘守护者', category: 'admin', condition: '管理员专属', color: '#ef4444', adminOnly: true },
  { id: 'developer', name: '开发者', category: 'admin', condition: '开发团队', color: '#a855f7', adminOnly: true },
];
