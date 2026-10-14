import { Router } from 'express';
import { all } from '../db/index.js';
import { authMiddleware } from '../middleware/auth.js';
import { publicUser } from './auth.js';

const router = Router();
router.use(authMiddleware);

router.get('/search', async (req, res) => {
  const q = String(req.query.q || '').toLowerCase().trim();
  if (!q) return res.json({ users: [] });
  // SQLite's LOWER()/LIKE only fold ASCII, so match in JS to make Cyrillic
  // search case-insensitive ("алиса" finds "Алиса").
  const rows = await all('SELECT * FROM users WHERE id != ? ORDER BY created_at DESC LIMIT 5000', [req.userId]);
  const matches = rows
    .filter((u) => u.username.toLowerCase().includes(q) || u.display_name.toLowerCase().includes(q))
    .slice(0, 20);
  res.json({ users: matches.map(publicUser) });
});

export default router;
