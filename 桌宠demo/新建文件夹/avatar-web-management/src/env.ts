/**
 * 环境变量校验 — 启动时 fail-fast
 * 使用 zod v4 校验 process.env，缺少必需变量或格式错误时立即抛出错误。
 */
import { z } from 'zod';

const envSchema = z.object({
  // 应用
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
  PORT: z.coerce.number().int().positive().default(3000),
  NEXT_PUBLIC_APP_URL: z.string().optional(),
  NEXT_PUBLIC_CDN_URL: z.string().optional(),
  NEXT_PUBLIC_WS_PORT: z.coerce.number().int().positive().optional(),

  // 数据库（至少需要一个）
  DATABASE_PATH: z.string().optional(),
  DATABASE_URL: z.string().optional(),

  // JWT（生产环境至少需要 PRIVATE_KEY 或 JWT_SECRET）
  JWT_SECRET: z.string().optional(),
  JWT_PRIVATE_KEY: z.string().optional(),
  JWT_PUBLIC_KEY: z.string().optional(),
  JWT_KEY_ID: z.string().optional(),
  JWT_KEYS_DIR: z.string().optional(),
  JWT_PRIVATE_KEY_PATH: z.string().optional(),
  JWT_PUBLIC_KEY_PATH: z.string().optional(),
  JWT_ACCESS_EXPIRY: z.string().optional(),
  JWT_REFRESH_EXPIRY_DAYS: z.coerce.number().int().positive().optional(),

  // OIDC/SSO（可选）
  SSO_ISSUER: z.string().optional(),
  AZURE_AD_TENANT: z.string().optional(),
  KEYCLOAK_URL: z.string().optional(),
  SSO_CLIENT_ID: z.string().optional(),
  SSO_CLIENT_SECRET: z.string().optional(),
  SSO_REDIRECT_URI: z.string().optional(),

  // 对象存储（可选，默认本地文件系统）
  STORAGE_DRIVER: z.enum(['minio', 'fs']).optional(),
  STORAGE_ENDPOINT: z.string().optional(),
  STORAGE_PORT: z.coerce.number().int().positive().optional(),
  STORAGE_USE_SSL: z.string().optional(),
  STORAGE_ACCESS_KEY: z.string().optional(),
  STORAGE_SECRET_KEY: z.string().optional(),
  STORAGE_BUCKET: z.string().optional(),
  STORAGE_PUBLIC_URL: z.string().optional(),
  STORAGE_LOCAL_DIR: z.string().optional(),

  // Redis（可选，不设置则优雅降级）
  REDIS_HOST: z.string().optional(),
  REDIS_PORT: z.coerce.number().int().positive().optional(),
  REDIS_PASSWORD: z.string().optional(),
  REDIS_DB: z.coerce.number().int().min(0).optional(),
  REDIS_KEY_PREFIX: z.string().optional(),
  REDIS_URL: z.string().optional(),

  // WebSocket
  WS_PORT: z.coerce.number().int().positive().optional(),

  // Sentry（可选）
  SENTRY_DSN: z.string().optional(),

  // 支付（可选，不设置则使用 Mock 模拟支付）
  STRIPE_SECRET_KEY: z.string().optional(),
  STRIPE_WEBHOOK_SECRET: z.string().optional(),
  STRIPE_PUBLISHABLE_KEY: z.string().optional(),
  PAYMENT_PROVIDER: z.enum(['stripe', 'mock']).optional(),

  // Feature Flags（可选）
  FF_NEW_EDITOR_UI: z.enum(['true', 'false']).optional(),
  FF_AI_BLENDSHAPE: z.enum(['true', 'false']).optional(),
  FF_EXPORT_VRM: z.enum(['true', 'false']).optional(),
});

export type Env = z.infer<typeof envSchema>;

let validatedEnv: Env | null = null;

export function validateEnv(): Env {
  if (validatedEnv) return validatedEnv;

  const parsed = envSchema.safeParse(process.env);
  if (!parsed.success) {
    const errors = parsed.error.issues
      .map((i) => `  - ${i.path.join('.')}: ${i.message}`)
      .join('\n');
    throw new Error(`[Env] 环境变量校验失败:\n${errors}`);
  }

  const env = parsed.data;

  // 生产环境额外检查
  if (env.NODE_ENV === 'production') {
    if (!env.JWT_PRIVATE_KEY && !env.JWT_SECRET) {
      throw new Error(
        '[Env] 生产环境必须设置 JWT_PRIVATE_KEY（推荐）或 JWT_SECRET'
      );
    }
    if (!env.DATABASE_PATH && !env.DATABASE_URL) {
      throw new Error(
        '[Env] 生产环境必须设置 DATABASE_PATH 或 DATABASE_URL'
      );
    }
    if (env.JWT_SECRET && env.JWT_SECRET.length < 32) {
      throw new Error(
        '[Env] 生产环境 JWT_SECRET 长度不足（至少需要 32 个字符）'
      );
    }
  }

  validatedEnv = env;
  return env;
}

/** 获取已校验的环境变量（需先调用 validateEnv） */
export function getEnv(): Env {
  if (!validatedEnv) {
    return validateEnv();
  }
  return validatedEnv;
}
