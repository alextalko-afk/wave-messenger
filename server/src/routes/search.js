import { Router } from 'express';
import { all, searchKey } from '../db/index.js';
import { authMiddleware } from '../middleware/auth.js';
import { searchLimiter } from '../limiters.js';
import { parseLimit, parseCursor, olderThan, toPage } from '../pagination.js';

const router = Router();
router.use(authMiddleware);

const MIN_QUERY_LENGTH = 2;
const MAX_QUERY_LENGTH = 100;

function snippet(content, needle) {
  const idx = content.toLowerCase().indexOf(needle);
  const start = Math.max(0, idx - 30);
  const text = content.slice(start, start + 120);
  return `${start > 0 ? '…' : ''}${text}${start + 120 < content.length ? '…' : ''}`;
}

// GET /api/search/messages?q=...&conversationId=...&limit=...&before=...&beforeId=...
// Searches only conversations the caller belongs to, and never reaches
// before the point where they cleared that chat's history. Matching runs in
// the database against messages.content_search (the JS-lower-cased text, so
// Cyrillic folds correctly); rows not yet backfilled fall back to ASCII-only
// LOWER(). Results are newest first; `nextCursor` continues the listing.
router.get('/messages', searchLimiter, async (req, res) => {
  const q = searchKey(String(req.query.q || '').trim());
  if (q.length < MIN_QUERY_LENGTH || q.length > MAX_QUERY_LENGTH) {
    return res.json({ results: [], hasMore: false, nextCursor: null });
  }
  const conversationId = typeof req.query.conversationId === 'string' ? req.query.conversationId : null;
  const limit = parseLimit(req.query.limit, 30, 50);
  const cursor = olderThan(parseCursor(req.query), { table: 'messages', alias: 'm' });

  const fetched = await all(
    `SELECT m.id, m.conversation_id, m.sender_id, m.content, m.created_at, u.display_name AS sender_name,
            c.is_group, c.name AS conv_name
     FROM messages m
     JOIN conversation_members cm ON cm.conversation_id = m.conversation_id AND cm.user_id = ?
     JOIN users u ON u.id = m.sender_id
     JOIN conversations c ON c.id = m.conversation_id
     WHERE m.deleted = 0 AND m.content != '' AND m.created_at > cm.cleared_before
       AND instr(COALESCE(m.content_search, lower(m.content)), ?) > 0
       ${conversationId ? 'AND m.conversation_id = ?' : ''}
       ${cursor.sql}
     ORDER BY m.created_at DESC, m.rowid DESC LIMIT ?`,
    [req.userId, q, ...(conversationId ? [conversationId] : []), ...cursor.args, limit + 1]
  );

  const { page, hasMore, nextCursor } = toPage(fetched, limit);
  res.json({
    results: page.map((r) => ({
      id: r.id,
      conversationId: r.conversation_id,
      senderId: r.sender_id,
      senderName: r.sender_name,
      isGroup: !!r.is_group,
      conversationName: r.is_group ? r.conv_name : null,
      snippet: snippet(r.content, q),
      createdAt: r.created_at,
    })),
    hasMore,
    nextCursor,
  });
});

export default router;
