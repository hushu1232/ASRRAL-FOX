import crypto from 'crypto';

function base32ToBuffer(secret: string): Buffer {
  const alphabet = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';
  let bits = '';
  for (const char of secret.toUpperCase().replace(/=+$/, '')) {
    const val = alphabet.indexOf(char);
    if (val === -1) continue;
    bits += val.toString(2).padStart(5, '0');
  }
  const bytes: number[] = [];
  for (let i = 0; i + 8 <= bits.length; i += 8) {
    bytes.push(parseInt(bits.substring(i, i + 8), 2));
  }
  return Buffer.from(bytes);
}

function generateSecret(): string {
  const alphabet = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';
  let secret = '';
  const bytes = crypto.randomBytes(20);
  for (let i = 0; i < 20; i++) {
    secret += alphabet[bytes[i] % 32];
  }
  return secret;
}

function generateLongSecret(): string {
  const alphabet = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';
  let secret = '';
  const bytes = crypto.randomBytes(32);
  for (let i = 0; i < 32; i++) {
    secret += alphabet[bytes[i] % 32];
  }
  return secret;
}

export function generateTotpUri(email: string, secret: string): string {
  const issuer = encodeURIComponent('AvatarManagement');
  const label = encodeURIComponent(email);
  return `otpauth://totp/${issuer}:${label}?secret=${secret}&issuer=${issuer}&algorithm=SHA1&digits=6&period=30`;
}

export function generateTotpSecret(): string {
  return generateLongSecret();
}

export function verifyTotp(secret: string, token: string): boolean {
  if (token.length !== 6 || !/^\d{6}$/.test(token)) return false;

  const key = base32ToBuffer(secret);
  const counter = Math.floor(Date.now() / 30000);

  // Check current and adjacent windows (±1 step)
  for (let offset = -1; offset <= 1; offset++) {
    const buf = Buffer.alloc(8);
    let c = counter + offset;
    for (let i = 7; i >= 0; i--) {
      buf[i] = c & 0xff;
      c = c >> 8;
    }
    const hmac = crypto.createHmac('sha1', key).update(buf).digest();
    const offset_byte = hmac[hmac.length - 1] & 0x0f;
    const code = ((hmac[offset_byte] & 0x7f) << 24 |
      (hmac[offset_byte + 1] & 0xff) << 16 |
      (hmac[offset_byte + 2] & 0xff) << 8 |
      (hmac[offset_byte + 3] & 0xff)) % 1000000;
    if (code.toString().padStart(6, '0') === token) return true;
  }
  return false;
}
