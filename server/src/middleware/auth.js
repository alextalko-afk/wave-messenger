import jwt from 'jsonwebtoken';
import { get, run } from '../db/index.js';

const TOKEN_TTL = '30d';

// A token is only as good as the user row behind it: the row must still exist
// and its token_version must match the one stamped into the token. Looking this
// up on every request is a primary-key read; a few seconds of cache keeps
// remote databases (Turso) from paying a round trip per call, and revocation
// on this process invalidates the cache immediately.
const VERSION_CACHE_TTL_MS = Number(process.env.AUTH_CACHE_TTL_MS ?? 10_000);
const VERSION_CACHE_MAX = 5000;
const versionCache = new Map(); // userId -> { version: number | null, expires }

const revokeListeners = new Set();

export function signToken(user) {
  return jwt.sign({ userId: user.id, v: Number(user.token_version) || 0 }, process.env.JWT_SECRET, {
    expiresIn: TOKEN_TTL,
  });
}

// The user's current token version, or null when the user no longer exists.
async function currentTokenVersion(userId) {
  const now = Date.now();
  const cached = versionCache.get(userId);
  if (cached && cached.expires > now) return cached.version;

  const row = typeof userId === 'string' ? await get('SELECT token_version FROM users WHERE id = ?', [userId]) : null;
  const version = row ? Number(row.token_version) || 0 : null;
  if (versionCache.size >= VERSION_CACHE_MAX) versionCache.clear();
  versionCache.set(userId, { version, expires: now + VERSION_CACHE_TTL_MS });
  return version;
}

/** The authenticated user's id and token version, or null if the token is invalid, revoked, or its user is gone. */
async function authenticate(token) {
  let payload;
  try {
    payload = jwt.verify(token, process.env.JWT_SECRET);
  } catch {
    return null;
  }
  const version = await currentTokenVersion(payload.userId);
  if (version === null || version !== (Number(payload.v) || 0)) return null;
  return { userId: payload.userId, version };
}

export async function authMiddleware(req, res, next) {
  const header = req.headers.authorization;
  if (!header || !header.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Нет токена авторизации' });
  }
  const auth = await authenticate(header.slice(7));
  if (!auth) return res.status(401).json({ error: 'Недействительный токен' });
  req.userId = auth.userId;
  next();
}

export async function verifySocketToken(token) {
  return authenticate(token);
}

/**
 * Invalidates every token issued to the user so far and returns the new
 * version (stamp it into the replacement token via signToken).
 */
export async function revokeUserTokens(userId) {
  await run('UPDATE users SET token_version = token_version + 1 WHERE id = ?', [userId]);
  const row = await get('SELECT token_version FROM users WHERE id = ?', [userId]);
  const version = row ? Number(row.token_version) || 0 : null;
  versionCache.set(userId, { version, expires: Date.now() + VERSION_CACHE_TTL_MS });
  return version;
}

/** Drops the cached version, e.g. after the user row was deleted. */
export function forgetUser(userId) {
  versionCache.delete(userId);
}

/**
 * Lets the realtime layer close sockets that authenticated with a token that
 * has since been revoked. `fn(userId, currentVersion)` is called after the
 * HTTP response that triggered the revocation has been sent, so the device
 * that changed its password can pick up its new token before it reconnects.
 */
export function onTokensRevoked(fn) {
  revokeListeners.add(fn);
}

export function announceRevocation(res, userId, version) {
  res.once('finish', () => {
    for (const fn of revokeListeners) {
      try {
        fn(userId, version);
      } catch (err) {
        console.error('revocation listener failed:', err);
      }
    }
  });
}
