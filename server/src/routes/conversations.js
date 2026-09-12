import { Router } from 'express';
import { nanoid } from 'nanoid';
import db, { transaction } from '../db/index.js';
import { authMiddleware } from '../middleware/auth.js';
import { publicUser } from './auth.js';

const router = Router();
router.use(authMiddleware);

function getMembers(conversationId) {
  const rows = db
    .prepare(
      `SELECT u.*, cm.role, cm.last_read_at FROM conversation_members cm JOIN users u ON u.id = cm.user_id WHERE cm.conversation_id = ?`
    )
    .all(conversationId);
  return rows.map((r) => ({ ...publicUser(r), role: r.role, lastReadAt: r.last_read_at }));
}

function getOwnMember(conversationId, userId) {
  return db
    .prepare('SELECT * FROM conversation_members WHERE conversation_id = ? AND user_id = ?')
    .get(conversationId, userId);
}

function getLastMessage(conversationId, clearedBefore = 0) {
  return db
    .prepare(
      `SELECT m.*, u.display_name as sender_name FROM messages m JOIN users u ON u.id = m.sender_id
       WHERE m.conversation_id = ? AND m.created_at > ? ORDER BY m.created_at DESC LIMIT 1`
    )
    .get(conversationId, clearedBefore);
}

function getUnreadCount(conversationId, userId, own) {
  const threshold = Math.max(own?.last_read_at || 0, own?.cleared_before || 0);
  const row = db
    .prepare(
      `SELECT COUNT(*) as c FROM messages WHERE conversation_id = ? AND created_at > ? AND sender_id != ? AND deleted = 0`
    )
    .get(conversationId, threshold, userId);
  return row.c;
}

function serializeConversation(conv, userId) {
  const members = getMembers(conv.id);
  const own = getOwnMember(conv.id, userId);
  const last = getLastMessage(conv.id, own?.cleared_before || 0);
  const other = !conv.is_group ? members.find((m) => m.id !== userId) : null;
  const realUnread = getUnreadCount(conv.id, userId, own);
  return {
    id: conv.id,
    isGroup: !!conv.is_group,
    name: conv.is_group ? conv.name : other?.displayName || 'Диалог',
    avatarColor: conv.is_group ? conv.avatar_color : other?.avatarColor || '#7c5cff',
    members,
    otherUser: other || null,
    lastMessage: last
      ? {
          id: last.id,
          content: last.deleted ? 'Сообщение удалено' : last.content,
          senderId: last.sender_id,
          senderName: last.sender_name,
          fileType: last.file_type,
          createdAt: last.created_at,
        }
      : null,
    unreadCount: own?.manually_unread ? Math.max(realUnread, 1) : realUnread,
    pinned: !!own?.pinned,
    muted: !!own?.muted,
    createdAt: conv.created_at,
  };
}

router.get('/', (req, res) => {
  const conversations = db
    .prepare(
      `SELECT c.* FROM conversations c JOIN conversation_members cm ON cm.conversation_id = c.id
       WHERE cm.user_id = ? ORDER BY c.created_at DESC`
    )
    .all(req.userId);
  const result = conversations
    .map((c) => serializeConversation(c, req.userId))
    .sort((a, b) => {
      if (a.pinned !== b.pinned) return a.pinned ? -1 : 1;
      return (b.lastMessage?.createdAt || b.createdAt) - (a.lastMessage?.createdAt || a.createdAt);
    });
  res.json({ conversations: result });
});

router.post('/direct', (req, res) => {
  const { userId: targetId } = req.body || {};
  if (!targetId || targetId === req.userId) return res.status(400).json({ error: 'Некорректный пользователь' });

  const target = db.prepare('SELECT * FROM users WHERE id = ?').get(targetId);
  if (!target) return res.status(404).json({ error: 'Пользователь не найден' });

  const existing = db
    .prepare(
      `SELECT c.* FROM conversations c
       JOIN conversation_members m1 ON m1.conversation_id = c.id AND m1.user_id = ?
       JOIN conversation_members m2 ON m2.conversation_id = c.id AND m2.user_id = ?
       WHERE c.is_group = 0`
    )
    .get(req.userId, targetId);

  if (existing) return res.json({ conversation: serializeConversation(existing, req.userId) });

  const id = nanoid();
  transaction(() => {
    db.prepare('INSERT INTO conversations (id, is_group, created_by) VALUES (?, 0, ?)').run(id, req.userId);
    db.prepare('INSERT INTO conversation_members (conversation_id, user_id) VALUES (?, ?)').run(id, req.userId);
    db.prepare('INSERT INTO conversation_members (conversation_id, user_id) VALUES (?, ?)').run(id, targetId);
  });
  const conv = db.prepare('SELECT * FROM conversations WHERE id = ?').get(id);
  res.json({ conversation: serializeConversation(conv, req.userId) });
});

