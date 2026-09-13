import { useEffect, useState } from 'react';
import { App as CapacitorApp } from '@capacitor/app';
import { api } from '../lib/api.js';
import { useSocket } from '../context/SocketContext.jsx';
import Sidebar from '../components/Sidebar.jsx';
import ChatWindow from '../components/ChatWindow.jsx';
import NewChatModal from '../components/NewChatModal.jsx';
import { IconChatLogo } from '../components/Icons.jsx';

function sortConversations(list) {
  return [...list].sort((a, b) => {
    if (!!a.pinned !== !!b.pinned) return a.pinned ? -1 : 1;
    return (b.lastMessage?.createdAt || b.createdAt) - (a.lastMessage?.createdAt || a.createdAt);
  });
}

export default function ChatPage() {
  const socket = useSocket();
  const [conversations, setConversations] = useState([]);
  const [activeId, setActiveId] = useState(null);
  const [modalMode, setModalMode] = useState(null);
  const [showChatOnMobile, setShowChatOnMobile] = useState(false);

  useEffect(() => {
    api.getConversations().then((r) => setConversations(r.conversations));
  }, []);

  useEffect(() => {
    let handle;
    CapacitorApp.addListener('backButton', () => {
      if (showChatOnMobile) setShowChatOnMobile(false);
      else CapacitorApp.exitApp();
    }).then((h) => (handle = h));
    return () => handle?.remove();
  }, [showChatOnMobile]);

  useEffect(() => {
    if (!socket) return;
    function onNewConversation(conv) {
      setConversations((prev) => (prev.some((c) => c.id === conv.id) ? prev : sortConversations([conv, ...prev])));
    }
    function onNewMessage(msg) {
      setConversations((prev) => {
        const idx = prev.findIndex((c) => c.id === msg.conversationId);
        if (idx === -1) return prev;
        const next = [...prev];
        next[idx] = {
          ...next[idx],
          lastMessage: {
            id: msg.id,
            content: msg.content,
            senderId: msg.senderId,
            senderName: msg.senderName,
            fileType: msg.fileType,
            createdAt: msg.createdAt,
          },
          unreadCount: msg.conversationId === activeId ? 0 : next[idx].unreadCount + 1,
        };
        return sortConversations(next);
      });
    }
    function onPresence({ userId, online, lastSeen }) {
      setConversations((prev) =>
        prev.map((c) =>
          c.otherUser?.id === userId
            ? { ...c, otherUser: { ...c.otherUser, online, lastSeen } }
            : c
        )
      );
    }
    function onMessageRead({ conversationId, userId, readAt }) {
      setConversations((prev) =>
        prev.map((c) =>
          c.id === conversationId && c.otherUser?.id === userId
            ? { ...c, otherUser: { ...c.otherUser, lastReadAt: readAt } }
            : c
        )
      );
    }
    socket.on('conversation:new', onNewConversation);
    socket.on('message:new', onNewMessage);
    socket.on('presence:update', onPresence);
    socket.on('message:read', onMessageRead);
    return () => {
      socket.off('conversation:new', onNewConversation);
      socket.off('message:new', onNewMessage);
      socket.off('presence:update', onPresence);
      socket.off('message:read', onMessageRead);
    };
  }, [socket, activeId]);

  function handleSelect(id) {
    setActiveId(id);
    setShowChatOnMobile(true);
  }

  function handleCreated(conv) {
    setConversations((prev) => (prev.some((c) => c.id === conv.id) ? prev : sortConversations([conv, ...prev])));
    setModalMode(null);
    handleSelect(conv.id);
    socket?.emit('conversation:created', {
      conversationId: conv.id,
      memberIds: conv.members.map((m) => m.id),
    });
  }

  function handleConversationUpdate(id, patch) {
    setConversations((prev) => sortConversations(prev.map((c) => (c.id === id ? { ...c, ...patch } : c))));
  }

  async function handleConversationAction(action, conv) {
    if (action === 'pin') {
      const pinned = !conv.pinned;
      handleConversationUpdate(conv.id, { pinned });
      await api.pinConversation(conv.id, pinned);
    } else if (action === 'mute') {
      const muted = !conv.muted;
      handleConversationUpdate(conv.id, { muted });
      await api.muteConversation(conv.id, muted);
    } else if (action === 'toggleRead') {
      if (conv.unreadCount > 0) {
        handleConversationUpdate(conv.id, { unreadCount: 0 });
        await api.markRead(conv.id);
      } else {
        handleConversationUpdate(conv.id, { unreadCount: 1 });
        await api.markUnread(conv.id, true);
      }
    } else if (action === 'clear') {
      if (!window.confirm(`Очистить историю чата «${conv.name}»? Это действие необратимо.`)) return;
      await api.clearHistory(conv.id);
      handleConversationUpdate(conv.id, {
        lastMessage: null,
        unreadCount: 0,
        clearVersion: (conv.clearVersion || 0) + 1,
      });
    } else if (action === 'delete') {
      if (!window.confirm(`Удалить чат «${conv.name}»?`)) return;
      await api.deleteConversation(conv.id);
      setConversations((prev) => prev.filter((c) => c.id !== conv.id));
      if (activeId === conv.id) {
        setActiveId(null);
        setShowChatOnMobile(false);
      }
    }
  }

  const active = conversations.find((c) => c.id === activeId);

  return (
    <div className="h-screen w-screen flex overflow-hidden bg-bg text-text">
      <div
        className={`${showChatOnMobile ? 'hidden sm:flex' : 'flex'} w-full sm:w-auto border-r`}
        style={{ borderColor: 'var(--border)' }}
      >
        <Sidebar
          conversations={conversations}
          activeId={activeId}
          onSelect={handleSelect}
          onNewChat={(mode) => setModalMode(mode || 'direct')}
          onAction={handleConversationAction}
        />
      </div>

      <div className={`${showChatOnMobile ? 'flex' : 'hidden sm:flex'} flex-1`}>
        {active ? (
          <ChatWindow
            key={`${active.id}:${active.clearVersion || 0}`}
            conversation={active}
            onBack={() => setShowChatOnMobile(false)}
            onConversationUpdate={handleConversationUpdate}
            onOpenConversation={handleSelect}
            onConversationAction={handleConversationAction}
          />
        ) : (
          <div className="flex-1 hidden sm:flex flex-col items-center justify-center text-muted chat-bg gap-3">
            <IconChatLogo size={64} className="opacity-30" />
            <div className="text-sm">Выберите чат или начните новый</div>
          </div>
        )}
      </div>

      {modalMode && (
        <NewChatModal initialMode={modalMode} onClose={() => setModalMode(null)} onCreated={handleCreated} />
      )}
    </div>
  );
}
