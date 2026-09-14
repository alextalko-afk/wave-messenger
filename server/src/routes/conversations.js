import { Router } from 'express';
import { nanoid } from 'nanoid';
import { get, all, run, batch } from '../db/index.js';
import { authMiddleware } from '../middleware/auth.js';
import { publicUser } from './auth.js';
import { upload, useCloudinary } from './upload.js';

const router = Router();
router.use(authMiddleware);

async function getMembers(conversationId) {
  const rows = await all(
    `SELECT u.*, cm.role, cm.last_read_at FROM conversation_members cm JOIN users u ON u.id = cm.user_id WHERE cm.conversation_id = ?`,
    [conversationId]
  );
  return rows.map((r) => ({ ...publicUser(r), role: r.role, lastReadAt: r.last_read_at }));
}

async function getOwnMember(conversationId, userId) {
  return get('SELECT * FROM conversation_members WHERE conversation_id = ? AND user_id = ?', [conversationId, userId]);
}

async function getLastMessage(conversationId, clearedBefore = 0) {
  return get(
    `SELECT m.*, u.display_name as sender_name FROM messages m JOIN users u ON u.id = m.sender_id
     WHERE m.conversation_id = ? AND m.created_at > ? ORDER BY m.created_at DESC LIMIT 1`,
    [conversationId, clearedBefore]
  );
}

async function getUnreadCount(conversationId, userId, own) {
  const threshold = Math.max(own?.last_read_at || 0, own?.cleared_before || 0);
  const row = await get(
    `SELECT COUNT(*) as c FROM messages WHERE conversation_id = ? AND created_at > ? AND sender_id != ? AND deleted = 0`,
    [conversationId, threshold, userId]
  );
  return row.c;
}

