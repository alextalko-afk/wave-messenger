import { all } from './db/index.js';

// Every socket event fans out to a conversation's members, and the member list
// only changes when someone creates or leaves a chat, so keep it in memory for
// a short while instead of querying it per event. Leaving a chat invalidates
// the entry on this process; the TTL bounds staleness on any other.
const TTL_MS = 30_000;
const MAX_ENTRIES = 5000;
const cache = new Map(); // conversationId -> { ids, expires }

export async function getConversationMemberIds(conversationId) {
  const hit = cache.get(conversationId);
  if (hit && hit.expires > Date.now()) return hit.ids;
  const rows = await all('SELECT user_id FROM conversation_members WHERE conversation_id = ?', [conversationId]);
  const ids = rows.map((r) => r.user_id);
  if (cache.size >= MAX_ENTRIES) cache.clear();
  cache.set(conversationId, { ids, expires: Date.now() + TTL_MS });
  return ids;
}

export function invalidateConversationMembers(conversationId) {
  cache.delete(conversationId);
}
