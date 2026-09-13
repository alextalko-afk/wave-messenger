import { Router } from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { nanoid } from 'nanoid';
import { rateLimit } from 'express-rate-limit';
import { get, run } from '../db/index.js';
import { authMiddleware } from '../middleware/auth.js';

const router = Router();

const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 30,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Слишком много попыток. Попробуйте позже.' },
});

const COLORS = ['#7c5cff', '#ff6b6b', '#2ecc71', '#f1c40f', '#3498db', '#e67e22', '#e84393', '#00cec9'];
const pickColor = () => COLORS[Math.floor(Math.random() * COLORS.length)];

function publicUser(u) {
  if (!u) return null;
  return {
    id: u.id,
    username: u.username,
    displayName: u.display_name,
    avatarColor: u.avatar_color,
    bio: u.bio,
    online: !!u.online,
    lastSeen: u.last_seen,
  };
}

router.post('/register', authLimiter, async (req, res) => {
  const { username, password, displayName } = req.body || {};
  if (!username || !password || username.length < 3 || password.length < 4) {
    return res.status(400).json({ error: 'Логин от 3 символов, пароль от 4 символов' });
  }
  const exists = await get('SELECT id FROM users WHERE username = ?', [username.toLowerCase()]);
  if (exists) return res.status(409).json({ error: 'Такой логин уже занят' });

  const id = nanoid();
  const hash = bcrypt.hashSync(password, 10);
  await run('INSERT INTO users (id, username, display_name, password_hash, avatar_color) VALUES (?, ?, ?, ?, ?)', [
    id,
    username.toLowerCase(),
    displayName || username,
    hash,
    pickColor(),
  ]);

  const token = jwt.sign({ userId: id }, process.env.JWT_SECRET, { expiresIn: '30d' });
  const user = await get('SELECT * FROM users WHERE id = ?', [id]);
  res.json({ token, user: publicUser(user) });
});

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
  const { displayName, bio } = req.body || {};
  await run('UPDATE users SET display_name = COALESCE(?, display_name), bio = COALESCE(?, bio) WHERE id = ?', [
    displayName ?? null,
    bio ?? null,
    req.userId,
  ]);
  const user = await get('SELECT * FROM users WHERE id = ?', [req.userId]);
  res.json({ user: publicUser(user) });
});

export { publicUser };
export default router;