async function serializeConversation(conv, userId) {
  const members = await getMembers(conv.id);
  const own = await getOwnMember(conv.id, userId);
  const last = await getLastMessage(conv.id, own?.cleared_before || 0);
  const other = !conv.is_group ? members.find((m) => m.id !== userId) : null;
  const realUnread = await getUnreadCount(conv.id, userId, own);
  return {
    id: conv.id,
    isGroup: !!conv.is_group,
    name: conv.is_group ? conv.name : other?.displayName || 'Диалог',
    avatarColor: conv.is_group ? conv.avatar_color : other?.avatarColor || '#7c5cff',
    avatarUrl: conv.is_group ? conv.avatar_url || null : other?.avatarUrl || null,
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

router.get('/', async (req, res) => {
  const conversations = await all(
    `SELECT c.* FROM conversations c JOIN conversation_members cm ON cm.conversation_id = c.id
     WHERE cm.user_id = ? ORDER BY c.created_at DESC`,
    [req.userId]
  );
  const result = (await Promise.all(conversations.map((c) => serializeConversation(c, req.userId)))).sort((a, b) => {
    if (a.pinned !== b.pinned) return a.pinned ? -1 : 1;
    return (b.lastMessage?.createdAt || b.createdAt) - (a.lastMessage?.createdAt || a.createdAt);
  });
  res.json({ conversations: result });
});

router.post('/direct', async (req, res) => {
  const { userId: targetId } = req.body || {};
  if (!targetId || targetId === req.userId) return res.status(400).json({ error: 'Некорректный пользователь' });

  const target = await get('SELECT * FROM users WHERE id = ?', [targetId]);
  if (!target) return res.status(404).json({ error: 'Пользователь не найден' });

  const existing = await get(
    `SELECT c.* FROM conversations c
     JOIN conversation_members m1 ON m1.conversation_id = c.id AND m1.user_id = ?
     JOIN conversation_members m2 ON m2.conversation_id = c.id AND m2.user_id = ?
     WHERE c.is_group = 0`,
    [req.userId, targetId]
  );

  if (existing) return res.json({ conversation: await serializeConversation(existing, req.userId) });

  const id = nanoid();
  await batch([
    { sql: 'INSERT INTO conversations (id, is_group, created_by) VALUES (?, 0, ?)', args: [id, req.userId] },
    { sql: 'INSERT INTO conversation_members (conversation_id, user_id) VALUES (?, ?)', args: [id, req.userId] },
    { sql: 'INSERT INTO conversation_members (conversation_id, user_id) VALUES (?, ?)', args: [id, targetId] },
  ]);
  const conv = await get('SELECT * FROM conversations WHERE id = ?', [id]);
  res.json({ conversation: await serializeConversation(conv, req.userId) });
});

router.post('/group', async (req, res) => {
  const { name, memberIds } = req.body || {};
  if (!name || !Array.isArray(memberIds) || memberIds.length < 1) {
    return res.status(400).json({ error: 'Укажите название и хотя бы одного участника' });
  }
  const id = nanoid();
  const statements = [
    { sql: 'INSERT INTO conversations (id, is_group, name, created_by) VALUES (?, 1, ?, ?)', args: [id, name, req.userId] },
    { sql: 'INSERT INTO conversation_members (conversation_id, user_id, role) VALUES (?, ?, ?)', args: [id, req.userId, 'admin'] },
  ];
  const seen = new Set([req.userId]);
  for (const uid of memberIds) {
    if (seen.has(uid)) continue;
    seen.add(uid);
    statements.push({ sql: 'INSERT INTO conversation_members (conversation_id, user_id) VALUES (?, ?)', args: [id, uid] });
  }
  await batch(statements);
  const conv = await get('SELECT * FROM conversations WHERE id = ?', [id]);
  res.json({ conversation: await serializeConversation(conv, req.userId) });
});

async function requireGroupAdmin(req, res) {
  const conv = await get('SELECT is_group FROM conversations WHERE id = ?', [req.params.id]);
  if (!conv || !conv.is_group) {
    res.status(404).json({ error: 'Группа не найдена' });
    return false;
  }
  const member = await get('SELECT role FROM conversation_members WHERE conversation_id = ? AND user_id = ?', [
    req.params.id,
    req.userId,
  ]);
  if (!member || member.role !== 'admin') {
    res.status(403).json({ error: 'Только администратор группы может менять аватар' });
    return false;
  }
  return true;
}

router.post('/:id/avatar', upload.single('file'), async (req, res) => {
  if (!(await requireGroupAdmin(req, res))) return;
  if (!req.file) return res.status(400).json({ error: 'Файл не получен' });
  if (!req.file.mimetype?.startsWith('image/')) {
    return res.status(400).json({ error: 'Аватар должен быть изображением' });
  }
  const url = useCloudinary ? req.file.path : `/uploads/${req.file.filename}`;
  await run('UPDATE conversations SET avatar_url = ? WHERE id = ?', [url, req.params.id]);
  const conv = await get('SELECT * FROM conversations WHERE id = ?', [req.params.id]);
  res.json({ conversation: await serializeConversation(conv, req.userId) });
});

router.delete('/:id/avatar', async (req, res) => {
  if (!(await requireGroupAdmin(req, res))) return;
  await run('UPDATE conversations SET avatar_url = NULL WHERE id = ?', [req.params.id]);
  const conv = await get('SELECT * FROM conversations WHERE id = ?', [req.params.id]);
  res.json({ conversation: await serializeConversation(conv, req.userId) });
});

router.get('/:id/messages', async (req, res) => {
  const member = await get('SELECT * FROM conversation_members WHERE conversation_id = ? AND user_id = ?', [
    req.params.id,
    req.userId,
  ]);
  if (!member) return res.status(403).json({ error: 'Нет доступа к этому чату' });

  const before = req.query.before ? Number(req.query.before) : Date.now() / 1000 + 1000000;
  const clearedBefore = member.cleared_before || 0;
  const rows = await all(
    `SELECT m.*, u.display_name as sender_name, u.avatar_color as sender_color, u.avatar_url as sender_avatar_url FROM messages m
     JOIN users u ON u.id = m.sender_id
     WHERE m.conversation_id = ? AND m.created_at < ? AND m.created_at > ? ORDER BY m.created_at DESC LIMIT 50`,
    [req.params.id, before, clearedBefore]
  );

  res.json({
    messages: rows.reverse().map((m) => ({
      id: m.id,
      conversationId: m.conversation_id,
      senderId: m.sender_id,
      senderName: m.sender_name,
      senderColor: m.sender_color,
      senderAvatarUrl: m.sender_avatar_url || null,
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

router.get('/:id/stats', async (req, res) => {
  const member = await get('SELECT 1 FROM conversation_members WHERE conversation_id = ? AND user_id = ?', [
    req.params.id,
    req.userId,
  ]);
  if (!member) return res.status(403).json({ error: 'Нет доступа к этому чату' });

  const photos = (
    await get(`SELECT COUNT(*) c FROM messages WHERE conversation_id = ? AND deleted = 0 AND file_type LIKE 'image/%'`, [
      req.params.id,
    ])
  ).c;
  const voice = (
    await get(`SELECT COUNT(*) c FROM messages WHERE conversation_id = ? AND deleted = 0 AND file_type LIKE 'audio/%'`, [
      req.params.id,
    ])
  ).c;
  const files = (
    await get(
      `SELECT COUNT(*) c FROM messages WHERE conversation_id = ? AND deleted = 0 AND file_url IS NOT NULL
       AND file_type NOT LIKE 'image/%' AND file_type NOT LIKE 'audio/%'`,
      [req.params.id]
    )
  ).c;

  const conv = await get('SELECT is_group FROM conversations WHERE id = ?', [req.params.id]);
  let sharedGroups = 0;
  if (conv && !conv.is_group) {
    const other = await get('SELECT user_id FROM conversation_members WHERE conversation_id = ? AND user_id != ?', [
      req.params.id,
      req.userId,
    ]);
    if (other) {
      sharedGroups = (
        await get(
          `SELECT COUNT(*) c FROM conversations c2
           JOIN conversation_members m1 ON m1.conversation_id = c2.id AND m1.user_id = ?
           JOIN conversation_members m2 ON m2.conversation_id = c2.id AND m2.user_id = ?
           WHERE c2.is_group = 1`,
          [req.userId, other.user_id]
        )
      ).c;
    }
  }

  res.json({ photos, voice, files, sharedGroups });
});

router.get('/:id/media', async (req, res) => {
  const member = await get('SELECT 1 FROM conversation_members WHERE conversation_id = ? AND user_id = ?', [
    req.params.id,
    req.userId,
  ]);
  if (!member) return res.status(403).json({ error: 'Нет доступа к этому чату' });

  const type = req.query.type;
  let whereClause;
  if (type === 'photos') whereClause = "file_type LIKE 'image/%'";
  else if (type === 'voice') whereClause = "file_type LIKE 'audio/%'";
  else whereClause = "file_url IS NOT NULL AND file_type NOT LIKE 'image/%' AND file_type NOT LIKE 'audio/%'";

  const rows = await all(
    `SELECT id, file_url, file_name, file_type, created_at FROM messages
     WHERE conversation_id = ? AND deleted = 0 AND ${whereClause} ORDER BY created_at DESC`,
    [req.params.id]
  );

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

router.get('/:id/shared-groups', async (req, res) => {
  const member = await get('SELECT 1 FROM conversation_members WHERE conversation_id = ? AND user_id = ?', [
    req.params.id,
    req.userId,
  ]);
  if (!member) return res.status(403).json({ error: 'Нет доступа к этому чату' });

  const conv = await get('SELECT is_group FROM conversations WHERE id = ?', [req.params.id]);
  if (!conv || conv.is_group) return res.json({ groups: [] });

  const other = await get('SELECT user_id FROM conversation_members WHERE conversation_id = ? AND user_id != ?', [
    req.params.id,
    req.userId,
  ]);
  if (!other) return res.json({ groups: [] });

  const rows = await all(
    `SELECT c2.id, c2.name, c2.avatar_color,
      (SELECT COUNT(*) FROM conversation_members cm3 WHERE cm3.conversation_id = c2.id) as member_count
     FROM conversations c2
     JOIN conversation_members m1 ON m1.conversation_id = c2.id AND m1.user_id = ?
     JOIN conversation_members m2 ON m2.conversation_id = c2.id AND m2.user_id = ?
     WHERE c2.is_group = 1`,
    [req.userId, other.user_id]
  );

  res.json({
    groups: rows.map((r) => ({ id: r.id, name: r.name, avatarColor: r.avatar_color, memberCount: r.member_count })),
  });
});

router.post('/:id/read', async (req, res) => {
  const now = Math.floor(Date.now() / 1000);
  await run('UPDATE conversation_members SET last_read_at = ?, manually_unread = 0 WHERE conversation_id = ? AND user_id = ?', [
    now,
    req.params.id,
    req.userId,
  ]);
  res.json({ ok: true });
});

router.post('/:id/pin', async (req, res) => {
  const { pinned } = req.body || {};
  await run('UPDATE conversation_members SET pinned = ? WHERE conversation_id = ? AND user_id = ?', [
    pinned ? 1 : 0,
    req.params.id,
    req.userId,
  ]);
  res.json({ ok: true });
});

router.post('/:id/mute', async (req, res) => {
  const { muted } = req.body || {};
  await run('UPDATE conversation_members SET muted = ? WHERE conversation_id = ? AND user_id = ?', [
    muted ? 1 : 0,
    req.params.id,
    req.userId,
  ]);
  res.json({ ok: true });
});

router.post('/:id/mark-unread', async (req, res) => {
  const { unread } = req.body || {};
  await run('UPDATE conversation_members SET manually_unread = ? WHERE conversation_id = ? AND user_id = ?', [
    unread ? 1 : 0,
    req.params.id,
    req.userId,
  ]);
  res.json({ ok: true });
});

router.post('/:id/clear', async (req, res) => {
  const now = Math.floor(Date.now() / 1000);
  await run(
    'UPDATE conversation_members SET cleared_before = ?, last_read_at = ? WHERE conversation_id = ? AND user_id = ?',
    [now, now, req.params.id, req.userId]
  );
  res.json({ ok: true });
});

router.delete('/:id', async (req, res) => {
  const member = await getOwnMember(req.params.id, req.userId);
  if (!member) return res.status(403).json({ error: 'Нет доступа к этому чату' });
  await run('DELETE FROM conversation_members WHERE conversation_id = ? AND user_id = ?', [req.params.id, req.userId]);
  const remaining = (
    await get('SELECT COUNT(*) c FROM conversation_members WHERE conversation_id = ?', [req.params.id])
  ).c;
  if (remaining === 0) {
    await run('DELETE FROM conversations WHERE id = ?', [req.params.id]);
  }
  res.json({ ok: true });
});

export { serializeConversation };
export default router;
