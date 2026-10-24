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
