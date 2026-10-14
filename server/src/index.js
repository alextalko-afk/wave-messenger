import 'dotenv/config';
import './asyncErrors.js';
import express from 'express';
import cors from 'cors';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';
import { createServer } from 'http';
import { Server } from 'socket.io';
import { nanoid } from 'nanoid';

import { get, all, run } from './db/index.js';
import { verifySocketToken } from './middleware/auth.js';
import authRoutes from './routes/auth.js';
import userRoutes from './routes/users.js';
import conversationRoutes, { serializeConversation } from './routes/conversations.js';
import uploadRoutes from './routes/upload.js';
import callsRoutes from './routes/calls.js';
import { uploadsDir } from './paths.js';

if (!process.env.JWT_SECRET) {
  console.error('JWT_SECRET is not set - refusing to start');
  process.exit(1);
}

process.on('unhandledRejection', (err) => console.error('unhandledRejection:', err));
process.on('uncaughtException', (err) => console.error('uncaughtException:', err));

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const app = express();
const httpServer = createServer(app);
const io = new Server(httpServer, {
  cors: { origin: process.env.CLIENT_ORIGIN || '*', credentials: true },
});

app.use(cors({ origin: process.env.CLIENT_ORIGIN || '*' }));
app.use(express.json());
const SAFE_INLINE_EXTENSIONS = new Set([
  '.png', '.jpg', '.jpeg', '.gif', '.webp', '.bmp', '.ico',
  '.mp3', '.wav', '.ogg', '.oga', '.weba', '.webm', '.m4a', '.mp4', '.mov',
]);

app.use(
  '/uploads',
  express.static(uploadsDir, {
    setHeaders: (res, filePath) => {
      // Uploaded files are user-controlled: never let the browser render or
      // execute them (HTML/SVG/JS could run scripts in our own origin and
      // steal tokens from localStorage). Force download for anything that
      // isn't a known-safe media type, and block MIME sniffing entirely.
      res.setHeader('X-Content-Type-Options', 'nosniff');
      res.setHeader('Content-Security-Policy', "default-src 'none'; sandbox");
      const ext = path.extname(filePath).toLowerCase();
      if (!SAFE_INLINE_EXTENSIONS.has(ext)) {
        res.setHeader('Content-Disposition', 'attachment');
      }
    },
  })
);

app.use('/api/auth', authRoutes);
app.use('/api/users', userRoutes);
app.use('/api/conversations', conversationRoutes);
app.use('/api/upload', uploadRoutes);
app.use('/api/calls', callsRoutes);

app.get('/api/health', (req, res) => res.json({ ok: true }));

const clientDist = path.join(__dirname, '..', 'public');
if (fs.existsSync(clientDist)) {
  app.use(
    express.static(clientDist, {
      index: false,
      setHeaders: (res, filePath) => {
        // Hashed build assets (assets/*.js, *.css) are immutable and safe to
        // cache forever; everything else (index.html, manifest, sw.js, icons)
        // must always be revalidated so phones/PWAs pick up new deploys
        // instead of running a stale cached bundle indefinitely.
        if (filePath.includes(`${path.sep}assets${path.sep}`)) {
          res.setHeader('Cache-Control', 'public, max-age=31536000, immutable');
        } else {
          res.setHeader('Cache-Control', 'no-cache');
        }
      },
    })
  );
  app.get(/^(?!\/api|\/uploads|\/socket\.io).*/, (req, res) => {
    res.setHeader('Cache-Control', 'no-cache');
    res.sendFile(path.join(clientDist, 'index.html'));
  });
}

// eslint-disable-next-line no-unused-vars
app.use((err, req, res, next) => {
  console.error(err);
  if (res.headersSent) return;
  if (err.code === 'LIMIT_FILE_SIZE') return res.status(413).json({ error: 'Файл слишком большой (максимум 25 МБ)' });
  res.status(err.status || 500).json({ error: err.status && err.status < 500 ? err.message : 'Внутренняя ошибка сервера' });
});

// -------- Socket.io realtime layer --------
const onlineUsers = new Map(); // userId -> Set(socketIds)

async function getConversationMemberIds(conversationId) {
  const rows = await all('SELECT user_id FROM conversation_members WHERE conversation_id = ?', [conversationId]);
  return rows.map((r) => r.user_id);
}

async function broadcastToConversation(conversationId, event, payload, exceptSocketId = null) {
  const memberIds = await getConversationMemberIds(conversationId);
  for (const uid of memberIds) {
    const sockets = onlineUsers.get(uid);
    if (!sockets) continue;
    for (const sid of sockets) {
      if (sid === exceptSocketId) continue;
      io.to(sid).emit(event, payload);
    }
  }
}

