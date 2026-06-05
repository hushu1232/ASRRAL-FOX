-- Virtual Avatar Web Management System - Database Schema
-- SQLite (WAL mode for concurrent reads)

PRAGMA journal_mode=WAL;
PRAGMA foreign_keys=ON;

CREATE TABLE IF NOT EXISTS workspaces (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  plan TEXT NOT NULL DEFAULT 'free', -- free | pro | enterprise
  sso_config TEXT, -- JSON: {provider, clientId, issuer, ...}
  storage_quota_bytes INTEGER NOT NULL DEFAULT 1073741824,
  member_count INTEGER NOT NULL DEFAULT 1,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS users (
  id TEXT PRIMARY KEY,
  workspace_id TEXT NOT NULL REFERENCES workspaces(id) ON DELETE RESTRICT,
  email TEXT NOT NULL UNIQUE,
  username TEXT NOT NULL UNIQUE,
  password_hash TEXT NOT NULL,
  role TEXT NOT NULL DEFAULT 'user', -- super_admin | admin | auditor | designer | user
  sso_provider TEXT, -- null | ldap | oidc
  sso_subject TEXT,
  totp_secret TEXT,
  status TEXT NOT NULL DEFAULT 'active', -- active | suspended | deleted
  last_login_at TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);
CREATE INDEX IF NOT EXISTS idx_users_workspace ON users(workspace_id);

CREATE TABLE IF NOT EXISTS refresh_tokens (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  token_hash TEXT NOT NULL UNIQUE,
  expires_at TEXT NOT NULL,
  revoked INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_refresh_tokens_user ON refresh_tokens(user_id);

CREATE TABLE IF NOT EXISTS avatars (
  id TEXT PRIMARY KEY,
  workspace_id TEXT NOT NULL REFERENCES workspaces(id) ON DELETE RESTRICT,
  creator_id TEXT NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
  name TEXT NOT NULL,
  style TEXT NOT NULL DEFAULT 'anime', -- anime | realistic | lowpoly | korean | western | chibi
  base_model TEXT NOT NULL DEFAULT '/models/base-female.glb',
  thumbnail_url TEXT,
  status TEXT NOT NULL DEFAULT 'draft', -- draft | published | archived
  current_version_id TEXT,
  is_template INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_avatars_creator ON avatars(creator_id);
CREATE INDEX IF NOT EXISTS idx_avatars_workspace ON avatars(workspace_id);
CREATE INDEX IF NOT EXISTS idx_avatars_status ON avatars(status);

CREATE TABLE IF NOT EXISTS avatar_versions (
  id TEXT PRIMARY KEY,
  avatar_id TEXT NOT NULL REFERENCES avatars(id) ON DELETE CASCADE,
  version_number INTEGER NOT NULL,
  blendshape_snapshot TEXT NOT NULL DEFAULT '{}', -- JSON
  body_params TEXT NOT NULL DEFAULT '{}', -- JSON
  equipped_parts TEXT NOT NULL DEFAULT '[]', -- JSON array
  material_overrides TEXT NOT NULL DEFAULT '{}', -- JSON
  model_path TEXT NOT NULL DEFAULT '/models/cattail/cattail.model3.json',
  preview_screenshot_url TEXT,
  status TEXT NOT NULL DEFAULT 'draft', -- draft | pending_review | approved | rejected | published
  review_comment TEXT,
  parent_version_id TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_avatar_versions_avatar ON avatar_versions(avatar_id);

CREATE TABLE IF NOT EXISTS parts (
  id TEXT PRIMARY KEY,
  asset_id TEXT,
  name TEXT NOT NULL,
  category TEXT NOT NULL, -- hair | top | bottom | shoes | accessory | makeup | body
  slot TEXT NOT NULL, -- bone attach point name
  gender TEXT NOT NULL DEFAULT 'unisex', -- male | female | unisex
  style_tags TEXT NOT NULL DEFAULT '[]', -- JSON array
  thumbnail_url TEXT,
  prefab_url TEXT NOT NULL,
  default_material TEXT NOT NULL DEFAULT '{}', -- JSON
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_parts_category ON parts(category);

CREATE TABLE IF NOT EXISTS part_rules (
  id TEXT PRIMARY KEY,
  rule_type TEXT NOT NULL, -- mutex | dependency
  part_a_id TEXT NOT NULL REFERENCES parts(id) ON DELETE CASCADE,
  part_b_id TEXT NOT NULL REFERENCES parts(id) ON DELETE CASCADE,
  message TEXT
);

CREATE TABLE IF NOT EXISTS assets (
  id TEXT PRIMARY KEY,
  workspace_id TEXT NOT NULL REFERENCES workspaces(id) ON DELETE RESTRICT,
  uploader_id TEXT NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
  filename TEXT NOT NULL,
  file_size INTEGER NOT NULL DEFAULT 0,
  mime_type TEXT NOT NULL,
  storage_path TEXT NOT NULL,
  thumbnail_url TEXT,
  asset_type TEXT NOT NULL, -- model | texture | animation | vfx | hdri
  format TEXT NOT NULL,
  license TEXT NOT NULL DEFAULT 'cc_by', -- cc0 | cc_by | commercial | custom
  metadata TEXT NOT NULL DEFAULT '{}', -- JSON
  tags TEXT NOT NULL DEFAULT '[]', -- JSON array
  version INTEGER NOT NULL DEFAULT 1,
  status TEXT NOT NULL DEFAULT 'ready', -- processing | ready | failed | archived
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_assets_workspace ON assets(workspace_id);

CREATE TABLE IF NOT EXISTS audit_logs (
  id TEXT PRIMARY KEY,
  user_id TEXT REFERENCES users(id) ON DELETE SET NULL,
  action TEXT NOT NULL,
  resource_type TEXT NOT NULL,
  resource_id TEXT,
  ip_address TEXT,
  user_agent TEXT,
  details TEXT, -- JSON
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_audit_logs_user ON audit_logs(user_id);
CREATE INDEX IF NOT EXISTS idx_audit_logs_action ON audit_logs(action);
CREATE INDEX IF NOT EXISTS idx_audit_logs_created ON audit_logs(created_at);

CREATE TABLE IF NOT EXISTS api_keys (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  key_hash TEXT NOT NULL UNIQUE,
  key_prefix TEXT NOT NULL, -- first 8 chars for display
  last_used_at TEXT,
  expires_at TEXT,
  revoked INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_api_keys_user ON api_keys(user_id);

CREATE TABLE IF NOT EXISTS notifications (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  type TEXT NOT NULL, -- system | review | comment | share | storage
  title TEXT NOT NULL,
  body TEXT,
  resource_type TEXT, -- avatar | asset | template | system
  resource_id TEXT,
  is_read INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_notifications_user ON notifications(user_id);
CREATE INDEX IF NOT EXISTS idx_notifications_read ON notifications(user_id, is_read);

CREATE TABLE IF NOT EXISTS password_reset_tokens (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  token TEXT NOT NULL UNIQUE,
  expires_at TEXT NOT NULL,
  used INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_pwd_reset_token ON password_reset_tokens(token);
