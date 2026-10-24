import { createCipheriv, createDecipheriv, createHmac, randomBytes, randomInt, scryptSync, timingSafeEqual } from 'node:crypto';

// Time-based one-time passwords (RFC 6238, HMAC-SHA1, 6 digits, 30 s steps):
// the format Google Authenticator, Authy, 1Password and friends all speak.

const BASE32 = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';
export const STEP_SECONDS = 30;
export const DIGITS = 6;

export function base32Encode(buffer) {
  let bits = 0;
  let value = 0;
  let out = '';
  for (const byte of buffer) {
    value = (value << 8) | byte;
    bits += 8;
    while (bits >= 5) {
      out += BASE32[(value >>> (bits - 5)) & 31];
      bits -= 5;
    }
  }
  if (bits > 0) out += BASE32[(value << (5 - bits)) & 31];
  return out;
}

export function base32Decode(text) {
  let bits = 0;
  let value = 0;
  const bytes = [];
  for (const char of text.replace(/=+$/, '').toUpperCase()) {
    const index = BASE32.indexOf(char);
    if (index === -1) throw new Error('Invalid base32 character');
    value = (value << 5) | index;
    bits += 5;
    if (bits >= 8) {
      bytes.push((value >>> (bits - 8)) & 255);
      bits -= 8;
    }
  }
  return Buffer.from(bytes);
}

export const generateSecret = () => base32Encode(randomBytes(20));

function hotp(key, counter, digits = DIGITS) {
  const message = Buffer.alloc(8);
  message.writeBigUInt64BE(BigInt(counter));
  const hmac = createHmac('sha1', key).update(message).digest();
  const offset = hmac[hmac.length - 1] & 0x0f;
  const binary = hmac.readUInt32BE(offset) & 0x7fffffff;
  return String(binary % 10 ** digits).padStart(digits, '0');
}

export const stepAt = (timeMs = Date.now()) => Math.floor(timeMs / 1000 / STEP_SECONDS);

export function totpCode(secret, timeMs = Date.now()) {
  return hotp(base32Decode(secret), stepAt(timeMs));
}

function sameString(a, b) {
  const left = Buffer.from(a);
  const right = Buffer.from(b);
  return left.length === right.length && timingSafeEqual(left, right);
}

/**
 * Checks `code` against the current step and `window` steps either side (clock
 * drift). Returns the matching step, or null.
 */
export function verifyTotp(secret, code, { timeMs = Date.now(), window = 1 } = {}) {
  const clean = String(code ?? '').replace(/\s+/g, '');
  if (!/^\d{6}$/.test(clean)) return null;
  const key = base32Decode(secret);
  const now = stepAt(timeMs);
  let match = null;
  for (let step = now - window; step <= now + window; step++) {
    // no early exit: every candidate is compared so timing doesn't leak which matched
    if (sameString(hotp(key, step), clean)) match = step;
  }
  return match;
}

export function otpauthUrl({ secret, account, issuer = 'Wave' }) {
  const label = `${encodeURIComponent(issuer)}:${encodeURIComponent(account)}`;
  const query = new URLSearchParams({ secret, issuer, algorithm: 'SHA1', digits: String(DIGITS), period: String(STEP_SECONDS) });
  return `otpauth://totp/${label}?${query}`;
}

// ---- secrets at rest: AES-256-GCM, key derived from the server's own secret ----

let cachedKey;
function encryptionKey() {
  if (!cachedKey) {
    const material = process.env.TOTP_ENCRYPTION_KEY || process.env.JWT_SECRET;
    if (!material) throw new Error('JWT_SECRET (or TOTP_ENCRYPTION_KEY) is required to protect 2FA secrets');
    cachedKey = scryptSync(material, 'wave-totp-v1', 32);
  }
  return cachedKey;
}

export function encryptSecret(plain) {
  const iv = randomBytes(12);
  const cipher = createCipheriv('aes-256-gcm', encryptionKey(), iv);
  const body = Buffer.concat([cipher.update(plain, 'utf8'), cipher.final()]);
  return [iv, cipher.getAuthTag(), body].map((part) => part.toString('base64')).join('.');
}

export function decryptSecret(stored) {
  const [iv, tag, body] = String(stored).split('.').map((part) => Buffer.from(part, 'base64'));
  const decipher = createDecipheriv('aes-256-gcm', encryptionKey(), iv);
  decipher.setAuthTag(tag);
  return Buffer.concat([decipher.update(body), decipher.final()]).toString('utf8');
}

// ---- recovery codes ----

const RECOVERY_ALPHABET = 'abcdefghjkmnpqrstuvwxyz23456789'; // no look-alikes (i l o 0 1)

export function generateRecoveryCodes(count = 10) {
  return Array.from({ length: count }, () => {
    const chars = Array.from({ length: 10 }, () => RECOVERY_ALPHABET[randomInt(RECOVERY_ALPHABET.length)]).join('');
    return `${chars.slice(0, 5)}-${chars.slice(5)}`;
  });
}

export const normalizeRecoveryCode = (code) => String(code ?? '').toLowerCase().replace(/[\s-]+/g, '');

export function hashRecoveryCode(code) {
  return createHmac('sha256', encryptionKey()).update(normalizeRecoveryCode(code)).digest('hex');
}
