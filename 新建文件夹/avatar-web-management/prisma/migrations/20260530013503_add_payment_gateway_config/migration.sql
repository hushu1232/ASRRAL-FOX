-- CreateTable
CREATE TABLE "payment_gateway_configs" (
    "id" TEXT NOT NULL,
    "provider" TEXT NOT NULL,
    "mode" TEXT NOT NULL DEFAULT 'sandbox',
    "is_active" BOOLEAN NOT NULL DEFAULT false,
    "display_name" TEXT,
    "app_id" TEXT,
    "mch_id" TEXT,
    "api_key" TEXT,
    "api_secret" TEXT,
    "cert_path" TEXT,
    "public_key" TEXT,
    "notify_url" TEXT,
    "return_url" TEXT,
    "config" JSONB,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "payment_gateway_configs_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "payment_gateway_configs_provider_mode_key" ON "payment_gateway_configs"("provider", "mode");
