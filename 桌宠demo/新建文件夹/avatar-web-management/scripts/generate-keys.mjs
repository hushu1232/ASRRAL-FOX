// 生成 RSA-256 密钥对用于 JWT 签名
// 用法: node scripts/generate-keys.mjs [--force]
//
// 输出:
//   keys/private.pem  — RSA 私钥 (PKCS#8, 权限 0600)
//   keys/public.pem   — RSA 公钥 (SPKI, 权限 0644)
//   keys/kid          — 密钥 ID (UUIDv4)
//
// 密钥对生成后，JWT 将自动从 HS256 切换到 RS256

import crypto from 'crypto';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const keysDir = path.join(__dirname, '..', 'keys');

const force = process.argv.includes('--force');

if (fs.existsSync(path.join(keysDir, 'private.pem')) && !force) {
  console.log('[generate-keys] Keys already exist. Use --force to overwrite.');
  process.exit(0);
}

if (!fs.existsSync(keysDir)) {
  fs.mkdirSync(keysDir, { recursive: true });
}

const { publicKey, privateKey } = crypto.generateKeyPairSync('rsa', {
  modulusLength: 2048,
  publicKeyEncoding: { type: 'spki', format: 'pem' },
  privateKeyEncoding: { type: 'pkcs8', format: 'pem' },
});

fs.writeFileSync(path.join(keysDir, 'private.pem'), privateKey, { mode: 0o600 });
fs.writeFileSync(path.join(keysDir, 'public.pem'), publicKey, { mode: 0o644 });
fs.writeFileSync(path.join(keysDir, 'kid'), crypto.randomUUID());

console.log('[generate-keys] RSA key pair generated successfully.');
console.log('  Private key:', path.join(keysDir, 'private.pem'));
console.log('  Public key: ', path.join(keysDir, 'public.pem'));
console.log('');
console.log('Add to .gitignore: keys/private.pem');
console.log('The public key can be committed safely.');
