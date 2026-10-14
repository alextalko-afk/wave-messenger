import { all } from './db/index.js';

// One reaction per user per message; keep the set small and well-formed.
export const ALLOWED_REACTIONS = ['👍', '❤️', '😂', '😮', '😢', '🙏', '🔥', '👎'];

const REPLY_PREVIEW_LENGTH = 100;

export function replyPreview(content) {
  if (!content) return '';
  return content.length > REPLY_PREVIEW_LENGTH ? `${content.slice(0, REPLY_PREVIEW_LENGTH - 1)}…` : content;
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
