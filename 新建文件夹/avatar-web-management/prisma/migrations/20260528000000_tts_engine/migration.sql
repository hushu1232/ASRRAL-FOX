-- AlterTable — Add TTS engine fields for GPT-SoVITS integration
ALTER TABLE "pet_configs" ADD COLUMN "tts_engine" TEXT NOT NULL DEFAULT 'sherpa-onnx';
ALTER TABLE "pet_configs" ADD COLUMN "gpt_sovits_url" TEXT;
ALTER TABLE "pet_configs" ADD COLUMN "custom_voice_id" TEXT;
