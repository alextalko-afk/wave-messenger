import { Router } from 'express';
import { all } from '../db/index.js';
import { authMiddleware } from '../middleware/auth.js';

const router = Router();
router.use(authMiddleware);

router.get('/', async (req, res) => {
  const rows = await all(
    `SELECT c.*,
       u1.display_name as caller_name, u1.avatar_color as caller_color, u1.avatar_url as caller_avatar_url,
       u2.display_name as callee_name, u2.avatar_color as callee_color, u2.avatar_url as callee_avatar_url
     FROM calls c
     JOIN users u1 ON u1.id = c.caller_id
     JOIN users u2 ON u2.id = c.callee_id
     WHERE c.caller_id = ? OR c.callee_id = ?
     ORDER BY c.started_at DESC LIMIT 100`,
    [req.userId, req.userId]
  );

  res.json({
    calls: rows.map((r) => {
      const isOutgoing = r.caller_id === req.userId;
      const other = isOutgoing
        ? { id: r.callee_id, displayName: r.callee_name, avatarColor: r.callee_color, avatarUrl: r.callee_avatar_url }
        : { id: r.caller_id, displayName: r.caller_name, avatarColor: r.caller_color, avatarUrl: r.caller_avatar_url };
      return {
        id: r.id,
        conversationId: r.conversation_id,
        kind: r.kind,
        status: r.status,
        isOutgoing,
        otherUser: other,
        startedAt: r.started_at,
        answeredAt: r.answered_at,
        endedAt: r.ended_at,
        durationSeconds: r.answered_at && r.ended_at ? Math.max(0, r.ended_at - r.answered_at) : 0,
      };
    }),
  });
});

export default router;
