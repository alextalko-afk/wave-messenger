import { Router } from 'express';
import { all, searchKey } from '../db/index.js';
import { authMiddleware } from '../middleware/auth.js';
import { searchLimiter } from '../limiters.js';
import { parseLimit } from '../pagination.js';
import { publicUser } from './auth.js';

const router = Router();
router.use(authMiddleware);

// GET /api/users/search?q=...&limit=...&offset=...
// Matches usernames (always lower-case ASCII) and display names. SQLite's
// LOWER()/LIKE only fold ASCII, so display names are matched against
// users.display_name_lower, which is folded in JS when the name is written
// ("алиса" finds "Алиса").
router.get('/search', searchLimiter, async (req, res) => {
  const q = searchKey(String(req.query.q || '').trim());
  if (!q) return res.json({ users: [], hasMore: false });
  const limit = parseLimit(req.query.limit, 20, 50);
  const offset = Math.max(0, Number.parseInt(req.query.offset, 10) || 0);

  const rows = await all(
    `SELECT * FROM users
     WHERE id != ? AND (instr(username, ?) > 0 OR instr(COALESCE(display_name_lower, lower(display_name)), ?) > 0)
     ORDER BY created_at DESC, rowid DESC LIMIT ? OFFSET ?`,
    [req.userId, q, q, limit + 1, offset]
  );
  res.json({ users: rows.slice(0, limit).map(publicUser), hasMore: rows.length > limit });
});

export default router;