router.post('/group', (req, res) => {
  const { name, memberIds } = req.body || {};
  if (!name || !Array.isArray(memberIds) || memberIds.length < 1) {
    return res.status(400).json({ error: 'Укажите название и хотя бы одного участника' });
  }
  const id = nanoid();
  transaction(() => {
    db.prepare('INSERT INTO conversations (id, is_group, name, created_by) VALUES (?, 1, ?, ?)').run(
      id,
      name,
      req.userId
    );
    db.prepare('INSERT INTO conversation_members (conversation_id, user_id, role) VALUES (?, ?, ?)').run(
      id,
      req.userId,
      'admin'
    );
    const seen = new Set([req.userId]);
    for (const uid of memberIds) {
      if (seen.has(uid)) continue;
      seen.add(uid);
      db.prepare('INSERT INTO conversation_members (conversation_id, user_id) VALUES (?, ?)').run(id, uid);
    }
  });
  const conv = db.prepare('SELECT * FROM conversations WHERE id = ?').get(id);
  res.json({ conversation: serializeConversation(conv, req.userId) });
});

router.get('/:id/messages', (req, res) => {
  const member = db
    .prepare('SELECT * FROM conversation_members WHERE conversation_id = ? AND user_id = ?')
    .get(req.params.id, req.userId);
  if (!member) return res.status(403).json({ error: 'Нет доступа к этому чату' });

  const before = req.query.before ? Number(req.query.before) : Date.now() / 1000 + 1000000;
  const clearedBefore = member.cleared_before || 0;
  const rows = db
    .prepare(
      `SELECT m.*, u.display_name as sender_name, u.avatar_color as sender_color FROM messages m
       JOIN users u ON u.id = m.sender_id
       WHERE m.conversation_id = ? AND m.created_at < ? AND m.created_at > ? ORDER BY m.created_at DESC LIMIT 50`
    )
    .all(req.params.id, before, clearedBefore);

  res.json({
    messages: rows.reverse().map((m) => ({
      id: m.id,
      conversationId: m.conversation_id,
      senderId: m.sender_id,
      senderName: m.sender_name,
      senderColor: m.sender_color,
      content: m.deleted ? '' : m.content,
      fileUrl: m.deleted ? null : m.file_url,
      fileName: m.file_name,
      fileType: m.file_type,
      replyToId: m.reply_to_id,
      editedAt: m.edited_at,
      deleted: !!m.deleted,
      createdAt: m.created_at,
    })),
  });
});

router.get('/:id/stats', (req, res) => {
  const member = db
    .prepare('SELECT 1 FROM conversation_members WHERE conversation_id = ? AND user_id = ?')
    .get(req.params.id, req.userId);
  if (!member) return res.status(403).json({ error: 'Нет доступа к этому чату' });

  const photos = db
    .prepare(`SELECT COUNT(*) c FROM messages WHERE conversation_id = ? AND deleted = 0 AND file_type LIKE 'image/%'`)
    .get(req.params.id).c;
  const voice = db
    .prepare(`SELECT COUNT(*) c FROM messages WHERE conversation_id = ? AND deleted = 0 AND file_type LIKE 'audio/%'`)
    .get(req.params.id).c;
  const files = db
    .prepare(
      `SELECT COUNT(*) c FROM messages WHERE conversation_id = ? AND deleted = 0 AND file_url IS NOT NULL
       AND file_type NOT LIKE 'image/%' AND file_type NOT LIKE 'audio/%'`
    )
    .get(req.params.id).c;

  const conv = db.prepare('SELECT is_group FROM conversations WHERE id = ?').get(req.params.id);
  let sharedGroups = 0;
  if (conv && !conv.is_group) {
    const other = db
      .prepare('SELECT user_id FROM conversation_members WHERE conversation_id = ? AND user_id != ?')
      .get(req.params.id, req.userId);
    if (other) {
      sharedGroups = db
        .prepare(
          `SELECT COUNT(*) c FROM conversations c2
           JOIN conversation_members m1 ON m1.conversation_id = c2.id AND m1.user_id = ?
           JOIN conversation_members m2 ON m2.conversation_id = c2.id AND m2.user_id = ?
           WHERE c2.is_group = 1`
        )
        .get(req.userId, other.user_id).c;
    }
  }

  res.json({ photos, voice, files, sharedGroups });
});

