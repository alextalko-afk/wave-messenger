import { Router } from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { nanoid } from 'nanoid';
import { randomInt } from 'crypto';
import { rateLimit } from 'express-rate-limit';
import { OAuth2Client } from 'google-auth-library';
import { get, run, batch, searchKey } from '../db/index.js';
import {
  generateSecret,
  verifyTotp,
  otpauthUrl,
  encryptSecret,
  decryptSecret,
  generateRecoveryCodes,
  hashRecoveryCode,
  normalizeRecoveryCode,
} from '../totp.js';
import { authMiddleware, signToken, revokeUserTokens, announceRevocation } from '../middleware/auth.js';

const router = Router();
const googleClient = new OAuth2Client(process.env.GOOGLE_CLIENT_ID);

const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 30,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Слишком много попыток. Попробуйте позже.' },
});

const COLORS = ['#7c5cff', '#ff6b6b', '#2ecc71', '#f1c40f', '#3498db', '#e67e22', '#e84393', '#00cec9'];
const pickColor = () => COLORS[Math.floor(Math.random() * COLORS.length)];

function normalizePhone(phone) {
  if (!phone) return null;
  const digits = String(phone).trim().replace(/[^\d+]/g, '');
  if (!/^\+?\d{7,15}$/.test(digits)) return null;
  return digits.startsWith('+') ? digits : `+${digits}`;
}

function publicUser(u) {
  if (!u) return null;
  return {
    id: u.id,
    username: u.username,
    displayName: u.display_name,
    avatarColor: u.avatar_color,
    avatarUrl: u.avatar_url || null,
    bio: u.bio,
    online: !!u.online,
    lastSeen: u.last_seen,
    hasGoogle: !!u.google_id,
    twoFactorEnabled: !!u.totp_enabled,
  };
}

// Invalidates all of the user's tokens and returns a replacement. Sockets that
// authenticated with an old token are closed once `res` has been sent.
async function rotateSession(userId, res) {
  const version = await revokeUserTokens(userId);
  announceRevocation(res, userId, version);
  return signToken(await get('SELECT * FROM users WHERE id = ?', [userId]));
}

async function verifyGoogleIdToken(idToken) {
  if (!process.env.GOOGLE_CLIENT_ID) {
    const err = new Error('Google Sign-In не настроен на сервере');
    err.status = 500;
    throw err;
  }
  try {
    const ticket = await googleClient.verifyIdToken({ idToken, audience: process.env.GOOGLE_CLIENT_ID });
    return ticket.getPayload();
  } catch (e) {
    if (e.status) throw e;
    const err = new Error('Недействительный токен Google');
    err.status = 401;
    throw err;
  }
}

// With two-step verification on, a correct password (or Google identity) only
// earns a short-lived challenge; the session starts after /2fa/verify.
function finishSignIn(res, user, extra = {}) {
  if (user.totp_enabled) {
    const challengeToken = jwt.sign({ userId: user.id, purpose: '2fa' }, process.env.JWT_SECRET, { expiresIn: '5m' });
    return res.json({ twoFactorRequired: true, challengeToken, ...extra });
  }
  return res.json({ token: signToken(user), user: publicUser(user), ...extra });
}

// Password-based registration is intentionally gone: new accounts are only
// created through /google (or /phone/verify). Existing password accounts
// still log in via /login below and can link a Google account with
// /link-google - nobody who already has an account loses access.
router.post('/login', authLimiter, async (req, res) => {
  const { username, password } = req.body || {};
  const user = await get('SELECT * FROM users WHERE username = ?', [(username || '').toLowerCase()]);
  if (!user || !(await bcrypt.compare(String(password || ''), user.password_hash))) {
    return res.status(401).json({ error: 'Неверный логин или пароль' });
  }
  finishSignIn(res, user);
});

router.get('/me', authMiddleware, async (req, res) => {
  const user = await get('SELECT * FROM users WHERE id = ?', [req.userId]);
  if (!user) return res.status(404).json({ error: 'Пользователь не найден' });
  res.json({ user: publicUser(user) });
});

router.put('/me', authMiddleware, async (req, res) => {
  const { displayName, bio, username } = req.body || {};

  if (username != null) {
    const normalized = String(username).toLowerCase().trim();
    if (normalized.length < 3) {
      return res.status(400).json({ error: 'Логин от 3 символов' });
    }
    if (!/^[a-z0-9_]+$/.test(normalized)) {
      return res.status(400).json({ error: 'Логин может содержать только латинские буквы, цифры и подчёркивание' });
    }
    const exists = await get('SELECT id FROM users WHERE username = ? AND id != ?', [normalized, req.userId]);
    if (exists) return res.status(409).json({ error: 'Такой логин уже занят' });
    await run('UPDATE users SET username = ? WHERE id = ?', [normalized, req.userId]);
  }

  await run(
    'UPDATE users SET display_name = COALESCE(?, display_name), display_name_lower = COALESCE(?, display_name_lower), bio = COALESCE(?, bio) WHERE id = ?',
    [displayName ?? null, displayName == null ? null : searchKey(displayName), bio ?? null, req.userId]
  );
  const user = await get('SELECT * FROM users WHERE id = ?', [req.userId]);
  res.json({ user: publicUser(user) });
});

