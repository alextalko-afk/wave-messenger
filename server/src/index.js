import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';
import { createServer } from 'http';
import { Server } from 'socket.io';
import { nanoid } from 'nanoid';

import db from './db/index.js';
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
  app.use(express.static(clientDist));
  app.get(/^(?!\/api|\/uploads|\/socket\.io).*/, (req, res) => {
    res.sendFile(path.join(clientDist, 'index.html'));
  });
}

// -------- Socket.io realtime layer --------
const onlineUsers = new Map(); // userId -> Set(socketIds)
const typingState = new Map(); // conversationId -> Map(userId -> timeout)

function getConversationMemberIds(conversationId) {
  return db
    .prepare('SELECT user_id FROM conversation_members WHERE conversation_id = ?')
    .all(conversationId)
    .map((r) => r.user_id);
}

function broadcastToConversation(conversationId, event, payload, exceptSocketId = null) {
  const memberIds = getConversationMemberIds(conversationId);
  for (const uid of memberIds) {
    const sockets = onlineUsers.get(uid);
    if (!sockets) continue;
    for (const sid of sockets) {
      if (sid === exceptSocketId) continue;
      io.to(sid).emit(event, payload);
    }
  }
}

function setPresence(userId, online) {
  db.prepare('UPDATE users SET online = ?, last_seen = strftime(\'%s\',\'now\') WHERE id = ?').run(
    online ? 1 : 0,
    userId
  );
  const rows = db.prepare('SELECT conversation_id FROM conversation_members WHERE user_id = ?').all(userId);
  const user = db.prepare('SELECT last_seen FROM users WHERE id = ?').get(userId);
  for (const { conversation_id } of rows) {
    broadcastToConversation(conversation_id, 'presence:update', {
      userId,
      online,
      lastSeen: user.last_seen,
    });
  }
}

io.use((socket, next) => {
  const token = socket.handshake.auth?.token;
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

  socket.on('message:send', (data, ack) => {
    try {
      const { conversationId, content, fileUrl, fileName, fileType, replyToId } = data || {};
      const member = db
        .prepare('SELECT 1 FROM conversation_members WHERE conversation_id = ? AND user_id = ?')
        .get(conversationId, userId);
      if (!member) return ack?.({ error: 'Нет доступа к чату' });
      if (!content?.trim() && !fileUrl) return ack?.({ error: 'Пустое сообщение' });

      const id = nanoid();
      db.prepare(
        `INSERT INTO messages (id, conversation_id, sender_id, content, file_url, file_name, file_type, reply_to_id)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
      ).run(id, conversationId, userId, content?.trim() || '', fileUrl || null, fileName || null, fileType || null, replyToId || null);

      const sender = db.prepare('SELECT display_name, avatar_color FROM users WHERE id = ?').get(userId);
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

      broadcastToConversation(conversationId, 'message:new', message);
      ack?.({ message });
    } catch (err) {
      console.error(err);
      ack?.({ error: 'Ошибка отправки сообщения' });
    }
  });

  socket.on('message:edit', ({ messageId, content }, ack) => {
    const msg = db.prepare('SELECT * FROM messages WHERE id = ?').get(messageId);
    if (!msg || msg.sender_id !== userId) return ack?.({ error: 'Нельзя редактировать это сообщение' });
    const editedAt = Math.floor(Date.now() / 1000);
    db.prepare('UPDATE messages SET content = ?, edited_at = ? WHERE id = ?').run(content, editedAt, messageId);
    broadcastToConversation(msg.conversation_id, 'message:updated', { id: messageId, content, editedAt });
    ack?.({ ok: true });
  });

  socket.on('message:delete', ({ messageId }, ack) => {
    const msg = db.prepare('SELECT * FROM messages WHERE id = ?').get(messageId);
    if (!msg || msg.sender_id !== userId) return ack?.({ error: 'Нельзя удалить это сообщение' });
    db.prepare('UPDATE messages SET deleted = 1, content = \'\', file_url = NULL WHERE id = ?').run(messageId);
    broadcastToConversation(msg.conversation_id, 'message:deleted', { id: messageId });
    ack?.({ ok: true });
  });

  socket.on('typing:start', ({ conversationId }) => {
    const user = db.prepare('SELECT display_name FROM users WHERE id = ?').get(userId);
    broadcastToConversation(conversationId, 'typing:update', { conversationId, userId, name: user.display_name, typing: true }, socket.id);
  });

  socket.on('typing:stop', ({ conversationId }) => {
    broadcastToConversation(conversationId, 'typing:update', { conversationId, userId, typing: false }, socket.id);
  });

  socket.on('conversation:read', ({ conversationId }) => {
    const now = Math.floor(Date.now() / 1000);
    db.prepare('UPDATE conversation_members SET last_read_at = ? WHERE conversation_id = ? AND user_id = ?').run(
      now,
      conversationId,
      userId
    );
    broadcastToConversation(conversationId, 'message:read', { conversationId, userId, readAt: now }, socket.id);
  });

  socket.on('conversation:created', ({ conversationId, memberIds }) => {
    for (const uid of memberIds || []) {
      const sockets = onlineUsers.get(uid);
      if (!sockets) continue;
      const conv = db.prepare('SELECT * FROM conversations WHERE id = ?').get(conversationId);
      const payload = serializeConversation(conv, uid);
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