router.get('/:id/media', (req, res) => {
  const member = db
    .prepare('SELECT 1 FROM conversation_members WHERE conversation_id = ? AND user_id = ?')
    .get(req.params.id, req.userId);
  if (!member) return res.status(403).json({ error: 'Нет доступа к этому чату' });

  const type = req.query.type;
  let whereClause;
  if (type === 'photos') whereClause = "file_type LIKE 'image/%'";
  else if (type === 'voice') whereClause = "file_type LIKE 'audio/%'";
  else whereClause = "file_url IS NOT NULL AND file_type NOT LIKE 'image/%' AND file_type NOT LIKE 'audio/%'";

  const rows = db
    .prepare(
      `SELECT id, file_url, file_name, file_type, created_at FROM messages
       WHERE conversation_id = ? AND deleted = 0 AND ${whereClause} ORDER BY created_at DESC`
    )
    .all(req.params.id);

  res.json({
    items: rows.map((r) => ({
      id: r.id,
      fileUrl: r.file_url,
      fileName: r.file_name,
      fileType: r.file_type,
      createdAt: r.created_at,
    })),
  });
});

router.get('/:id/shared-groups', (req, res) => {
  const member = db
    .prepare('SELECT 1 FROM conversation_members WHERE conversation_id = ? AND user_id = ?')
    .get(req.params.id, req.userId);
  if (!member) return res.status(403).json({ error: 'Нет доступа к этому чату' });

  const conv = db.prepare('SELECT is_group FROM conversations WHERE id = ?').get(req.params.id);
  if (!conv || conv.is_group) return res.json({ groups: [] });

  const other = db
    .prepare('SELECT user_id FROM conversation_members WHERE conversation_id = ? AND user_id != ?')
    .get(req.params.id, req.userId);
  if (!other) return res.json({ groups: [] });

  const rows = db
    .prepare(
      `SELECT c2.id, c2.name, c2.avatar_color,
        (SELECT COUNT(*) FROM conversation_members cm3 WHERE cm3.conversation_id = c2.id) as member_count
       FROM conversations c2
       JOIN conversation_members m1 ON m1.conversation_id = c2.id AND m1.user_id = ?
       JOIN conversation_members m2 ON m2.conversation_id = c2.id AND m2.user_id = ?
       WHERE c2.is_group = 1`
    )
    .all(req.userId, other.user_id);

  res.json({
    groups: rows.map((r) => ({ id: r.id, name: r.name, avatarColor: r.avatar_color, memberCount: r.member_count })),
  });
});

router.post('/:id/read', (req, res) => {
  const now = Math.floor(Date.now() / 1000);
  db.prepare(
    'UPDATE conversation_members SET last_read_at = ?, manually_unread = 0 WHERE conversation_id = ? AND user_id = ?'
  ).run(now, req.params.id, req.userId);
  res.json({ ok: true });
});

router.post('/:id/pin', (req, res) => {
  const { pinned } = req.body || {};
  db.prepare('UPDATE conversation_members SET pinned = ? WHERE conversation_id = ? AND user_id = ?').run(
    pinned ? 1 : 0,
    req.params.id,
    req.userId
  );
  res.json({ ok: true });
});

router.post('/:id/mute', (req, res) => {
  const { muted } = req.body || {};
  db.prepare('UPDATE conversation_members SET muted = ? WHERE conversation_id = ? AND user_id = ?').run(
    muted ? 1 : 0,
    req.params.id,
    req.userId
  );
  res.json({ ok: true });
});

router.post('/:id/mark-unread', (req, res) => {
  const { unread } = req.body || {};
  db.prepare('UPDATE conversation_members SET manually_unread = ? WHERE conversation_id = ? AND user_id = ?').run(
    unread ? 1 : 0,
    req.params.id,
    req.userId
  );
  res.json({ ok: true });
});

router.post('/:id/clear', (req, res) => {
  const now = Math.floor(Date.now() / 1000);
  db.prepare(
    'UPDATE conversation_members SET cleared_before = ?, last_read_at = ? WHERE conversation_id = ? AND user_id = ?'
  ).run(now, now, req.params.id, req.userId);
  res.json({ ok: true });
});

router.delete('/:id', (req, res) => {
  const member = getOwnMember(req.params.id, req.userId);
  if (!member) return res.status(403).json({ error: 'Нет доступа к этому чату' });
  db.prepare('DELETE FROM conversation_members WHERE conversation_id = ? AND user_id = ?').run(
    req.params.id,
    req.userId
  );
  const remaining = db
    .prepare('SELECT COUNT(*) c FROM conversation_members WHERE conversation_id = ?')
    .get(req.params.id).c;
  if (remaining === 0) {
    db.prepare('DELETE FROM conversations WHERE id = ?').run(req.params.id);
  }
  res.json({ ok: true });
});

export { serializeConversation };
export default router;
