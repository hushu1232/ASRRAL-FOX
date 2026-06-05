import type { NextConfig } from "next";
import { withSentryConfig } from "@sentry/nextjs";
import createNextIntlPlugin from 'next-intl/plugin';

const withNextIntl = createNextIntlPlugin('./src/i18n/request.ts');

const withBundleAnalyzer = process.env.ANALYZE === 'true'
  ? require('@next/bundle-analyzer')()
  : (config: NextConfig) => config;

const isProduction = process.env.NODE_ENV === 'production';

const nextConfig: NextConfig = {
  output: 'standalone',
  // Production performance optimizations
  compress: true,              // gzip/brotli compression (default true)
  poweredByHeader: false,      // Remove X-Powered-By header (security + fewer bytes)
  generateEtags: true,         // ETag-based cache validation
  serverExternalPackages: ['better-sqlite3', 'pg', 'argon2', 'playwright', 'playwright-core', '@prisma/client', '@prisma/adapter-better-sqlite3', '@prisma/adapter-pg', 'prisma', '@opentelemetry/sdk-node', '@opentelemetry/auto-instrumentations-node', '@opentelemetry/exporter-trace-otlp-http', '@opentelemetry/sdk-trace-base', '@opentelemetry/resources', '@opentelemetry/instrumentation-http', '@opentelemetry/instrumentation-pg', 'prom-client', '@gltf-transform/core', '@gltf-transform/functions', '@gltf-transform/extensions'],
  images: {
    formats: ['image/avif', 'image/webp'],
    deviceSizes: [360, 414, 768, 1024, 1280, 1536, 1920],
    imageSizes: [16, 32, 48, 64, 96, 128, 256, 384],
    minimumCacheTTL: 60 * 60 * 24, // 24 hours for optimized images
    remotePatterns: [
      {
        protocol: 'https',
        hostname: '**.storage.googleapis.com',
      },
      {
        protocol: 'https',
        hostname: '**.amazonaws.com',
      },
      {
        protocol: 'https',
        hostname: '**.digitaloceanspaces.com',
      },
      {
        protocol: 'https',
        hostname: '**.cloudfront.net',
      },
      {
        protocol: 'https',
        hostname: '**.supabase.co',
      },
      {
        protocol: 'http',
        hostname: 'localhost',
      },
      {
        protocol: 'https',
        hostname: 'localhost',
      },
    ],
  },
  async headers() {
    const commonHeaders = [
      { key: 'X-Content-Type-Options', value: 'nosniff' },
      { key: 'X-Frame-Options', value: 'DENY' },
      { key: 'X-XSS-Protection', value: '1; mode=block' },
      { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
      { key: 'Permissions-Policy', value: 'camera=(), microphone=(), geolocation=()' },
      {
        key: 'Content-Security-Policy',
        value: [
          "default-src 'self'",
          // unsafe-eval required by: Three.js WebGL shader compilation (new Function)
          // unsafe-inline on script-src removed in production; dev needs it for HMR
          isProduction
            ? "script-src 'self' 'unsafe-eval' 'strict-dynamic' https:"
            : "script-src 'self' 'unsafe-eval' 'unsafe-inline' https:",
          // style-src unsafe-inline required by: Ant Design CSS-in-JS (emotion)
          "style-src 'self' 'unsafe-inline'",
          "img-src 'self' data: blob: https: http:",
          "connect-src 'self' ws: wss: https: http:",
          "worker-src 'self' blob:",
          "font-src 'self'",
          "media-src 'self' blob:",
          "object-src 'none'",
          "base-uri 'self'",
          "form-action 'self'",
          isProduction ? "upgrade-insecure-requests" : "",
          `report-uri ${process.env.CSP_REPORT_URI || '/api/csp-report'}`,
        ].filter(Boolean).join('; '),
      },
    ];

    const productionHeaders = isProduction
      ? [{ key: 'Strict-Transport-Security', value: 'max-age=63072000; includeSubDomains; preload' }]
      : [];

    return [
      // Static assets — long-lived cache with immutable directive
      {
        source: '/_next/static/:path*',
        headers: [
          { key: 'Cache-Control', value: 'public, max-age=31536000, immutable' },
        ],
      },
      // Public assets — 1 year cache
      {
        source: '/assets/:path*',
        headers: [
          { key: 'Cache-Control', value: 'public, max-age=31536000, must-revalidate' },
        ],
      },
      // All other routes — security headers only
      {
        source: '/:path*',
        headers: [...commonHeaders, ...productionHeaders],
      },
    ];
  },
};

const intlConfig = withNextIntl(nextConfig);
const analyzedConfig = withBundleAnalyzer(intlConfig);

const sentryConfig = withSentryConfig(analyzedConfig, {
  org: process.env.SENTRY_ORG,
  project: process.env.SENTRY_PROJECT,
  silent: !process.env.SENTRY_DSN,
  widenClientFileUpload: true,
  sourcemaps: {
    disable: process.env.NODE_ENV !== 'production',
  },
});

export default process.env.SENTRY_DSN ? sentryConfig : analyzedConfig;

