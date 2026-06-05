-- CreateTable
CREATE TABLE "pet_configs" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "user_id" TEXT NOT NULL,
    "workspace_id" TEXT NOT NULL,
    "pet_name" TEXT NOT NULL DEFAULT '星尘',
    "personality" TEXT NOT NULL DEFAULT '',
    "backstory" TEXT NOT NULL DEFAULT '',
    "azure_speech_key" TEXT,
    "azure_speech_region" TEXT,
    "openai_api_key" TEXT,
    "openai_base_url" TEXT,
    "animation_model" TEXT NOT NULL DEFAULT 'live2d',
    "avatar_id" TEXT,
    "ffmpeg_path" TEXT,
    "idle_timeout" INTEGER NOT NULL DEFAULT 300,
    "wander_interval" REAL NOT NULL DEFAULT 15.0,
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "pet_configs_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "pet_configs_workspace_id_fkey" FOREIGN KEY ("workspace_id") REFERENCES "workspaces" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "pet_configs_avatar_id_fkey" FOREIGN KEY ("avatar_id") REFERENCES "avatars" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "pet_asset_mappings" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "pet_config_id" TEXT NOT NULL,
    "asset_id" TEXT NOT NULL,
    "asset_type" TEXT NOT NULL DEFAULT 'model',
    "slot_name" TEXT NOT NULL DEFAULT 'default',
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "pet_asset_mappings_pet_config_id_fkey" FOREIGN KEY ("pet_config_id") REFERENCES "pet_configs" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "pet_asset_mappings_asset_id_fkey" FOREIGN KEY ("asset_id") REFERENCES "assets" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "pet_session_logs" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "user_id" TEXT NOT NULL,
    "pet_config_id" TEXT NOT NULL,
    "start_time" DATETIME NOT NULL,
    "end_time" DATETIME,
    "interaction_count" INTEGER NOT NULL DEFAULT 0,
    "crash_log" TEXT,
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "pet_session_logs_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "pet_session_logs_pet_config_id_fkey" FOREIGN KEY ("pet_config_id") REFERENCES "pet_configs" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateIndex
CREATE UNIQUE INDEX "pet_configs_user_id_key" ON "pet_configs"("user_id");

-- CreateIndex
CREATE INDEX "pet_configs_workspace_id_idx" ON "pet_configs"("workspace_id");

-- CreateIndex
CREATE UNIQUE INDEX "pet_asset_mappings_pet_config_id_slot_name_key" ON "pet_asset_mappings"("pet_config_id", "slot_name");

-- CreateIndex
CREATE INDEX "pet_asset_mappings_asset_id_idx" ON "pet_asset_mappings"("asset_id");

-- CreateIndex
CREATE INDEX "pet_session_logs_user_id_idx" ON "pet_session_logs"("user_id");

-- CreateIndex
CREATE INDEX "pet_session_logs_pet_config_id_idx" ON "pet_session_logs"("pet_config_id");