router.post('/change-password', authMiddleware, authLimiter, async (req, res) => {
  const { currentPassword, newPassword } = req.body || {};
  if (typeof newPassword !== 'string' || newPassword.length < 8) {
    return res.status(400).json({ error: 'Новый пароль от 8 символов' });
  }
  const user = await get('SELECT * FROM users WHERE id = ?', [req.userId]);
  if (!user || !(await bcrypt.compare(String(currentPassword || ''), user.password_hash))) {
    return res.status(401).json({ error: 'Неверный текущий пароль' });
  }
  const hash = await bcrypt.hash(newPassword, 10);
  await run('UPDATE users SET password_hash = ? WHERE id = ?', [hash, req.userId]);
  // A password change must cut off whoever else holds a token: bump the
  // version and hand this device a fresh token so it stays signed in.
  res.json({ ok: true, token: await rotateSession(req.userId, res) });
});

// "Sign out of all other devices". Returns a new token for the caller.
router.post('/revoke-sessions', authMiddleware, authLimiter, async (req, res) => {
  res.json({ ok: true, token: await rotateSession(req.userId, res) });
});

// No SMS gateway is configured, so there is no way to deliver a code to the
// phone's owner. Returning the code in the response (devCode) lets anyone log
// in as any phone number, so it is only available when explicitly opted into
// with ALLOW_DEV_PHONE_CODE=1 (local development). Otherwise phone login is
// disabled until a real gateway (Twilio, SMS.ru, etc.) is wired in here.
const DEV_PHONE_CODES = process.env.ALLOW_DEV_PHONE_CODE === '1';

router.post('/phone/request', authLimiter, async (req, res) => {
  if (!DEV_PHONE_CODES) {
    return res.status(503).json({ error: 'Вход по номеру телефона временно недоступен' });
  }
  const phone = normalizePhone(req.body?.phone);
  if (!phone) return res.status(400).json({ error: 'Некорректный номер телефона' });

  const code = String(randomInt(10000, 100000));
  const expiresAt = Math.floor(Date.now() / 1000) + 5 * 60;
  await run(
    `INSERT INTO phone_codes (phone, code, expires_at, attempts) VALUES (?, ?, ?, 0)
     ON CONFLICT(phone) DO UPDATE SET code = excluded.code, expires_at = excluded.expires_at, attempts = 0`,
    [phone, code, expiresAt]
  );
  res.json({ ok: true, devCode: code });
});

router.post('/phone/verify', authLimiter, async (req, res) => {
  if (!DEV_PHONE_CODES) {
    return res.status(503).json({ error: 'Вход по номеру телефона временно недоступен' });
  }
  const phone = normalizePhone(req.body?.phone);
  const { code, displayName } = req.body || {};
  if (!phone) return res.status(400).json({ error: 'Некорректный номер телефона' });

  const entry = await get('SELECT * FROM phone_codes WHERE phone = ?', [phone]);
  if (!entry) return res.status(400).json({ error: 'Сначала запросите код' });
  if (entry.expires_at < Math.floor(Date.now() / 1000)) {
    return res.status(400).json({ error: 'Код истёк, запросите новый' });
  }
  if (entry.attempts >= 5) {
    return res.status(429).json({ error: 'Слишком много попыток, запросите новый код' });
  }
  if (String(code || '') !== entry.code) {
    await run('UPDATE phone_codes SET attempts = attempts + 1 WHERE phone = ?', [phone]);
    return res.status(401).json({ error: 'Неверный код' });
  }
  await run('DELETE FROM phone_codes WHERE phone = ?', [phone]);

  let user = await get('SELECT * FROM users WHERE phone = ?', [phone]);
  let isNewUser = false;
  if (!user) {
    isNewUser = true;
    const id = nanoid();
    const username = `user_${Math.floor(1e8 + Math.random() * 9e8)}`;
    const randomPasswordHash = bcrypt.hashSync(nanoid(), 10);
    const name = displayName || 'Новый пользователь';
    await run(
      'INSERT INTO users (id, username, display_name, display_name_lower, password_hash, avatar_color, phone) VALUES (?, ?, ?, ?, ?, ?, ?)',
      [id, username, name, searchKey(name), randomPasswordHash, pickColor(), phone]
    );
    user = await get('SELECT * FROM users WHERE id = ?', [id]);
  }

  finishSignIn(res, user, { isNewUser });
});

