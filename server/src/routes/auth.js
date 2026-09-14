import { Router } from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { nanoid } from 'nanoid';
import { rateLimit } from 'express-rate-limit';
import { OAuth2Client } from 'google-auth-library';
import { get, run } from '../db/index.js';
import { authMiddleware } from '../middleware/auth.js';

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
  };
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

// Password-based registration is intentionally gone: new accounts are only
// created through /google (or /phone/verify). Existing password accounts
// still log in via /login below and can link a Google account with
// /link-google - nobody who already has an account loses access.
router.post('/login', authLimiter, async (req, res) => {
  const { username, password } = req.body || {};
  const user = await get('SELECT * FROM users WHERE username = ?', [(username || '').toLowerCase()]);
  if (!user || !bcrypt.compareSync(password || '', user.password_hash)) {
    return res.status(401).json({ error: 'Неверный логин или пароль' });
  }
  const token = jwt.sign({ userId: user.id }, process.env.JWT_SECRET, { expiresIn: '30d' });
  res.json({ token, user: publicUser(user) });
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

  await run('UPDATE users SET display_name = COALESCE(?, display_name), bio = COALESCE(?, bio) WHERE id = ?', [
    displayName ?? null,
    bio ?? null,
    req.userId,
  ]);
  const user = await get('SELECT * FROM users WHERE id = ?', [req.userId]);
  res.json({ user: publicUser(user) });
});

router.post('/change-password', authMiddleware, authLimiter, async (req, res) => {
  const { currentPassword, newPassword } = req.body || {};
  if (!newPassword || newPassword.length < 4) {
    return res.status(400).json({ error: 'Новый пароль от 4 символов' });
  }
  const user = await get('SELECT * FROM users WHERE id = ?', [req.userId]);
  if (!user || !bcrypt.compareSync(currentPassword || '', user.password_hash)) {
    return res.status(401).json({ error: 'Неверный текущий пароль' });
  }
  const hash = bcrypt.hashSync(newPassword, 10);
  await run('UPDATE users SET password_hash = ? WHERE id = ?', [hash, req.userId]);
  res.json({ ok: true });
});

// No SMS gateway is configured, so instead of sending a text we hand the
// code straight back in the response (devCode) - fine for personal/testing
// use like the rest of this app, but anyone with the phone number can log
// in without owning it. Swap this out for a real gateway (Twilio, SMS.ru,
// etc.) before this is used by people you don't trust.
router.post('/phone/request', authLimiter, async (req, res) => {
  const phone = normalizePhone(req.body?.phone);
  if (!phone) return res.status(400).json({ error: 'Некорректный номер телефона' });

  const code = String(Math.floor(10000 + Math.random() * 90000));
  const expiresAt = Math.floor(Date.now() / 1000) + 5 * 60;
  await run(
    `INSERT INTO phone_codes (phone, code, expires_at, attempts) VALUES (?, ?, ?, 0)
     ON CONFLICT(phone) DO UPDATE SET code = excluded.code, expires_at = excluded.expires_at, attempts = 0`,
    [phone, code, expiresAt]
  );
  res.json({ ok: true, devCode: code });
});

router.post('/phone/verify', authLimiter, async (req, res) => {
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
    await run(
      'INSERT INTO users (id, username, display_name, password_hash, avatar_color, phone) VALUES (?, ?, ?, ?, ?, ?)',
      [id, username, displayName || 'Новый пользователь', randomPasswordHash, pickColor(), phone]
    );
    user = await get('SELECT * FROM users WHERE id = ?', [id]);
  }

  const token = jwt.sign({ userId: user.id }, process.env.JWT_SECRET, { expiresIn: '30d' });
  res.json({ token, user: publicUser(user), isNewUser });
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
    await run(
      'INSERT INTO users (id, username, display_name, password_hash, avatar_color, google_id) VALUES (?, ?, ?, ?, ?, ?)',
      [id, username, payload.name || username, randomPasswordHash, pickColor(), googleId]
    );
    user = await get('SELECT * FROM users WHERE id = ?', [id]);
  }

  const token = jwt.sign({ userId: user.id }, process.env.JWT_SECRET, { expiresIn: '30d' });
  res.json({ token, user: publicUser(user), isNewUser });
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

export { publicUser };
export default router;
