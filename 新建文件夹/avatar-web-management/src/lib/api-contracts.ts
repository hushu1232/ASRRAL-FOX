// API Contract Type Definitions
// Every change to these types represents a breaking API contract change.
// Tests in tests/contracts/ verify actual responses match these shapes.

// ---- Generic response envelope ----
export interface ApiSuccess<T> {
  success: true;
  data: T;
}

export interface ApiError {
  success: false;
  error: string;
  code?: string;
}

export type ApiResponse<T> = ApiSuccess<T> | ApiError;

export interface PaginatedData<T> {
  items: T[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
}

// ---- Auth contracts ----
export interface LoginRequest {
  email: string;
  password: string;
}

export interface LoginResponse {
  accessToken: string;
  refreshToken: string;
  user: UserContract;
}

export interface UserContract {
  id: string;
  email: string;
  username: string;
  role: string;
  status: string;
  avatar_url?: string | null;
}

export interface RegisterRequest {
  email: string;
  username: string;
  password: string;
}

export interface RefreshRequest {
  refreshToken: string;
}

export interface RefreshResponse {
  accessToken: string;
  refreshToken: string;
}

// ---- Avatar contracts ----
export interface AvatarContract {
  id: string;
  workspace_id: string;
  creator_id: string;
  name: string;
  style: string;
  base_model: string;
  thumbnail_url: string | null;
  status: string;
  is_template: boolean;
  created_at: string;
  updated_at: string;
}

export interface AvatarCreateRequest {
  name: string;
  style?: string;
  base_model?: string;
}

export interface AvatarUpdateRequest {
  name?: string;
  style?: string;
  status?: string;
}

export interface AvatarBatchRequest {
  action: 'delete' | 'publish' | 'unpublish' | 'archive';
  ids: string[];
}

export interface VersionContract {
  id: string;
  avatar_id: string;
  version_number: number;
  blendshape_snapshot: Record<string, number>;
  body_params: Record<string, number>;
  equipped_parts: { slot: string; part_id: string }[];
  material_overrides: Record<string, { albedo: string; roughness: number; metallic: number }>;
  preview_screenshot_url: string | null;
  status: string;
  created_at: string;
}

export interface VersionCreateRequest {
  blendshape_snapshot?: Record<string, number>;
  body_params?: Record<string, number>;
  equipped_parts?: { slot: string; part_id: string }[];
  material_overrides?: Record<string, { albedo: string; roughness: number; metallic: number }>;
}

// ---- Asset contracts ----
export interface AssetContract {
  id: string;
  workspace_id: string;
  uploader_id: string;
  filename: string;
  file_size: number;
  mime_type: string;
  storage_path: string;
  asset_type: string;
  format: string;
  license: string;
  tags: string[];
  thumbnail_url: string | null;
  status: string;
  version: number;
  created_at: string;
}

export interface AssetCreateRequest {
  filename: string;
  file_size: number;
  mime_type: string;
  asset_type: string;
  format: string;
  license?: string;
  tags?: string[];
  storage_path?: string;
  thumbnail_url?: string;
}

export interface AssetBatchRequest {
  action: 'delete' | 'archive';
  ids: string[];
}

// ---- Notification contracts ----
export interface NotificationContract {
  id: string;
  user_id: string;
  type: string;
  title: string;
  body: string | null;
  resource_type: string | null;
  resource_id: string | null;
  is_read: boolean;
  created_at: string;
}

// ---- Search contracts ----
export interface SearchResultContract {
  avatars: unknown[];
  assets: unknown[];
  templates: unknown[];
  searchEngine: string;
}

// ---- Health contract ----
export interface HealthContract {
  status: 'healthy' | 'degraded' | 'unhealthy';
  uptime: number;
  memory: { heapUsedMB: number; heapTotalMB: number; rssMB: number };
  services: {
    database: { status: string; type: string; latencyMs?: number };
    prisma: { status: string; latencyMs?: number };
    redis: { status: string; available: boolean };
    storage: { status: string };
  };
  counts: { users: number; avatars: number; assets: number };
  timestamp: string;
}

// ---- Endpoint contract mapping ----
export const API_CONTRACTS = {
  'GET /api/health': {
    response: 'HealthContract',
    status: [200, 503],
  },
  'POST /api/auth/login': {
    request: 'LoginRequest',
    response: 'LoginResponse',
    status: [200],
  },
  'POST /api/auth/register': {
    request: 'RegisterRequest',
    response: 'LoginResponse',
    status: [201],
  },
  'POST /api/auth/refresh': {
    request: 'RefreshRequest',
    response: 'RefreshResponse',
    status: [200],
  },
  'GET /api/avatars': {
    response: 'PaginatedData<AvatarContract>',
    status: [200],
  },
  'POST /api/avatars': {
    request: 'AvatarCreateRequest',
    response: 'AvatarContract',
    status: [201],
  },
  'GET /api/avatars/:id': {
    response: 'AvatarContract & { versions: VersionContract[] }',
    status: [200],
  },
  'PUT /api/avatars/:id': {
    request: 'AvatarUpdateRequest',
    response: 'AvatarContract',
    status: [200],
  },
  'DELETE /api/avatars/:id': {
    response: '{ deleted: true }',
    status: [200],
  },
  'POST /api/avatars/batch': {
    request: 'AvatarBatchRequest',
    response: '{ affected: number }',
    status: [200],
  },
  'GET /api/avatars/:id/versions': {
    response: 'VersionContract[]',
    status: [200],
  },
  'POST /api/avatars/:id/versions': {
    request: 'VersionCreateRequest',
    response: 'VersionContract',
    status: [201],
  },
  'GET /api/assets': {
    response: 'PaginatedData<AssetContract>',
    status: [200],
  },
  'POST /api/assets': {
    request: 'AssetCreateRequest',
    response: 'AssetContract',
    status: [201],
  },
  'POST /api/assets/batch': {
    request: 'AssetBatchRequest',
    response: '{ affected: number }',
    status: [200],
  },
  'GET /api/notifications': {
    response: 'PaginatedData<NotificationContract>',
    status: [200],
  },
  'PUT /api/notifications/read-all': {
    response: 'null',
    status: [200],
  },
  'GET /api/notifications/unread-count': {
    response: '{ count: number }',
    status: [200],
  },
  'GET /api/search': {
    response: 'SearchResultContract',
    status: [200],
  },
} as const;

export type ApiEndpoint = keyof typeof API_CONTRACTS;
