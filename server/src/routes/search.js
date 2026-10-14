import { Router } from 'express';
import { all } from '../db/index.js';
import { authMiddleware } from '../middleware/auth.js';

const router = Router();
router.use(authMiddleware);

const MIN_QUERY_LENGTH = 2;
const MAX_QUERY_LENGTH = 100;
const MAX_RESULTS = 30;
// SQLite's LOWER()/LIKE only fold ASCII, so "привет" would never match
// "Привет". Pull the most recent candidates and compare in JS instead.
const MAX_CANDIDATES = 5000;

function snippet(content, needle) {
  const idx = content.toLowerCase().indexOf(needle);
  const start = Math.max(0, idx - 30);
  const text = content.slice(start, start + 120);
  return `${start > 0 ? '…' : ''}${text}${start + 120 < content.length ? '…' : ''}`;
}

// GET /api/search/messages?q=...&conversationId=...
// Searches only conversations the caller belongs to, and never reaches
// before the point where they cleared that chat's history.
router.get('/messages', async (req, res) => {
  const q = String(req.query.q || '').trim().toLowerCase();
  if (q.length < MIN_QUERY_LENGTH || q.length > MAX_QUERY_LENGTH) return res.json({ results: [] });
  const conversationId = typeof req.query.conversationId === 'string' ? req.query.conversationId : null;

  const rows = await all(
    `SELECT m.id, m.conversation_id, m.sender_id, m.content, m.created_at, u.display_name AS sender_name,
            c.is_group, c.name AS conv_name
     FROM messages m
     JOIN conversation_members cm ON cm.conversation_id = m.conversation_id AND cm.user_id = ?
     JOIN users u ON u.id = m.sender_id
     JOIN conversations c ON c.id = m.conversation_id
     WHERE m.deleted = 0 AND m.content != '' AND m.created_at > cm.cleared_before
       ${conversationId ? 'AND m.conversation_id = ?' : ''}
     ORDER BY m.created_at DESC LIMIT ${MAX_CANDIDATES}`,
    conversationId ? [req.userId, conversationId] : [req.userId]
  );

  const results = [];
  for (const r of rows) {
    if (!r.content.toLowerCase().includes(q)) continue;
    results.push({
      id: r.id,
      conversationId: r.conversation_id,
      senderId: r.sender_id,
      senderName: r.sender_name,
      isGroup: !!r.is_group,
      conversationName: r.is_group ? r.conv_name : null,
      snippet: snippet(r.content, q),
      createdAt: r.created_at,
    });
    if (results.length >= MAX_RESULTS) break;
  }
  res.json({ results });
});

export default router;
