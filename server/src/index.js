import 'dotenv/config';
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
import { uploadsDir } from './paths.js';

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

io.on('connection', (socket) => {
  const { userId } = socket;
  if (!onlineUsers.has(userId)) onlineUsers.set(userId, new Set());
  const wasOffline = onlineUsers.get(userId).size === 0;
  onlineUsers.get(userId).add(socket.id);
  if (wasOffline) setPresence(userId, true);

  socket.on('conversation:join', (conversationId) => {
    socket.join(conversationId);
  });

  socket.on('conversation:leave', (conversationId) => {
    socket.leave(conversationId);
  });

  socket.on('message:send', async (data, ack) => {
    try {
      const { conversationId, content, fileUrl, fileName, fileType, replyToId } = data || {};
      const member = await get('SELECT 1 FROM conversation_members WHERE conversation_id = ? AND user_id = ?', [
        conversationId,
        userId,
      ]);
      if (!member) return ack?.({ error: 'Нет доступа к чату' });
      if (!content?.trim() && !fileUrl) return ack?.({ error: 'Пустое сообщение' });

      const id = nanoid();
      await run(
        `INSERT INTO messages (id, conversation_id, sender_id, content, file_url, file_name, file_type, reply_to_id)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
        [id, conversationId, userId, content?.trim() || '', fileUrl || null, fileName || null, fileType || null, replyToId || null]
      );

      const sender = await get('SELECT display_name, avatar_color FROM users WHERE id = ?', [userId]);
      const message = {
        id,
        conversationId,
        senderId: userId,
        senderName: sender.display_name,
        senderColor: sender.avatar_color,
        content: content?.trim() || '',
        fileUrl: fileUrl || null,
        fileName: fileName || null,
        fileType: fileType || null,
        replyToId: replyToId || null,
        editedAt: null,
        deleted: false,
        createdAt: Math.floor(Date.now() / 1000),
      };

      await broadcastToConversation(conversationId, 'message:new', message);
      ack?.({ message });
    } catch (err) {
      console.error(err);
      ack?.({ error: 'Ошибка отправки сообщения' });
    }
  });

  socket.on('message:edit', async ({ messageId, content }, ack) => {
    const msg = await get('SELECT * FROM messages WHERE id = ?', [messageId]);
    if (!msg || msg.sender_id !== userId) return ack?.({ error: 'Нельзя редактировать это сообщение' });
    const editedAt = Math.floor(Date.now() / 1000);
    await run('UPDATE messages SET content = ?, edited_at = ? WHERE id = ?', [content, editedAt, messageId]);
    await broadcastToConversation(msg.conversation_id, 'message:updated', { id: messageId, content, editedAt });
    ack?.({ ok: true });
  });

  socket.on('message:delete', async ({ messageId }, ack) => {
    const msg = await get('SELECT * FROM messages WHERE id = ?', [messageId]);
    if (!msg || msg.sender_id !== userId) return ack?.({ error: 'Нельзя удалить это сообщение' });
    await run("UPDATE messages SET deleted = 1, content = '', file_url = NULL WHERE id = ?", [messageId]);
    await broadcastToConversation(msg.conversation_id, 'message:deleted', { id: messageId });
    ack?.({ ok: true });
  });

  socket.on('typing:start', async ({ conversationId }) => {
    const user = await get('SELECT display_name FROM users WHERE id = ?', [userId]);
    await broadcastToConversation(
      conversationId,
      'typing:update',
      { conversationId, userId, name: user.display_name, typing: true },
      socket.id
    );
  });

  socket.on('typing:stop', async ({ conversationId }) => {
    await broadcastToConversation(conversationId, 'typing:update', { conversationId, userId, typing: false }, socket.id);
  });

  socket.on('conversation:read', async ({ conversationId }) => {
    const now = Math.floor(Date.now() / 1000);
    await run('UPDATE conversation_members SET last_read_at = ? WHERE conversation_id = ? AND user_id = ?', [
      now,
      conversationId,
      userId,
    ]);
    await broadcastToConversation(conversationId, 'message:read', { conversationId, userId, readAt: now }, socket.id);
  });

  socket.on('conversation:created', async ({ conversationId, memberIds }) => {
    for (const uid of memberIds || []) {
      const sockets = onlineUsers.get(uid);
      if (!sockets) continue;
      const conv = await get('SELECT * FROM conversations WHERE id = ?', [conversationId]);
      const payload = await serializeConversation(conv, uid);
      for (const sid of sockets) io.to(sid).emit('conversation:new', payload);
    }
  });

  socket.on('disconnect', () => {
    const set = onlineUsers.get(userId);
    if (set) {
      set.delete(socket.id);
      if (set.size === 0) {
        onlineUsers.delete(userId);
        setPresence(userId, false);
      }
    }
  });
});

const PORT = process.env.PORT || 4000;
httpServer.listen(PORT, () => {
  console.log(`Messenger server running on http://localhost:${PORT}`);
});
