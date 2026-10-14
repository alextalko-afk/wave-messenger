import { GoogleAuth } from 'google-auth-library';
import { all, run } from './db/index.js';

// Push notifications go out through FCM HTTP v1 (Android directly, iOS via
// APNs relayed by Firebase). Configure with FIREBASE_SERVICE_ACCOUNT: the
// service-account JSON, either raw or base64-encoded. Without it push is a
// silent no-op, so local development needs no Firebase project.
function loadCredentials() {
  const raw = process.env.FIREBASE_SERVICE_ACCOUNT;
  if (!raw) return null;
  try {
    const json = raw.trim().startsWith('{') ? raw : Buffer.from(raw, 'base64').toString('utf8');
    const credentials = JSON.parse(json);
    if (!credentials.project_id || !credentials.client_email || !credentials.private_key) throw new Error('incomplete');
    return credentials;
  } catch {
    console.error('FIREBASE_SERVICE_ACCOUNT is set but is not a valid service-account JSON - push disabled');
    return null;
  }
}

const credentials = loadCredentials();
const auth = credentials
  ? new GoogleAuth({ credentials, scopes: ['https://www.googleapis.com/auth/firebase.messaging'] })
  : null;

export const pushEnabled = !!auth;

const INVALID_TOKEN_STATUSES = new Set(['UNREGISTERED', 'INVALID_ARGUMENT', 'NOT_FOUND']);

async function sendToToken(accessToken, token, { title, body, data }) {
  const res = await fetch(`https://fcm.googleapis.com/v1/projects/${credentials.project_id}/messages:send`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${accessToken}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      message: {
        token,
        notification: { title, body },
        data,
        android: {
          priority: 'HIGH',
          notification: { channel_id: 'messages', tag: data.conversationId },
        },
        apns: {
          headers: { 'apns-collapse-id': data.conversationId },
          payload: { aps: { sound: 'default', 'thread-id': data.conversationId } },
        },
      },
    }),
  });
  if (res.ok) return true;
  const err = await res.json().catch(() => ({}));
  const status = err?.error?.status;
  // A token that FCM no longer recognises will never work again - drop it.
  if (INVALID_TOKEN_STATUSES.has(status) || res.status === 404) {
    await run('DELETE FROM push_tokens WHERE token = ?', [token]);
  } else {
    console.error('FCM send failed:', res.status, err?.error?.message || status);
  }
  return false;
}

/**
 * Sends a notification to every registered device of the given users.
 * Never throws: push is best-effort and must not break message delivery.
 */
export async function sendPush(userIds, notification) {
  if (!auth || userIds.length === 0) return;
  try {
    const placeholders = userIds.map(() => '?').join(',');
    const rows = await all(`SELECT token FROM push_tokens WHERE user_id IN (${placeholders})`, userIds);
    if (rows.length === 0) return;
    const accessToken = await auth.getAccessToken();
    await Promise.all(rows.map((r) => sendToToken(accessToken, r.token, notification)));
  } catch (err) {
    console.error('push failed:', err?.message || err);
  }
}

export function previewText(message) {
  if (message.content) return message.content.length > 140 ? `${message.content.slice(0, 137)}...` : message.content;
  const type = message.fileType || '';
  if (type.startsWith('image/')) return '📷 Фото';
  if (type.startsWith('audio/')) return '🎤 Голосовое сообщение';
  if (type.startsWith('video/')) return '🎬 Видео';
  return '📎 Файл';
}
