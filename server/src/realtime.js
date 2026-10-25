// REST routes sometimes have to tell connected clients that a chat changed
// (members added, removed, renamed). The socket layer lives in index.js, so it
// registers itself here and routes call announceConversationChange().
let announcer = null;

export function bindAnnouncer(fn) {
  announcer = fn;
}

/**
 * Push the new state of a conversation to everyone concerned:
 *  - current members get `conversation:updated` (`conversation:new` if they were just added),
 *  - users who are no longer in it get `conversation:removed`.
 */
export async function announceConversationChange(conversationId, { addedUserIds = [], removedUserIds = [] } = {}) {
  if (announcer) await announcer(conversationId, { addedUserIds, removedUserIds });
}
