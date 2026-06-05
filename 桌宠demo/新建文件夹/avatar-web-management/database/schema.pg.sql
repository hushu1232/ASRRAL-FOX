-- 虚拟形象 Web 管理系统 — PostgreSQL 数据库 Schema
-- 包含：行级安全 (RLS)、全文搜索 (tsvector)、工作空间租户隔离

-- ============================================================
-- 扩展
-- ============================================================
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- ============================================================
-- 表定义
-- ============================================================

CREATE TABLE workspaces (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name VARCHAR(255) NOT NULL,
  plan VARCHAR(20) NOT NULL DEFAULT 'free' CHECK (plan IN ('free', 'pro', 'enterprise')),
  sso_config JSONB DEFAULT '{}',
  storage_quota_bytes BIGINT NOT NULL DEFAULT 1073741824,
  member_count INT NOT NULL DEFAULT 1,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE users (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  workspace_id UUID NOT NULL REFERENCES workspaces(id),
  email VARCHAR(255) NOT NULL UNIQUE,
  username VARCHAR(100) NOT NULL UNIQUE,
  password_hash VARCHAR(255) NOT NULL,
  role VARCHAR(20) NOT NULL DEFAULT 'user' CHECK (role IN ('super_admin', 'admin', 'auditor', 'designer', 'user')),
  sso_provider VARCHAR(20) CHECK (sso_provider IN ('ldap', 'oidc')),
  sso_subject VARCHAR(255),
  totp_secret VARCHAR(255),
  status VARCHAR(20) NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'suspended', 'deleted')),
  last_login_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_users_email ON users(email);
CREATE INDEX idx_users_workspace ON users(workspace_id);

CREATE TABLE refresh_tokens (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  token_hash VARCHAR(255) NOT NULL UNIQUE,
  expires_at TIMESTAMPTZ NOT NULL,
  revoked BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_refresh_tokens_user ON refresh_tokens(user_id);

CREATE TABLE avatars (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  workspace_id UUID NOT NULL REFERENCES workspaces(id),
  creator_id UUID NOT NULL REFERENCES users(id),
  name VARCHAR(255) NOT NULL,
  style VARCHAR(20) NOT NULL DEFAULT 'anime' CHECK (style IN ('anime', 'realistic', 'lowpoly', 'korean', 'western', 'chibi')),
  base_model VARCHAR(500) NOT NULL DEFAULT '/models/base-female.glb',
  thumbnail_url VARCHAR(500),
  status VARCHAR(20) NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'published', 'archived')),
  current_version_id UUID,
  is_template BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  -- 全文搜索向量
  search_vector tsvector GENERATED ALWAYS AS (
    setweight(to_tsvector('simple', coalesce(name, '')), 'A') ||
    setweight(to_tsvector('simple', coalesce(style, '')), 'B')
  ) STORED
);
CREATE INDEX idx_avatars_creator ON avatars(creator_id);
CREATE INDEX idx_avatars_workspace ON avatars(workspace_id);
CREATE INDEX idx_avatars_status ON avatars(status);
CREATE INDEX idx_avatars_search ON avatars USING GIN (search_vector);

CREATE TABLE avatar_versions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  avatar_id UUID NOT NULL REFERENCES avatars(id) ON DELETE CASCADE,
  version_number INT NOT NULL,
  blendshape_snapshot JSONB NOT NULL DEFAULT '{}',
  body_params JSONB NOT NULL DEFAULT '{}',
  equipped_parts JSONB NOT NULL DEFAULT '[]',
  material_overrides JSONB NOT NULL DEFAULT '{}',
  model_path VARCHAR(500) NOT NULL DEFAULT '/models/cattail/cattail.model3.json',
  preview_screenshot_url VARCHAR(500),
  status VARCHAR(20) NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'pending_review', 'approved', 'rejected', 'published')),
  review_comment TEXT,
  parent_version_id UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_avatar_versions_avatar ON avatar_versions(avatar_id);