router.post('/google', authLimiter, async (req, res) => {
  const { idToken } = req.body || {};
  if (!idToken) return res.status(400).json({ error: 'Нет idToken' });

  let payload;
  try {
    payload = await verifyGoogleIdToken(idToken);
  } catch (e) {
    return res.status(e.status || 401).json({ error: e.message });
  }

  const googleId = payload.sub;
  let user = await get('SELECT * FROM users WHERE google_id = ?', [googleId]);
  let isNewUser = false;
  if (!user) {
    isNewUser = true;
    const id = nanoid();
    const base = (payload.email ? payload.email.split('@')[0] : 'user').toLowerCase().replace(/[^a-z0-9_]/g, '') || 'user';
    let username = base;
    while (await get('SELECT id FROM users WHERE username = ?', [username])) {
      username = `${base}_${Math.floor(1000 + Math.random() * 9000)}`;
    }
    const randomPasswordHash = bcrypt.hashSync(nanoid(), 10);
    const name = payload.name || username;
    await run(
      'INSERT INTO users (id, username, display_name, display_name_lower, password_hash, avatar_color, google_id) VALUES (?, ?, ?, ?, ?, ?, ?)',
      [id, username, name, searchKey(name), randomPasswordHash, pickColor(), googleId]
    );
    user = await get('SELECT * FROM users WHERE id = ?', [id]);
  }

  finishSignIn(res, user, { isNewUser });
});

router.post('/link-google', authMiddleware, authLimiter, async (req, res) => {
  const { idToken } = req.body || {};
  if (!idToken) return res.status(400).json({ error: 'Нет idToken' });

  let payload;
  try {
    payload = await verifyGoogleIdToken(idToken);
  } catch (e) {
    return res.status(e.status || 401).json({ error: e.message });
  }

  const googleId = payload.sub;
  const other = await get('SELECT id FROM users WHERE google_id = ? AND id != ?', [googleId, req.userId]);
  if (other) return res.status(409).json({ error: 'Этот Google-аккаунт уже привязан к другому пользователю' });

  await run('UPDATE users SET google_id = ? WHERE id = ?', [googleId, req.userId]);
  const user = await get('SELECT * FROM users WHERE id = ?', [req.userId]);
  res.json({ user: publicUser(user) });
});


// ---------------------------------------------------------------------------
// Two-step verification (authenticator app codes + one-time recovery codes)
// ---------------------------------------------------------------------------
const TWO_FACTOR_MAX_FAILURES = 5;
const TWO_FACTOR_LOCK_SECONDS = 5 * 60;
const nowSeconds = () => Math.floor(Date.now() / 1000);

/**
 * Checks a 6-digit authenticator code or a recovery code for `user`.
 * A code is single-use: authenticator codes can't be replayed within their
 * time window, recovery codes are burnt. Repeated failures lock the account's
 * second step for a few minutes.
 */
async function checkSecondFactor(user, rawCode) {
  const now = nowSeconds();
  if (Number(user.totp_locked_until) > now) return { ok: false, locked: true };

  const code = String(rawCode ?? '').trim();
  let ok = false;
  const secret = user.totp_secret ? decryptSecret(user.totp_secret) : null;
  if (secret && /^[\d\s]{6,8}$/.test(code)) {
    const step = verifyTotp(secret, code);
    if (step !== null) {
      const res = await run('UPDATE users SET totp_last_step = ? WHERE id = ? AND totp_last_step < ?', [step, user.id, step]);
      ok = res.changes === 1;
    }
  } else if (normalizeRecoveryCode(code).length === 10) {
    const res = await run(
      'UPDATE recovery_codes SET used_at = ? WHERE user_id = ? AND code_hash = ? AND used_at IS NULL',
      [now, user.id, hashRecoveryCode(code)]
    );
    ok = res.changes === 1;
  }

  if (ok) {
    await run('UPDATE users SET totp_failed = 0, totp_locked_until = 0 WHERE id = ?', [user.id]);
    return { ok: true };
  }
  const failed = Number(user.totp_failed) + 1;
  const locked = failed >= TWO_FACTOR_MAX_FAILURES;
  await run('UPDATE users SET totp_failed = ?, totp_locked_until = ? WHERE id = ?', [
    locked ? 0 : failed,
    locked ? now + TWO_FACTOR_LOCK_SECONDS : 0,
    user.id,
  ]);
  return { ok: false, locked };
}

const secondFactorError = (res, result) =>
  result.locked
    ? res.status(429).json({ error: 'Слишком много неверных кодов. Попробуйте через 5 минут.' })
    : res.status(401).json({ error: 'Неверный код' });

