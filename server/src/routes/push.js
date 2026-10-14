import { Router } from 'express';
import { run } from '../db/index.js';
import { authMiddleware } from '../middleware/auth.js';

const router = Router();
router.use(authMiddleware);

const MAX_TOKEN_LENGTH = 4096;

// A device token belongs to whoever registered it last: if the same phone
// logs into another account, the token moves to that account.
router.post('/register', async (req, res) => {
  const { token, platform } = req.body || {};
  if (typeof token !== 'string' || !token || token.length > MAX_TOKEN_LENGTH) {
    return res.status(400).json({ error: 'Некорректный токен' });
  }
  const safePlatform = ['android', 'ios', 'web'].includes(platform) ? platform : null;
  await run(
    `INSERT INTO push_tokens (token, user_id, platform) VALUES (?, ?, ?)
     ON CONFLICT(token) DO UPDATE SET user_id = excluded.user_id, platform = excluded.platform`,
    [token, req.userId, safePlatform]
  );
  res.json({ ok: true });
});

router.post('/unregister', async (req, res) => {
  const { token } = req.body || {};
  if (typeof token === 'string' && token) {
    await run('DELETE FROM push_tokens WHERE token = ? AND user_id = ?', [token, req.userId]);
  }
  res.json({ ok: true });
});

export default router;