CREATE TABLE parts (
  id VARCHAR(50) PRIMARY KEY,
  asset_id VARCHAR(50),
  name VARCHAR(255) NOT NULL,
  category VARCHAR(20) NOT NULL CHECK (category IN ('hair', 'top', 'bottom', 'shoes', 'accessory', 'makeup', 'body')),
  slot VARCHAR(50) NOT NULL,
  gender VARCHAR(10) NOT NULL DEFAULT 'unisex' CHECK (gender IN ('male', 'female', 'unisex')),
  style_tags JSONB NOT NULL DEFAULT '[]',
  thumbnail_url VARCHAR(500),
  prefab_url VARCHAR(500) NOT NULL,
  default_material JSONB NOT NULL DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_parts_category ON parts(category);

CREATE TABLE part_rules (
  id VARCHAR(50) PRIMARY KEY,
  rule_type VARCHAR(20) NOT NULL CHECK (rule_type IN ('mutex', 'dependency')),
  part_a_id VARCHAR(50) NOT NULL REFERENCES parts(id) ON DELETE CASCADE,
  part_b_id VARCHAR(50) NOT NULL REFERENCES parts(id) ON DELETE CASCADE,
  message TEXT
);

CREATE TABLE assets (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  workspace_id UUID NOT NULL REFERENCES workspaces(id),
  uploader_id UUID NOT NULL REFERENCES users(id),
  filename VARCHAR(500) NOT NULL,
  file_size BIGINT NOT NULL DEFAULT 0,
  mime_type VARCHAR(100) NOT NULL,
  storage_path VARCHAR(1000) NOT NULL,
  thumbnail_url VARCHAR(500),
  asset_type VARCHAR(20) NOT NULL CHECK (asset_type IN ('model', 'texture', 'animation', 'vfx', 'hdri')),
  format VARCHAR(20) NOT NULL,
  license VARCHAR(20) NOT NULL DEFAULT 'cc_by' CHECK (license IN ('cc0', 'cc_by', 'commercial', 'custom')),
  metadata JSONB NOT NULL DEFAULT '{}',
  tags JSONB NOT NULL DEFAULT '[]',
  version INT NOT NULL DEFAULT 1,
  status VARCHAR(20) NOT NULL DEFAULT 'ready' CHECK (status IN ('processing', 'ready', 'failed', 'archived')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  -- 全文搜索
  search_vector tsvector GENERATED ALWAYS AS (
    setweight(to_tsvector('simple', coalesce(filename, '')), 'A') ||
    setweight(to_tsvector('simple', coalesce(asset_type, '')), 'B')
  ) STORED
);
CREATE INDEX idx_assets_workspace ON assets(workspace_id);
CREATE INDEX idx_assets_search ON assets USING GIN (search_vector);

CREATE TABLE audit_logs (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES users(id),
  action VARCHAR(100) NOT NULL,
  resource_type VARCHAR(50) NOT NULL,
  resource_id VARCHAR(50),
  ip_address VARCHAR(45),
  user_agent TEXT,
  details JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_audit_logs_user ON audit_logs(user_id);
CREATE INDEX idx_audit_logs_action ON audit_logs(action);
CREATE INDEX idx_audit_logs_created ON audit_logs(created_at);

CREATE TABLE api_keys (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  name VARCHAR(100) NOT NULL,
  key_hash VARCHAR(255) NOT NULL UNIQUE,
  key_prefix VARCHAR(8) NOT NULL,
  last_used_at TIMESTAMPTZ,
  expires_at TIMESTAMPTZ,
  revoked BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_api_keys_user ON api_keys(user_id);

CREATE TABLE notifications (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  type VARCHAR(20) NOT NULL CHECK (type IN ('system', 'review', 'comment', 'share', 'storage')),
  title VARCHAR(255) NOT NULL,
  body TEXT,
  resource_type VARCHAR(20) CHECK (resource_type IN ('avatar', 'asset', 'template', 'system')),
  resource_id VARCHAR(50),
  is_read BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_notifications_user ON notifications(user_id);
CREATE INDEX idx_notifications_read ON notifications(user_id, is_read);

CREATE TABLE password_reset_tokens (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  token VARCHAR(255) NOT NULL UNIQUE,
  expires_at TIMESTAMPTZ NOT NULL,
  used BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_pwd_reset_token ON password_reset_tokens(token);

-- ============================================================
-- 行级安全策略 (RLS) — Workspace 租户隔离
-- ============================================================

-- 为需要隔离的表启用 RLS
ALTER TABLE avatars ENABLE ROW LEVEL SECURITY;
ALTER TABLE assets ENABLE ROW LEVEL SECURITY;
ALTER TABLE avatar_versions ENABLE ROW LEVEL SECURITY;
ALTER TABLE notifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE audit_logs ENABLE ROW LEVEL SECURITY;

-- 创建辅助函数：获取当前用户的 workspace_id
-- 由应用层通过 SET app.current_workspace_id = '...' 设置
CREATE OR REPLACE FUNCTION current_workspace_id()
RETURNS UUID AS $$
BEGIN
  RETURN NULLIF(current_setting('app.current_workspace_id', true), '')::UUID;
END;
$$ LANGUAGE plpgsql STABLE SECURITY DEFINER;

-- Avatars: 用户只能看到自己 workspace 的形象
CREATE POLICY avatars_workspace_isolation ON avatars
  FOR ALL
  USING (workspace_id = current_workspace_id())
  WITH CHECK (workspace_id = current_workspace_id());

-- 公开模板对所有 workspace 可见
CREATE POLICY avatars_public_templates ON avatars
  FOR SELECT
  USING (is_template = true);

-- Assets: workspace 级别隔离
CREATE POLICY assets_workspace_isolation ON assets
  FOR ALL
  USING (workspace_id = current_workspace_id())
  WITH CHECK (workspace_id = current_workspace_id());

-- Avatar Versions: 通过 avatar 间接隔离
CREATE POLICY versions_avatar_isolation ON avatar_versions
  FOR ALL
  USING (
    avatar_id IN (
      SELECT id FROM avatars WHERE workspace_id = current_workspace_id()
    )
  );

-- Notifications: 用户只能看自己的
CREATE POLICY notifications_user_isolation ON notifications
  FOR ALL
  USING (user_id = NULLIF(current_setting('app.current_user_id', true), '')::UUID);

-- ============================================================
-- 全文搜索函数
-- ============================================================

-- 跨实体全文搜索
CREATE OR REPLACE FUNCTION search_all(
  query_text TEXT,
  workspace_id UUID,
  limit_results INT DEFAULT 20
)
RETURNS TABLE(
  entity_type TEXT,
  entity_id UUID,
  name TEXT,
  rank REAL,
  highlight TEXT
) AS $$
BEGIN
  RETURN QUERY
  SELECT 'avatar'::TEXT, a.id, a.name,
         ts_rank(a.search_vector, websearch_to_tsquery('simple', query_text)) AS rank,
         ts_headline('simple', a.name, websearch_to_tsquery('simple', query_text)) AS highlight
  FROM avatars a
  WHERE a.search_vector @@ websearch_to_tsquery('simple', query_text)
    AND (a.workspace_id = search_all.workspace_id OR a.is_template = true)
  UNION ALL
  SELECT 'asset'::TEXT, ast.id, ast.filename,
         ts_rank(ast.search_vector, websearch_to_tsquery('simple', query_text)),
         ts_headline('simple', ast.filename, websearch_to_tsquery('simple', query_text))
  FROM assets ast
  WHERE ast.search_vector @@ websearch_to_tsquery('simple', query_text)
    AND ast.workspace_id = search_all.workspace_id
  ORDER BY rank DESC
  LIMIT limit_results;
END;
$$ LANGUAGE plpgsql STABLE;

-- ============================================================
-- OAuth2.0 客户端
-- ============================================================
CREATE TABLE IF NOT EXISTS oauth_clients (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    client_id TEXT NOT NULL UNIQUE,
    client_secret TEXT NOT NULL,
    redirect_uris JSONB NOT NULL DEFAULT '[]',
    scopes JSONB NOT NULL DEFAULT '["openid","profile","email"]',
    grant_types JSONB NOT NULL DEFAULT '["authorization_code","refresh_token"]',
    is_public BOOLEAN NOT NULL DEFAULT false,
    revoked BOOLEAN NOT NULL DEFAULT false,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

CREATE UNIQUE INDEX IF NOT EXISTS oauth_clients_client_id_idx ON oauth_clients(client_id);
