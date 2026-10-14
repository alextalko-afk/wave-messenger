import { Capacitor } from '@capacitor/core';
import { api } from './api.js';

// Push notifications only exist in the native (Capacitor) apps; on the web
// every function here is a no-op.
let currentToken = null;
let listenersAttached = false;
let onOpenConversation = null;

export async function initPush({ onOpen }) {
  onOpenConversation = onOpen;
  if (!Capacitor.isNativePlatform()) return;

  const { PushNotifications } = await import('@capacitor/push-notifications');

  if (!listenersAttached) {
    listenersAttached = true;
    await PushNotifications.addListener('registration', ({ value }) => {
      currentToken = value;
      api.pushRegister(value, Capacitor.getPlatform()).catch(() => {});
    });
    await PushNotifications.addListener('registrationError', (err) => {
      console.warn('Push registration failed:', err);
    });
    // Tapping a notification opens the chat it came from.
    await PushNotifications.addListener('pushNotificationActionPerformed', ({ notification }) => {
      const conversationId = notification?.data?.conversationId;
      if (conversationId) onOpenConversation?.(conversationId);
    });
  }

  if (Capacitor.getPlatform() === 'android') {
    // Must match android.notification.channel_id sent by the server.
    await PushNotifications.createChannel({ id: 'messages', name: 'Сообщения', importance: 4, visibility: 1 });
  }

  let permission = await PushNotifications.checkPermissions();
  if (permission.receive === 'prompt' || permission.receive === 'prompt-with-rationale') {
    permission = await PushNotifications.requestPermissions();
  }
  if (permission.receive !== 'granted') return;

  await PushNotifications.register();
}

// Called on logout *before* the auth token is cleared, so the request is
// still authenticated; the device stops receiving this account's messages.
export function removePushToken() {
  const token = currentToken;
  currentToken = null;
  if (!token) return;
  api.pushUnregister(token).catch(() => {});
}
