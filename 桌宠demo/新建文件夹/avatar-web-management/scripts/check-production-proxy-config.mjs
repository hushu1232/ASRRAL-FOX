#!/usr/bin/env node

import { readFile } from 'node:fs/promises';
import path from 'node:path';
import process from 'node:process';
import { fileURLToPath } from 'node:url';

const projectRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const checks = [
  {
    file: 'helm/avatar-web/values-production.yaml',
    includes: [
      'nginx.ingress.kubernetes.io/proxy-body-size: "100m"',
      'nginx.ingress.kubernetes.io/proxy-request-buffering: "on"',
      'proxySetHeadersConfigMap: "avatar-web-proxy-headers"',
      'trustHeaders: true',
      'jwtLegacyRefreshTokenCutoff: ""',
    ],
  },
  {
    file: 'helm/avatar-web/templates/ingress.yaml',
    includes: ['nginx.ingress.kubernetes.io/proxy-set-headers'],
  },
  {
    file: 'helm/avatar-web/templates/configmap.yaml',
    includes: ['TRUST_PROXY_HEADERS', 'JWT_LEGACY_REFRESH_TOKEN_CUTOFF'],
  },
  {
    file: 'helm/avatar-web/templates/externalsecret.yaml',
    includes: ['TRUST_PROXY_SECRET', 'UPSTASH_REDIS_REST_URL', 'UPSTASH_REDIS_REST_TOKEN'],
  },
  {
    file: 'docs/operations/proxy-trust-boundary.md',
    includes: ['Content-Length', 'revoke-legacy-refresh-tokens.ts'],
  },
];

const failures = [];

for (const check of checks) {
  const filePath = path.join(projectRoot, check.file);
  let content;
  try {
    content = await readFile(filePath, 'utf8');
  } catch (error) {
    failures.push(`${check.file}: unable to read (${error instanceof Error ? error.message : String(error)})`);
    continue;
  }

  for (const expected of check.includes) {
    if (!content.includes(expected)) failures.push(`${check.file}: missing ${expected}`);
  }
}

if (failures.length) {
  console.error('Production proxy configuration check failed:');
  for (const failure of failures) console.error(`- ${failure}`);
  process.exitCode = 1;
} else {
  console.log('Production proxy configuration check passed.');
  console.log(`Checked ${checks.length} files under ${projectRoot}`);
}