async function replaceRecoveryCodes(userId) {
  const codes = generateRecoveryCodes(10);
  await batch([
    { sql: 'DELETE FROM recovery_codes WHERE user_id = ?', args: [userId] },
    ...codes.map((code) => ({
      sql: 'INSERT INTO recovery_codes (id, user_id, code_hash) VALUES (?, ?, ?)',
      args: [nanoid(), userId, hashRecoveryCode(code)],
    })),
  ]);
  return codes;
}

// Step 1: hand out a fresh secret (not active until /enable proves it works).
router.post('/2fa/setup', authMiddleware, authLimiter, async (req, res) => {
  const user = await get('SELECT * FROM users WHERE id = ?', [req.userId]);
  if (!user) return res.status(404).json({ error: 'Пользователь не найден' });
  if (user.totp_enabled) return res.status(409).json({ error: 'Двухэтапная проверка уже включена' });
  const secret = generateSecret();
  await run('UPDATE users SET totp_pending_secret = ? WHERE id = ?', [encryptSecret(secret), req.userId]);
  res.json({ secret, otpauthUrl: otpauthUrl({ secret, account: user.username }) });
});

// Step 2: the first valid code activates it and reveals the recovery codes (once).
router.post('/2fa/enable', authMiddleware, authLimiter, async (req, res) => {
  const user = await get('SELECT * FROM users WHERE id = ?', [req.userId]);
  if (!user) return res.status(404).json({ error: 'Пользователь не найден' });
  if (user.totp_enabled) return res.status(409).json({ error: 'Двухэтапная проверка уже включена' });
  if (!user.totp_pending_secret) return res.status(400).json({ error: 'Сначала получите секрет' });
  const step = verifyTotp(decryptSecret(user.totp_pending_secret), req.body?.code);
  if (step === null) return res.status(401).json({ error: 'Неверный код' });

  await run(
    `UPDATE users SET totp_secret = totp_pending_secret, totp_pending_secret = NULL, totp_enabled = 1,
       totp_last_step = ?, totp_failed = 0, totp_locked_until = 0 WHERE id = ?`,
    [step, req.userId]
  );
  const recoveryCodes = await replaceRecoveryCodes(req.userId);
  const updated = await get('SELECT * FROM users WHERE id = ?', [req.userId]);
  res.json({ ok: true, recoveryCodes, user: publicUser(updated) });
});

router.post('/2fa/disable', authMiddleware, authLimiter, async (req, res) => {
  const user = await get('SELECT * FROM users WHERE id = ?', [req.userId]);
  if (!user?.totp_enabled) return res.status(409).json({ error: 'Двухэтапная проверка не включена' });
  const result = await checkSecondFactor(user, req.body?.code);
  if (!result.ok) return secondFactorError(res, result);
  await batch([
    {
      sql: 'UPDATE users SET totp_enabled = 0, totp_secret = NULL, totp_pending_secret = NULL, totp_last_step = 0 WHERE id = ?',
      args: [req.userId],
    },
    { sql: 'DELETE FROM recovery_codes WHERE user_id = ?', args: [req.userId] },
  ]);
  const updated = await get('SELECT * FROM users WHERE id = ?', [req.userId]);
  res.json({ ok: true, user: publicUser(updated) });
});

router.post('/2fa/recovery-codes', authMiddleware, authLimiter, async (req, res) => {
  const user = await get('SELECT * FROM users WHERE id = ?', [req.userId]);
  if (!user?.totp_enabled) return res.status(409).json({ error: 'Двухэтапная проверка не включена' });
  const result = await checkSecondFactor(user, req.body?.code);
  if (!result.ok) return secondFactorError(res, result);
  res.json({ recoveryCodes: await replaceRecoveryCodes(req.userId) });
});

router.get('/2fa/recovery-codes/remaining', authMiddleware, async (req, res) => {
  const row = await get('SELECT COUNT(*) AS n FROM recovery_codes WHERE user_id = ? AND used_at IS NULL', [req.userId]);
  res.json({ remaining: Number(row.n) });
});

// Second step of a sign-in: trade the challenge from /login or /google, plus a code, for a session.
router.post('/2fa/verify', authLimiter, async (req, res) => {
  const { challengeToken, code } = req.body || {};
  let payload;
  try {
    payload = jwt.verify(String(challengeToken || ''), process.env.JWT_SECRET);
  } catch {
    return res.status(401).json({ error: 'Время подтверждения истекло. Войдите заново.' });
  }
  if (payload.purpose !== '2fa') return res.status(401).json({ error: 'Недействительный запрос' });
  const user = await get('SELECT * FROM users WHERE id = ?', [payload.userId]);
  if (!user?.totp_enabled) return res.status(401).json({ error: 'Недействительный запрос' });
  const result = await checkSecondFactor(user, code);
  if (!result.ok) return secondFactorError(res, result);
  res.json({ token: signToken(user), user: publicUser(user) });
});

export { publicUser };
export default router;
