import { Router } from 'express';
import db from '../db/index.js';
import { authMiddleware } from '../middleware/auth.js';
import { publicUser } from './auth.js';

const router = Router();
router.use(authMiddleware);

router.get('/search', (req, res) => {
  const q = String(req.query.q || '').toLowerCase().trim();
  if (!q) return res.json({ users: [] });
  const rows = db
    .prepare(
      `SELECT * FROM users WHERE id != ? AND (LOWER(username) LIKE ? OR LOWER(display_name) LIKE ?) LIMIT 20`
    )
    .all(req.userId, `%${q}%`, `%${q}%`);
  res.json({ users: rows.map(publicUser) });
});

export default router;
