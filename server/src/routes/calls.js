import { Router } from 'express';
import { createHmac } from 'crypto';
import { all } from '../db/index.js';
import { authMiddleware } from '../middleware/auth.js';
import { parseLimit, parseCursor, olderThan, toPage } from '../pagination.js';

const router = Router();
router.use(authMiddleware);

// ICE servers for WebRTC. STUN is always included; add a TURN relay (needed
// behind symmetric NAT / most mobile networks) with either:
//   TURN_URLS=turn:host:3478,turns:host:5349 plus
//   - TURN_SECRET (coturn `use-auth-secret`; short-lived credentials are
//     generated per request), or
//   - TURN_USERNAME + TURN_CREDENTIAL (static credentials).
const TURN_CREDENTIAL_TTL_SECONDS = 6 * 60 * 60;

function buildIceServers(userId) {
  const stunUrls = (process.env.STUN_URLS || 'stun:stun.l.google.com:19302,stun:stun1.l.google.com:19302')
    .split(',')
    .map((u) => u.trim())
    .filter(Boolean);
  const servers = stunUrls.map((urls) => ({ urls }));

  const turnUrls = (process.env.TURN_URLS || '').split(',').map((u) => u.trim()).filter(Boolean);
  if (turnUrls.length > 0) {
    if (process.env.TURN_SECRET) {
      const username = `${Math.floor(Date.now() / 1000) + TURN_CREDENTIAL_TTL_SECONDS}:${userId}`;
      const credential = createHmac('sha1', process.env.TURN_SECRET).update(username).digest('base64');
      servers.push({ urls: turnUrls, username, credential });
    } else if (process.env.TURN_USERNAME && process.env.TURN_CREDENTIAL) {
      servers.push({ urls: turnUrls, username: process.env.TURN_USERNAME, credential: process.env.TURN_CREDENTIAL });
    }
  }
  return servers;
}

router.get('/ice-servers', (req, res) => {
  res.json({ iceServers: buildIceServers(req.userId) });
});

router.get('/', async (req, res) => {
  const limit = parseLimit(req.query.limit, 100, 100);
  const cursor = olderThan(parseCursor(req.query), { table: 'calls', alias: 'c', timeColumn: 'started_at' });
  const fetched = await all(
    `SELECT c.*,
       u1.display_name as caller_name, u1.avatar_color as caller_color, u1.avatar_url as caller_avatar_url,
       u2.display_name as callee_name, u2.avatar_color as callee_color, u2.avatar_url as callee_avatar_url
     FROM calls c
     JOIN users u1 ON u1.id = c.caller_id
     JOIN users u2 ON u2.id = c.callee_id
     WHERE (c.caller_id = ? OR c.callee_id = ?) ${cursor.sql}
     ORDER BY c.started_at DESC, c.rowid DESC LIMIT ?`,
    [req.userId, req.userId, ...cursor.args, limit + 1]
  );
  const { page: rows, hasMore, nextCursor } = toPage(fetched, limit, 'started_at');

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
    hasMore,
    nextCursor,
  });
});

export default router;