async function setPresence(userId, online) {
  await run("UPDATE users SET online = ?, last_seen = strftime('%s','now') WHERE id = ?", [online ? 1 : 0, userId]);
  const rows = await all('SELECT conversation_id FROM conversation_members WHERE user_id = ?', [userId]);
  const user = await get('SELECT last_seen FROM users WHERE id = ?', [userId]);
  for (const { conversation_id } of rows) {
    await broadcastToConversation(conversation_id, 'presence:update', {
      userId,
      online,
      lastSeen: user.last_seen,
    });
  }
}

io.use((socket, next) => {
  // socket.io-client-swift (the iOS native client) has no support for the
  // v3+ `auth` handshake payload, only query params - accept either so
  // that client can authenticate the same way Android/web already do.
  const token = socket.handshake.auth?.token || socket.handshake.query?.token;
  const payload = token && verifySocketToken(token);
  if (!payload) return next(new Error('unauthorized'));
  socket.userId = payload.userId;
  next();
});

const MAX_CONTENT_LENGTH = 5000;
const MAX_NAME_LENGTH = 255;
const MAX_EVENTS_PER_WINDOW = 150;
const EVENT_WINDOW_MS = 10_000;

const isString = (v) => typeof v === 'string';

// Uploads are returned by /api/upload as either a same-origin /uploads/ path
// or an https Cloudinary URL; anything else (javascript:, data:, arbitrary
// hosts) is rejected so a client can't plant it in other users' chats.
function isValidFileUrl(url) {
  return isString(url) && url.length <= 2048 && (url.startsWith('/uploads/') || /^https:\/\//i.test(url));
}

async function isMember(conversationId, userId) {
  if (!isString(conversationId)) return false;
  const row = await get('SELECT 1 FROM conversation_members WHERE conversation_id = ? AND user_id = ?', [
    conversationId,
    userId,
  ]);
  return !!row;
}

// A call may only be signalled between two users who share at least one
// conversation.
async function sharesConversation(userA, userB) {
  if (!isString(userB)) return false;
  const row = await get(
    `SELECT 1 FROM conversation_members m1
     JOIN conversation_members m2 ON m2.conversation_id = m1.conversation_id AND m2.user_id = ?
     WHERE m1.user_id = ? LIMIT 1`,
    [userB, userA]
  );
  return !!row;
}

// The call row for callId, provided `userId` and `peerId` are its two
// participants (in either direction).
async function getCallBetween(callId, userId, peerId) {
  if (!isString(callId) || !isString(peerId)) return null;
  return get(
    `SELECT * FROM calls WHERE id = ?
       AND ((caller_id = ? AND callee_id = ?) OR (caller_id = ? AND callee_id = ?))`,
    [callId, userId, peerId, peerId, userId]
  );
}

function emitToUser(userId, event, payload) {
  const sockets = onlineUsers.get(userId);
  if (!sockets) return;
  for (const sid of sockets) io.to(sid).emit(event, payload);
}

io.on('connection', (socket) => {
  const { userId } = socket;
  if (!onlineUsers.has(userId)) onlineUsers.set(userId, new Set());
  const wasOffline = onlineUsers.get(userId).size === 0;
  onlineUsers.get(userId).add(socket.id);
  if (wasOffline) setPresence(userId, true).catch((err) => console.error(err));

  // Per-socket flood protection: drop events beyond the window budget.
  let windowStart = Date.now();
  let eventCount = 0;
  socket.use((_packet, next) => {
    const now = Date.now();
    if (now - windowStart > EVENT_WINDOW_MS) {
      windowStart = now;
      eventCount = 0;
    }
    if (++eventCount > MAX_EVENTS_PER_WINDOW) return next(new Error('rate_limited'));
    next();
  });

  // Registers a socket event handler whose errors are logged (and reported
  // through the ack, if any) instead of becoming unhandled rejections.
  const on = (event, handler) => {
    socket.on(event, async (...args) => {
      const ack = typeof args[args.length - 1] === 'function' ? args[args.length - 1] : null;
      try {
        await handler(args[0] ?? {}, ack);
      } catch (err) {
        console.error(`socket ${event} failed:`, err);
        ack?.({ error: 'Внутренняя ошибка сервера' });
      }
    });
  };

  on('conversation:join', async (conversationId) => {
    if (await isMember(conversationId, userId)) socket.join(conversationId);
  });

  on('conversation:leave', (conversationId) => {
    if (isString(conversationId)) socket.leave(conversationId);
  });

  on('message:send', async (data, ack) => {
    const { conversationId, content, fileUrl, fileName, fileType, replyToId } = data;
    if (!(await isMember(conversationId, userId))) return ack?.({ error: 'Нет доступа к чату' });
    if (content != null && !isString(content)) return ack?.({ error: 'Некорректное сообщение' });
    const text = content?.trim() || '';
    if (text.length > MAX_CONTENT_LENGTH) return ack?.({ error: 'Сообщение слишком длинное' });
    if (fileUrl != null && !isValidFileUrl(fileUrl)) return ack?.({ error: 'Некорректный файл' });
    if (!text && !fileUrl) return ack?.({ error: 'Пустое сообщение' });

    let replyId = null;
    if (replyToId != null) {
      const target = isString(replyToId)
        ? await get('SELECT 1 FROM messages WHERE id = ? AND conversation_id = ?', [replyToId, conversationId])
        : null;
      if (!target) return ack?.({ error: 'Сообщение для ответа не найдено' });
      replyId = replyToId;
    }
    const safeFileName = isString(fileName) ? fileName.slice(0, MAX_NAME_LENGTH) : null;
    const safeFileType = isString(fileType) ? fileType.slice(0, MAX_NAME_LENGTH) : null;

    const id = nanoid();
    await run(
      `INSERT INTO messages (id, conversation_id, sender_id, content, file_url, file_name, file_type, reply_to_id)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      [id, conversationId, userId, text, fileUrl || null, safeFileName, safeFileType, replyId]
    );

    const sender = await get('SELECT display_name, avatar_color, avatar_url FROM users WHERE id = ?', [userId]);
    const message = {
      id,
      conversationId,
      senderId: userId,
      senderName: sender.display_name,
      senderColor: sender.avatar_color,
      senderAvatarUrl: sender.avatar_url || null,
      content: text,
      fileUrl: fileUrl || null,
      fileName: safeFileName,
      fileType: safeFileType,
      replyToId: replyId,
      editedAt: null,
      deleted: false,
      createdAt: Math.floor(Date.now() / 1000),
    };

    await broadcastToConversation(conversationId, 'message:new', message);
    ack?.({ message });
  });

  on('message:edit', async ({ messageId, content }, ack) => {
    if (!isString(messageId) || !isString(content)) return ack?.({ error: 'Некорректное сообщение' });
    const text = content.trim();
    if (!text || text.length > MAX_CONTENT_LENGTH) return ack?.({ error: 'Некорректный текст сообщения' });
    const msg = await get('SELECT * FROM messages WHERE id = ?', [messageId]);
    if (!msg || msg.sender_id !== userId || msg.deleted) {
      return ack?.({ error: 'Нельзя редактировать это сообщение' });
    }
    const editedAt = Math.floor(Date.now() / 1000);
    await run('UPDATE messages SET content = ?, edited_at = ? WHERE id = ?', [text, editedAt, messageId]);
    await broadcastToConversation(msg.conversation_id, 'message:updated', { id: messageId, content: text, editedAt });
    ack?.({ ok: true });
  });

  on('message:delete', async ({ messageId }, ack) => {
    const msg = isString(messageId) ? await get('SELECT * FROM messages WHERE id = ?', [messageId]) : null;
    if (!msg || msg.sender_id !== userId) return ack?.({ error: 'Нельзя удалить это сообщение' });
    await run("UPDATE messages SET deleted = 1, content = '', file_url = NULL WHERE id = ?", [messageId]);
    await broadcastToConversation(msg.conversation_id, 'message:deleted', { id: messageId });
    ack?.({ ok: true });
  });

  on('typing:start', async ({ conversationId }) => {
    if (!(await isMember(conversationId, userId))) return;
    const user = await get('SELECT display_name FROM users WHERE id = ?', [userId]);
    await broadcastToConversation(
      conversationId,
      'typing:update',
      { conversationId, userId, name: user.display_name, typing: true },
      socket.id
    );
  });

  on('typing:stop', async ({ conversationId }) => {
    if (!(await isMember(conversationId, userId))) return;
    await broadcastToConversation(conversationId, 'typing:update', { conversationId, userId, typing: false }, socket.id);
  });

  on('conversation:read', async ({ conversationId }) => {
    if (!(await isMember(conversationId, userId))) return;
    const now = Math.floor(Date.now() / 1000);
    await run('UPDATE conversation_members SET last_read_at = ? WHERE conversation_id = ? AND user_id = ?', [
      now,
      conversationId,
      userId,
    ]);
    await broadcastToConversation(conversationId, 'message:read', { conversationId, userId, readAt: now }, socket.id);
  });

  // The recipients come from the database, never from the client: only a
  // member can announce a conversation, and only to its other members.
  on('conversation:created', async ({ conversationId }) => {
    if (!(await isMember(conversationId, userId))) return;
    const conv = await get('SELECT * FROM conversations WHERE id = ?', [conversationId]);
    if (!conv) return;
    for (const uid of await getConversationMemberIds(conversationId)) {
      if (uid === userId || !onlineUsers.has(uid)) continue;
      emitToUser(uid, 'conversation:new', await serializeConversation(conv, uid));
    }
  });

  // WebRTC call signaling: the server never inspects SDP/ICE contents, it
  // just relays them to every active socket of the target user (mirroring
  // how message delivery already works via onlineUsers). The only state
  // persisted server-side is a call-log row (for the Calls history tab) -
  // clients still own the actual call lifecycle. Every call event is checked
  // against that row so only the two participants can drive a call.
  on('call:invite', async ({ conversationId, targetUserId, callId, kind, sdp, fromDisplayName, fromAvatarColor, fromAvatarUrl }) => {
    if (!isString(callId) || callId.length > 64 || !isString(targetUserId) || targetUserId === userId) return;
    if (!(await sharesConversation(userId, targetUserId))) return;
    if (conversationId != null && !((await isMember(conversationId, userId)) && (await isMember(conversationId, targetUserId)))) {
      return;
    }
    if (await get('SELECT 1 FROM calls WHERE id = ?', [callId])) return;

    const callKind = kind === 'video' ? 'video' : 'audio';
    const online = onlineUsers.has(targetUserId);
    await run(
      `INSERT INTO calls (id, caller_id, callee_id, conversation_id, kind, status, ended_at)
       VALUES (?, ?, ?, ?, ?, ?, ${online ? 'NULL' : "strftime('%s','now')"})`,
      [callId, userId, targetUserId, conversationId || null, callKind, online ? 'ringing' : 'missed']
    );
    if (!online) return;
    emitToUser(targetUserId, 'call:invite', {
      conversationId,
      callId,
      kind: callKind,
      sdp,
      fromUserId: userId,
      fromDisplayName,
      fromAvatarColor,
      fromAvatarUrl,
    });
  });

  on('call:answer', async ({ targetUserId, callId, sdp }) => {
    const call = await getCallBetween(callId, userId, targetUserId);
    if (!call || call.callee_id !== userId || call.ended_at) return;
    await run("UPDATE calls SET status = 'answered', answered_at = strftime('%s','now') WHERE id = ?", [callId]);
    emitToUser(targetUserId, 'call:answer', { callId, sdp, fromUserId: userId });
  });

  on('call:ice-candidate', async ({ targetUserId, callId, candidate }) => {
    const call = await getCallBetween(callId, userId, targetUserId);
    if (!call || call.ended_at) return;
    emitToUser(targetUserId, 'call:ice-candidate', { callId, candidate, fromUserId: userId });
  });

  on('call:reject', async ({ targetUserId, callId }) => {
    const call = await getCallBetween(callId, userId, targetUserId);
    if (!call) return;
    await run(
      "UPDATE calls SET status = 'declined', ended_at = strftime('%s','now') WHERE id = ? AND status = 'ringing'",
      [callId]
    );
    emitToUser(targetUserId, 'call:reject', { callId, fromUserId: userId });
  });

  on('call:end', async ({ targetUserId, callId }) => {
    const call = await getCallBetween(callId, userId, targetUserId);
    if (!call) return;
    await run(
      `UPDATE calls SET
         status = CASE WHEN status = 'ringing' THEN 'missed' ELSE status END,
         ended_at = strftime('%s','now')
       WHERE id = ? AND ended_at IS NULL`,
      [callId]
    );
    emitToUser(targetUserId, 'call:end', { callId, fromUserId: userId });
  });

  socket.on('disconnect', () => {
    const set = onlineUsers.get(userId);
    if (set) {
      set.delete(socket.id);
      if (set.size === 0) {
        onlineUsers.delete(userId);
        setPresence(userId, false).catch((err) => console.error(err));
      }
    }
  });
});

const PORT = process.env.PORT || 4000;
httpServer.listen(PORT, () => {
  console.log(`Messenger server running on http://localhost:${PORT}`);
});
