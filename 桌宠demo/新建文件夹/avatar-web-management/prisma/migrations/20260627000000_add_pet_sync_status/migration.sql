-- CreateTable
CREATE TABLE "pet_sync_statuses" (
    "id" TEXT NOT NULL,
    "pet_config_id" TEXT NOT NULL,
    "desktop_known_version" BIGINT,
    "desktop_applied_version" BIGINT,
    "package_state" TEXT NOT NULL DEFAULT 'notPublished',
    "requires_local_confirmation" BOOLEAN NOT NULL DEFAULT true,
    "last_sync_at" TIMESTAMP(3),
    "last_applied_at" TIMESTAMP(3),
    "last_error_code" TEXT,
    "last_error_message" TEXT,
    "last_error_detail" TEXT,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "pet_sync_statuses_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "pet_sync_statuses_pet_config_id_key" ON "pet_sync_statuses"("pet_config_id");

-- CreateIndex
CREATE INDEX "pet_sync_statuses_package_state_idx" ON "pet_sync_statuses"("package_state");

-- AddForeignKey
ALTER TABLE "pet_sync_statuses" ADD CONSTRAINT "pet_sync_statuses_pet_config_id_fkey" FOREIGN KEY ("pet_config_id") REFERENCES "pet_configs"("id") ON DELETE CASCADE ON UPDATE CASCADE;
