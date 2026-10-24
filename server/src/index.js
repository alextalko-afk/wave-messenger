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
import helmet from 'helmet';

import { get, all, run, searchKey, backfillSearchColumns } from './db/index.js';
import { verifySocketToken, onTokensRevoked } from './middleware/auth.js';
import { apiLimiter } from './limiters.js';
import { startUploadCleanup } from './uploadCleanup.js';
import authRoutes from './routes/auth.js';
import userRoutes from './routes/users.js';
import conversationRoutes, { serializeConversation } from './routes/conversations.js';
import uploadRoutes from './routes/upload.js';
import callsRoutes from './routes/calls.js';
import pushRoutes from './routes/push.js';
import searchRoutes from './routes/search.js';
import { sendPush, previewText } from './push.js';
import { ALLOWED_REACTIONS, getReactionsFor, replyPreview } from './messages.js';
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

// CLIENT_ORIGIN may list several origins, comma-separated. Authentication uses
// bearer tokens rather than cookies, so a wildcard cannot be used for CSRF, but
// it still should not stay open in production.
const clientOrigins = (process.env.CLIENT_ORIGIN || '')
  .split(',')
  .map((o) => o.trim())
  .filter(Boolean);
const corsOrigin = clientOrigins.length === 0 ? '*' : clientOrigins.length === 1 ? clientOrigins[0] : clientOrigins;
if (process.env.NODE_ENV === 'production' && clientOrigins.length === 0) {
  console.warn('CLIENT_ORIGIN is not set - allowing cross-origin requests from any origin');
}

// Behind a reverse proxy (Fly.io, nginx) req.ip is the proxy unless told how
// many hops to trust, which would put every user in one rate-limit bucket.
const trustProxy = process.env.TRUST_PROXY ?? (process.env.NODE_ENV === 'production' ? '1' : '');
if (trustProxy) app.set('trust proxy', /^\d+$/.test(trustProxy) ? Number(trustProxy) : trustProxy);
app.disable('x-powered-by');

const io = new Server(httpServer, {
  cors: { origin: corsOrigin },
  // Chat messages, call signalling and SDP are small; nothing legitimate
  // needs the 1 MB default.
  maxHttpBufferSize: 256 * 1024,
});

app.use(
  helmet({
    // The CSP is report-only until it has been checked against every client
    // (web, Capacitor, desktop); violations show up in the browser console.
    contentSecurityPolicy: {
      reportOnly: true,
      directives: {
        defaultSrc: ["'self'"],
        scriptSrc: ["'self'", 'https://accounts.google.com'],
        styleSrc: ["'self'", "'unsafe-inline'", 'https://fonts.googleapis.com', 'https://accounts.google.com'],
        fontSrc: ["'self'", 'data:', 'https://fonts.gstatic.com'],
        imgSrc: ["'self'", 'data:', 'blob:', 'https:'],
        mediaSrc: ["'self'", 'blob:', 'https:'],
        connectSrc: ["'self'", 'ws:', 'wss:', 'https://accounts.google.com'],
        frameSrc: ['https://accounts.google.com'],
        objectSrc: ["'none'"],
        baseUri: ["'self'"],
        formAction: ["'self'"],
        frameAncestors: ["'self'"],
      },
    },
    // Uploads and the API are fetched cross-origin by the native apps and the
    // desktop shell, and Google sign-in relies on a popup that keeps its opener.
    crossOriginResourcePolicy: { policy: 'cross-origin' },
    crossOriginOpenerPolicy: false,
  })
);
app.use(cors({ origin: corsOrigin }));
app.use(express.json({ limit: '100kb' }));
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

// Registered before the limiter so platform health checks are never throttled.
app.get('/api/health', (req, res) => res.json({ ok: true }));

app.use('/api', apiLimiter);
app.use('/api/auth', authRoutes);
app.use('/api/users', userRoutes);
app.use('/api/conversations', conversationRoutes);
app.use('/api/upload', uploadRoutes);
app.use('/api/calls', callsRoutes);
app.use('/api/push', pushRoutes);
app.use('/api/search', searchRoutes);

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
  if (err.type === 'entity.too.large') return res.status(413).json({ error: 'Запрос слишком большой' });
  if (err.code === 'LIMIT_FILE_SIZE') return res.status(413).json({ error: 'Файл слишком большой' });
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

