import { all, get } from './db/index.js';

// One reaction per user per message; keep the set small and well-formed.
export const ALLOWED_REACTIONS = ['👍', '❤️', '😂', '😮', '😢', '🙏', '🔥', '👎'];

const REPLY_PREVIEW_LENGTH = 100;

export function replyPreview(content) {
  if (!content) return '';
  return content.length > REPLY_PREVIEW_LENGTH ? `${content.slice(0, REPLY_PREVIEW_LENGTH - 1)}…` : content;
}

/**
 * The chat's pinned message as the client shows it, or null when nothing is
 * pinned, the message was deleted, or it predates the viewer's "clear history".
 */
export async function getPinnedMessage(conversationId, clearedBefore = 0) {
  const row = await get(
    `SELECT m.id, m.content, m.file_type, m.file_name, m.created_at, u.display_name AS sender_name
     FROM conversations c
     JOIN messages m ON m.id = c.pinned_message_id AND m.conversation_id = c.id
     JOIN users u ON u.id = m.sender_id
     WHERE c.id = ? AND m.deleted = 0 AND m.created_at > ?`,
    [conversationId, clearedBefore]
  );
  if (!row) return null;
  return {
    id: row.id,
    content: replyPreview(row.content),
    senderName: row.sender_name,
    fileType: row.file_type,
    fileName: row.file_name,
    createdAt: row.created_at,
  };
}

/** The message JSON the client renders, from a row joined with its author and reply source. */
export function serializeMessage(m, reactions = []) {
  return {
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
    replyToSenderName: m.reply_sender_name || null,
    replyToContent: m.reply_deleted ? '' : replyPreview(m.reply_content),
    forwardedFrom: m.deleted ? null : m.forwarded_from || null,
    clientId: m.client_id || null,
    reactions: m.deleted ? [] : reactions,
    editedAt: m.edited_at,
    deleted: !!m.deleted,
    createdAt: m.created_at,
  };
}

export async function getMessageById(id) {
  const row = await get(
    `SELECT m.*, u.display_name AS sender_name, u.avatar_color AS sender_color, u.avatar_url AS sender_avatar_url,
            rm.content AS reply_content, rm.deleted AS reply_deleted, ru.display_name AS reply_sender_name
     FROM messages m
     JOIN users u ON u.id = m.sender_id
     LEFT JOIN messages rm ON rm.id = m.reply_to_id AND rm.conversation_id = m.conversation_id
     LEFT JOIN users ru ON ru.id = rm.sender_id
     WHERE m.id = ?`,
    [id]
  );
  if (!row) return null;
  return serializeMessage(row, (await getReactionsFor([id])).get(id));
}

function groupReactions(rows) {
  const byEmoji = new Map();
  for (const r of rows) {
    if (!byEmoji.has(r.emoji)) byEmoji.set(r.emoji, []);
    byEmoji.get(r.emoji).push(r.user_id);
  }
  return [...byEmoji].map(([emoji, userIds]) => ({ emoji, userIds }));
}

/** Map of messageId -> [{ emoji, userIds }] for the given message ids. */
export async function getReactionsFor(messageIds) {
  const result = new Map(messageIds.map((id) => [id, []]));
  if (messageIds.length === 0) return result;
  const rows = await all(
    `SELECT message_id, user_id, emoji FROM message_reactions
     WHERE message_id IN (${messageIds.map(() => '?').join(',')}) ORDER BY created_at, rowid`,
    messageIds
  );
  const perMessage = new Map();
  for (const r of rows) {
    if (!perMessage.has(r.message_id)) perMessage.set(r.message_id, []);
    perMessage.get(r.message_id).push(r);
  }
  for (const [id, list] of perMessage) result.set(id, groupReactions(list));
  return result;
}
