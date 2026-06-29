ALTER TABLE "pet_configs"
  ADD COLUMN "character_extra" TEXT NOT NULL DEFAULT '',
  ADD COLUMN "tts_local_url" TEXT,
  ADD COLUMN "stt_local_url" TEXT,
  ADD COLUMN "llm_model_path" TEXT,
  ADD COLUMN "sovits_url" TEXT,
  ADD COLUMN "sovits_reference_voice_id" TEXT,
  ADD COLUMN "enable_wake_word" BOOLEAN NOT NULL DEFAULT true,
  ADD COLUMN "wake_word" TEXT,
  ADD COLUMN "wake_sensitivity" DOUBLE PRECISION,
  ADD COLUMN "auto_start_services" BOOLEAN NOT NULL DEFAULT true,
  ADD COLUMN "pipeline_timeout" INTEGER NOT NULL DEFAULT 30,
  ADD COLUMN "model_path" TEXT;