// Delivery = the message reached an online device of the recipient. Stored per
// member as last_delivered_at (same second-resolution timeline as
// last_read_at) and pushed to the other members so senders can show ticks.
async function markDelivered(conversationId, userIds, deliveredAt, exceptSocketId = null) {
  if (userIds.length === 0) return;
  const placeholders = userIds.map(() => '?').join(',');
  await run(
    `UPDATE conversation_members SET last_delivered_at = ?
     WHERE conversation_id = ? AND user_id IN (${placeholders}) AND last_delivered_at < ?`,
    [deliveredAt, conversationId, ...userIds, deliveredAt]
  );
  for (const uid of userIds) {
    await broadcastToConversation(
      conversationId,
      'message:delivered',
      { conversationId, userId: uid, deliveredAt },
      exceptSocketId
    );
  }
}

// A user who just came online has, by definition, received everything sent
// to them while they were away.
async function markAllDelivered(userId, socketId) {
  const now = Math.floor(Date.now() / 1000);
  const rows = await all('SELECT conversation_id FROM conversation_members WHERE user_id = ?', [userId]);
  for (const { conversation_id } of rows) {
    await markDelivered(conversation_id, [userId], now, socketId);
  }
}

io.use(async (socket, next) => {
  // socket.io-client-swift (the iOS native client) has no support for the
  // v3+ `auth` handshake payload, only query params - accept either so
  // that client can authenticate the same way Android/web already do.
  const token = socket.handshake.auth?.token || socket.handshake.query?.token;
  const auth = typeof token === 'string' && token ? await verifySocketToken(token) : null;
  if (!auth) return next(new Error('unauthorized'));
  socket.userId = auth.userId;
  socket.data.tokenVersion = auth.version;
  next();
});

