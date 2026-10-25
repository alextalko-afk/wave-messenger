import { useEffect, useState } from 'react';

// Unsent message text, kept per chat in localStorage so it survives switching
// chats and restarting the app.
const PREFIX = 'wave.draft.';
const EVENT = 'wave:drafts';
const MAX_LENGTH = 4000;

export function getDraft(conversationId) {
  try {
    return localStorage.getItem(PREFIX + conversationId) || '';
  } catch {
    return '';
  }
}

export function setDraft(conversationId, text) {
  try {
    if (text.trim()) localStorage.setItem(PREFIX + conversationId, text.slice(0, MAX_LENGTH));
    else localStorage.removeItem(PREFIX + conversationId);
  } catch {
    /* storage unavailable: the draft just isn't kept */
  }
  window.dispatchEvent(new Event(EVENT));
}

// Re-renders the caller whenever any draft changes.
export function useDraftsVersion() {
  const [version, setVersion] = useState(0);
  useEffect(() => {
    const bump = () => setVersion((v) => v + 1);
    window.addEventListener(EVENT, bump);
    return () => window.removeEventListener(EVENT, bump);
  }, []);
  return version;
}
