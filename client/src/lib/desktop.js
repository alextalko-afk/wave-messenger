// Desktop niceties shared by the browser and the Electron shell: system
// notifications for messages that arrive while the window is in the background,
// an unread counter in the tab title / taskbar, and a click-to-open hook.
// `window.waveDesktop` only exists inside Electron (see desktop/preload.js).

const hasNotifications = typeof window !== 'undefined' && 'Notification' in window;

// Browsers only allow the permission prompt after a user gesture, so ask on the first click.
export function ensureNotificationPermission() {
  if (!hasNotifications || Notification.permission !== 'default') return;
  const ask = () => {
    window.removeEventListener('click', ask);
    Notification.requestPermission().catch(() => {});
  };
  window.addEventListener('click', ask, { once: true });
}

function previewText(msg) {
  if (msg.content) return msg.content;
  if (msg.fileType?.startsWith('audio/')) return 'Голосовое сообщение';
  if (msg.fileType?.startsWith('image/')) return 'Фотография';
  return 'Вложение';
}

export function notifyMessage({ conversation, message, onOpen }) {
  if (!hasNotifications || Notification.permission !== 'granted') return;
  if (document.hasFocus()) return; // the user is looking at the app
  const isGroup = !!conversation?.isGroup;
  const n = new Notification(isGroup ? conversation.name : message.senderName, {
    body: isGroup ? `${message.senderName}: ${previewText(message)}` : previewText(message),
    tag: message.conversationId, // a burst of messages from one chat replaces itself
    renotify: true,
    icon: '/icon-192.png',
  });
  n.onclick = () => {
    window.waveDesktop?.focus();
    window.focus();
    onOpen?.(message.conversationId);
    n.close();
  };
  window.waveDesktop?.attention();
}

const BASE_TITLE = 'Wave — мессенджер';

function badgeDataUrl(count) {
  const size = 32;
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d');
  ctx.fillStyle = '#e5484d';
  ctx.beginPath();
  ctx.arc(size / 2, size / 2, size / 2, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = '#ffffff';
  ctx.font = 'bold 20px sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(count > 99 ? '99+' : String(count), size / 2, size / 2 + 1);
  return canvas.toDataURL('image/png');
}

export function updateUnreadBadge(count) {
  document.title = count > 0 ? `(${count > 99 ? '99+' : count}) ${BASE_TITLE}` : BASE_TITLE;
  window.waveDesktop?.setBadge(count, count > 0 ? badgeDataUrl(count) : null);
}
