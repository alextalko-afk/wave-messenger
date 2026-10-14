import { createContext, useContext, useEffect, useRef, useState } from 'react';
import { io } from 'socket.io-client';
import { App as CapacitorApp } from '@capacitor/app';
import { getToken } from '../lib/api.js';
import { useAuth } from './AuthContext.jsx';

const SocketContext = createContext(null);

export function SocketProvider({ children }) {
  const { user } = useAuth();
  const [socket, setSocket] = useState(null);
  const socketRef = useRef(null);

  useEffect(() => {
    if (!user) {
      socketRef.current?.disconnect();
      socketRef.current = null;
      setSocket(null);
      return;
    }
    const s = io('/', { auth: { token: getToken() }, transports: ['websocket', 'polling'] });
    socketRef.current = s;
    setSocket(s);

    // Tell the server whether we are in the foreground: a backgrounded phone
    // app keeps its socket open, but should still receive push notifications.
    const reportVisibility = (visible) => {
      if (s.connected) s.emit('app:visibility', { visible });
    };
    const onVisibilityChange = () => reportVisibility(!document.hidden);
    s.on('connect', onVisibilityChange);
    document.addEventListener('visibilitychange', onVisibilityChange);
    let appStateHandle;
    CapacitorApp.addListener('appStateChange', ({ isActive }) => reportVisibility(isActive)).then(
      (h) => (appStateHandle = h),
      () => {}
    );

    return () => {
      document.removeEventListener('visibilitychange', onVisibilityChange);
      appStateHandle?.remove();
      s.disconnect();
    };
  }, [user?.id]);

  return <SocketContext.Provider value={socket}>{children}</SocketContext.Provider>;
}

export const useSocket = () => useContext(SocketContext);