// When a user's tokens are revoked (password change, "sign out everywhere"),
// close every socket that connected with an older token.
onTokensRevoked((userId, version) => {
  for (const sid of onlineUsers.get(userId) ?? []) {
    const s = io.sockets.sockets.get(sid);
    if (s && s.data.tokenVersion !== version) {
      s.emit('auth:revoked');
      s.disconnect(true);
    }
  }
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

// A user needs a push when none of their connected sockets is in the
// foreground: a backgrounded phone app keeps its socket open for a while, and
// that must not suppress notifications.
function isUserActive(userId) {
  const sockets = onlineUsers.get(userId);
  if (!sockets) return false;
  for (const sid of sockets) {
    if (io.sockets.sockets.get(sid)?.data.visible !== false) return true;
  }
  return false;
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
  if (wasOffline) {
    setPresence(userId, true).catch((err) => console.error(err));
    markAllDelivered(userId, socket.id).catch((err) => console.error(err));
  }

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

  on('app:visibility', ({ visible }) => {
    socket.data.visible = visible !== false;
  });

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
    let reply = null;
    if (replyToId != null) {
      reply = isString(replyToId)
        ? await get(
            `SELECT m.content, m.deleted, u.display_name AS sender_name FROM messages m
             JOIN users u ON u.id = m.sender_id WHERE m.id = ? AND m.conversation_id = ?`,
            [replyToId, conversationId]
          )
        : null;
      if (!reply) return ack?.({ error: 'Сообщение для ответа не найдено' });
      replyId = replyToId;
    }
    const safeFileName = isString(fileName) ? fileName.slice(0, MAX_NAME_LENGTH) : null;
    const safeFileType = isString(fileType) ? fileType.slice(0, MAX_NAME_LENGTH) : null;

    const id = nanoid();
    await run(
      `INSERT INTO messages (id, conversation_id, sender_id, content, content_search, file_url, file_name, file_type, reply_to_id)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [id, conversationId, userId, text, searchKey(text), fileUrl || null, safeFileName, safeFileType, replyId]
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
      replyToSenderName: reply?.sender_name || null,
      replyToContent: reply && !reply.deleted ? replyPreview(reply.content) : '',
      reactions: [],
      editedAt: null,
      deleted: false,
      createdAt: Math.floor(Date.now() / 1000),
    };

    await broadcastToConversation(conversationId, 'message:new', message);
    ack?.({ message });

    // Past this point the message is sent; delivery marks and push are
    // best-effort and must not turn a successful send into an error.
    try {
      const recipients = await all(
        'SELECT user_id, muted FROM conversation_members WHERE conversation_id = ? AND user_id != ?',
        [conversationId, userId]
      );
      const online = recipients.filter((r) => onlineUsers.has(r.user_id)).map((r) => r.user_id);
      await markDelivered(conversationId, online, message.createdAt);

      const offlineToNotify = recipients.filter((r) => !isUserActive(r.user_id) && !r.muted).map((r) => r.user_id);
      if (offlineToNotify.length > 0) {
        const conv = await get('SELECT is_group, name FROM conversations WHERE id = ?', [conversationId]);
        sendPush(offlineToNotify, {
          title: conv?.is_group ? conv.name || 'Группа' : message.senderName,
          body: conv?.is_group ? `${message.senderName}: ${previewText(message)}` : previewText(message),
          data: { conversationId, messageId: id },
        });
      }
    } catch (err) {
      console.error('post-send delivery/push failed:', err);
    }
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
    await run('UPDATE messages SET content = ?, content_search = ?, edited_at = ? WHERE id = ?', [
      text,
      searchKey(text),
      editedAt,
      messageId,
    ]);
    await broadcastToConversation(msg.conversation_id, 'message:updated', { id: messageId, content: text, editedAt });
    ack?.({ ok: true });
  });

  // One reaction per user per message: sending the emoji you already have
  // removes it, a different emoji replaces it.
  on('message:react', async ({ messageId, emoji }, ack) => {
    if (!isString(messageId) || !ALLOWED_REACTIONS.includes(emoji)) return ack?.({ error: 'Некорректная реакция' });
    const msg = await get('SELECT conversation_id, deleted FROM messages WHERE id = ?', [messageId]);
    if (!msg || msg.deleted || !(await isMember(msg.conversation_id, userId))) {
      return ack?.({ error: 'Нельзя отреагировать на это сообщение' });
    }
    const existing = await get('SELECT emoji FROM message_reactions WHERE message_id = ? AND user_id = ?', [
      messageId,
      userId,
    ]);
    if (existing?.emoji === emoji) {
      await run('DELETE FROM message_reactions WHERE message_id = ? AND user_id = ?', [messageId, userId]);
    } else {
      await run(
        `INSERT INTO message_reactions (message_id, user_id, emoji) VALUES (?, ?, ?)
         ON CONFLICT(message_id, user_id) DO UPDATE SET emoji = excluded.emoji, created_at = strftime('%s','now')`,
        [messageId, userId, emoji]
      );
    }
    const reactions = (await getReactionsFor([messageId])).get(messageId);
    await broadcastToConversation(msg.conversation_id, 'message:reactions', {
      id: messageId,
      conversationId: msg.conversation_id,
      reactions,
    });
    ack?.({ ok: true, reactions });
  });

  on('message:delete', async ({ messageId }, ack) => {
    const msg = isString(messageId) ? await get('SELECT * FROM messages WHERE id = ?', [messageId]) : null;
    if (!msg || msg.sender_id !== userId) return ack?.({ error: 'Нельзя удалить это сообщение' });
    await run("UPDATE messages SET deleted = 1, content = '', content_search = '', file_url = NULL WHERE id = ?", [messageId]);
    await run('DELETE FROM message_reactions WHERE message_id = ?', [messageId]);
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
    await run(
      'UPDATE conversation_members SET last_read_at = ?, last_delivered_at = MAX(last_delivered_at, ?) WHERE conversation_id = ? AND user_id = ?',
      [now, now, conversationId, userId]
    );
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
  backfillSearchColumns().catch((err) => console.error('search backfill failed:', err));
  startUploadCleanup();
});
