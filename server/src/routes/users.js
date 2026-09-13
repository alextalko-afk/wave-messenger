import { Router } from 'express';
import { all } from '../db/index.js';
import { authMiddleware } from '../middleware/auth.js';
import { publicUser } from './auth.js';

const router = Router();
router.use(authMiddleware);

router.get('/search', async (req, res) => {
  const q = String(req.query.q || '').toLowerCase().trim();
  if (!q) return res.json({ users: [] });
  const rows = await all(
    `SELECT * FROM users WHERE id != ? AND (LOWER(username) LIKE ? OR LOWER(display_name) LIKE ?) LIMIT 20`,
    [req.userId, `%${q}%`, `%${q}%`]
  );
  res.json({ users: rows.map(publicUser) });
});

export default router;
