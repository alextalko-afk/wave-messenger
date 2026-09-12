import { useEffect, useRef, useState } from 'react';
import { api } from '../lib/api.js';
import { useAuth } from '../context/AuthContext.jsx';
import { useSocket } from '../context/SocketContext.jsx';
import Avatar from './Avatar.jsx';
import MessageBubble from './MessageBubble.jsx';
import ProfileInfoPanel from './ProfileInfoPanel.jsx';
import EmojiPopover from './EmojiPopover.jsx';
import { formatDayLabel, formatLastSeen } from '../lib/format.js';
import { IconBack, IconPaperclip, IconSend, IconMic, IconTrash, IconCheck, IconChatLogo, IconSmile, IconSticker, IconFile, IconClose } from './Icons.jsx';

function formatClock(sec) {
  const m = Math.floor(sec / 60);
  const s = Math.floor(sec % 60);
  return `${m}:${String(s).padStart(2, '0')}`;
}

export default function ChatWindow({ conversation, onBack, onConversationUpdate, onOpenConversation, onConversationAction }) {
  const { user } = useAuth();
  const socket = useSocket();
  const [messages, setMessages] = useState([]);
  const [text, setText] = useState('');
  const [loading, setLoading] = useState(true);
  const [typingUsers, setTypingUsers] = useState({});
  const [uploading, setUploading] = useState(false);
  const [otherReadAt, setOtherReadAt] = useState(conversation.otherUser?.lastReadAt || 0);
  const [isRecording, setIsRecording] = useState(false);
  const [recordSeconds, setRecordSeconds] = useState(0);
  const [infoOpen, setInfoOpen] = useState(false);
  const [emojiPickerMode, setEmojiPickerMode] = useState(null); // null | 'emoji' | 'sticker'
  const [pendingFile, setPendingFile] = useState(null); // { file, previewUrl, isImage }
  const [caption, setCaption] = useState('');
  const bottomRef = useRef(null);
  const fileInputRef = useRef(null);
  const typingTimeoutRef = useRef(null);
  const textareaRef = useRef(null);
  const mediaRecorderRef = useRef(null);
  const chunksRef = useRef([]);
  const streamRef = useRef(null);
  const recordTimerRef = useRef(null);

  useEffect(() => {
    setLoading(true);
    setMessages([]);
    setOtherReadAt(conversation.otherUser?.lastReadAt || 0);
    api.getMessages(conversation.id).then((r) => {
      setMessages(r.messages);
      setLoading(false);
    });
    socket?.emit('conversation:join', conversation.id);
    socket?.emit('conversation:read', { conversationId: conversation.id });
    api.markRead(conversation.id).then(() => onConversationUpdate?.(conversation.id, { unreadCount: 0 }));

    return () => {
      socket?.emit('conversation:leave', conversation.id);
    };
  }, [conversation.id, socket]);

  useEffect(() => {
    if (!socket) return;
    function onNew(msg) {
      if (msg.conversationId !== conversation.id) return;
      setMessages((prev) => [...prev, msg]);
      socket.emit('conversation:read', { conversationId: conversation.id });
    }
    function onUpdated({ id, content, editedAt }) {
      setMessages((prev) => prev.map((m) => (m.id === id ? { ...m, content, editedAt } : m)));
    }
    function onDeleted({ id }) {
      setMessages((prev) => prev.map((m) => (m.id === id ? { ...m, deleted: true } : m)));
    }
    function onTyping({ conversationId, userId, name, typing }) {
      if (conversationId !== conversation.id || userId === user.id) return;
      setTypingUsers((prev) => {
        const next = { ...prev };
        if (typing) next[userId] = name;
        else delete next[userId];
        return next;
      });
    }
    function onRead({ conversationId, userId, readAt }) {
      if (conversationId !== conversation.id || userId === user.id) return;
      setOtherReadAt(readAt);
    }
    socket.on('message:new', onNew);
    socket.on('message:updated', onUpdated);
    socket.on('message:deleted', onDeleted);
    socket.on('typing:update', onTyping);
    socket.on('message:read', onRead);
    return () => {
      socket.off('message:new', onNew);
      socket.off('message:updated', onUpdated);
      socket.off('message:deleted', onDeleted);
      socket.off('typing:update', onTyping);
      socket.off('message:read', onRead);
    };
  }, [socket, conversation.id, user.id]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, typingUsers]);

  useEffect(() => () => stopMediaStream(), []);

  function stopMediaStream() {
    clearInterval(recordTimerRef.current);
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
  }

  function handleTextChange(e) {
    setText(e.target.value);
    if (!socket) return;
    socket.emit('typing:start', { conversationId: conversation.id });
    clearTimeout(typingTimeoutRef.current);
    typingTimeoutRef.current = setTimeout(() => {
      socket.emit('typing:stop', { conversationId: conversation.id });
    }, 1500);
  }

  function sendMessage(extra = {}) {
    const content = text.trim();
    if (!content && !extra.fileUrl) return;
    socket?.emit('message:send', { conversationId: conversation.id, content, ...extra }, (res) => {
      if (res?.error) console.error(res.error);
    });
    setText('');
    socket?.emit('typing:stop', { conversationId: conversation.id });
  }

  function handleFileSelect(e) {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    const isImage = file.type.startsWith('image/');
    setPendingFile({ file, isImage, previewUrl: isImage ? URL.createObjectURL(file) : null });
    setCaption('');
  }

  function cancelPendingFile() {
    if (pendingFile?.previewUrl) URL.revokeObjectURL(pendingFile.previewUrl);
    setPendingFile(null);
    setCaption('');
  }

  async function confirmSendFile() {
    if (!pendingFile) return;
    setUploading(true);
    try {
      const { url, name, type } = await api.upload(pendingFile.file);
      const content = caption.trim();
      socket?.emit('message:send', { conversationId: conversation.id, content, fileUrl: url, fileName: name, fileType: type }, (res) => {
        if (res?.error) console.error(res.error);
      });
      if (pendingFile.previewUrl) URL.revokeObjectURL(pendingFile.previewUrl);
      setPendingFile(null);
      setCaption('');
    } catch (err) {
      console.error(err);
    } finally {
      setUploading(false);
    }
  }

  function handleEmojiSelect(emoji) {
    setText((prev) => prev + emoji);
    setEmojiPickerMode(null);
    textareaRef.current?.focus();
  }

  function handleStickerSelect(sticker) {
    setEmojiPickerMode(null);
    socket?.emit('message:send', { conversationId: conversation.id, content: sticker }, (res) => {
      if (res?.error) console.error(res.error);
    });
  }

  function handleEdit(messageId, content) {
    socket?.emit('message:edit', { messageId, content });
  }
  function handleDelete(messageId) {
    socket?.emit('message:delete', { messageId });
  }

  async function startRecording() {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      streamRef.current = stream;
      chunksRef.current = [];
      const recorder = new MediaRecorder(stream);
      recorder.ondataavailable = (e) => {
        if (e.data.size > 0) chunksRef.current.push(e.data);
      };
      mediaRecorderRef.current = recorder;
      recorder.start();
      setIsRecording(true);
      setRecordSeconds(0);
      recordTimerRef.current = setInterval(() => setRecordSeconds((s) => s + 1), 1000);
    } catch (err) {
      console.error('Микрофон недоступен:', err);
    }
  }

  function cancelRecording() {
    const recorder = mediaRecorderRef.current;
    if (recorder && recorder.state !== 'inactive') {
      recorder.onstop = null;
      recorder.stop();
    }
    stopMediaStream();
    setIsRecording(false);
  }

  function finishRecording() {
    const recorder = mediaRecorderRef.current;
    if (!recorder || recorder.state === 'inactive') return;
    recorder.onstop = async () => {
      stopMediaStream();
      setIsRecording(false);
      const blob = new Blob(chunksRef.current, { type: recorder.mimeType || 'audio/webm' });
      if (blob.size === 0) return;
      setUploading(true);
      try {
        const file = new File([blob], `voice-${Date.now()}.webm`, { type: blob.type });
        const { url, name, type } = await api.upload(file);
        socket?.emit(
          'message:send',
          { conversationId: conversation.id, content: '', fileUrl: url, fileName: name, fileType: type },
          (res) => {
            if (res?.error) console.error(res.error);
          }
        );
      } catch (err) {
        console.error(err);
      } finally {
        setUploading(false);
      }
    };
    recorder.stop();
  }

  const typingNames = Object.values(typingUsers);
  const subtitle = conversation.isGroup
    ? `${conversation.members.length} участников`
    : conversation.otherUser?.online
    ? 'в сети'
    : formatLastSeen(conversation.otherUser?.lastSeen);

  let lastDay = null;

  return (
    <div className="relative flex-1 flex flex-col h-full chat-bg">
      <div className="flex items-center gap-3 px-4 py-2.5 border-b" style={{ background: 'var(--panel)', borderColor: 'var(--border)' }}>
        <button onClick={onBack} className="sm:hidden px-1 text-accent">
          <IconBack size={22} />
        </button>
        <button
          onClick={() => setInfoOpen(true)}
          className="flex items-center gap-3 flex-1 min-w-0 text-left rounded-lg hover:bg-hover px-1 py-0.5 -ml-1"
        >
          <Avatar
            name={conversation.name}
            seed={conversation.id}
            size={42}
            online={conversation.otherUser?.online}
            isGroup={conversation.isGroup}
          />
          <div className="flex-1 min-w-0">
            <div className="font-semibold truncate text-[15px]">{conversation.name}</div>
            <div className="text-xs text-muted truncate">
              {typingNames.length > 0 ? (
                <span style={{ color: 'var(--accent)' }} className="flex items-center gap-1">
                  {typingNames.join(', ')} печатает
                  <span className="flex gap-0.5">
                    <span className="typing-dot">.</span>
                    <span className="typing-dot" style={{ animationDelay: '0.15s' }}>.</span>
                    <span className="typing-dot" style={{ animationDelay: '0.3s' }}>.</span>
                  </span>
                </span>
              ) : (
                subtitle
              )}
            </div>
          </div>
        </button>
      </div>

      <div className="flex-1 overflow-y-auto px-3 sm:px-10 py-3">
        {loading && <div className="text-center text-muted mt-8">Загрузка сообщений…</div>}
        {!loading && messages.length === 0 && (
          <div className="flex flex-col items-center justify-center text-muted mt-8 gap-2">
            <IconChatLogo size={40} className="opacity-40" />
            <div>Начните переписку</div>
          </div>
        )}
        {messages.map((m, i) => {
          const day = formatDayLabel(m.createdAt);
          const showDay = day !== lastDay;
          lastDay = day;
          const prev = messages[i - 1];
          const next = messages[i + 1];
          const showSender = conversation.isGroup && (!prev || prev.senderId !== m.senderId);
          const showTail = !next || next.senderId !== m.senderId || formatDayLabel(next.createdAt) !== day;
          const isRead = m.senderId === user.id && m.createdAt <= otherReadAt;
          return (
            <div key={m.id}>
              {showDay && (
                <div className="flex justify-center my-3">
                  <span
                    className="text-xs px-3 py-1 rounded-full"
                    style={{ background: 'var(--panel)', color: 'var(--muted)', boxShadow: 'var(--bubble-shadow)' }}
                  >
                    {day}
                  </span>
                </div>
              )}
              <MessageBubble
                message={m}
                isMine={m.senderId === user.id}
                showSender={showSender}
                showTail={showTail}
                isRead={isRead}
                onEdit={handleEdit}
                onDelete={handleDelete}
              />
            </div>
          );
        })}
        <div ref={bottomRef} />
      </div>

      <div className="p-3 flex items-end gap-2" style={{ background: 'var(--panel)' }}>
        {isRecording ? (
          <>
            <button onClick={cancelRecording} className="w-10 h-10 rounded-full hover:bg-hover flex items-center justify-center shrink-0 text-red-400">
              <IconTrash size={18} />
            </button>
            <div
              className="flex-1 flex items-center gap-2.5 px-4 py-2.5 rounded-3xl text-[15px]"
              style={{ background: 'var(--panel2)' }}
            >
              <span className="w-2.5 h-2.5 rounded-full bg-red-500 animate-pulse shrink-0" />
              <span className="text-muted tabular-nums">{formatClock(recordSeconds)}</span>
              <span className="text-muted text-sm">Запись голосового…</span>
            </div>
            <button
              onClick={finishRecording}
              className="w-11 h-11 rounded-full text-white flex items-center justify-center shrink-0 transition-transform active:scale-90"
              style={{ background: 'linear-gradient(135deg, var(--accent), var(--accent-2))' }}
              title="Отправить"
            >
              <IconCheck size={18} />
            </button>
          </>
        ) : (
          <>
            <input type="file" ref={fileInputRef} className="hidden" onChange={handleFileSelect} />
            <button
              onClick={() => fileInputRef.current?.click()}
              disabled={uploading}
              className="w-10 h-10 rounded-full hover:bg-hover flex items-center justify-center shrink-0 text-accent"
              title="Прикрепить файл"
            >
              <IconPaperclip size={20} />
            </button>
            <div className="relative shrink-0">
              <button
                onClick={() => setEmojiPickerMode((m) => (m === 'sticker' ? null : 'sticker'))}
                className="w-10 h-10 rounded-full hover:bg-hover flex items-center justify-center text-accent"
                title="Стикеры"
              >
                <IconSticker size={20} />
              </button>
              {emojiPickerMode === 'sticker' && (
                <EmojiPopover mode="sticker" onSelect={handleStickerSelect} onClose={() => setEmojiPickerMode(null)} />
              )}
            </div>
            <textarea
              ref={textareaRef}
              rows={1}
              value={text}
              onChange={handleTextChange}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && !e.shiftKey) {
                  e.preventDefault();
                  sendMessage();
                }
              }}
              placeholder="Написать сообщение…"
              className="flex-1 resize-none px-4 py-2.5 rounded-3xl outline-none max-h-32 text-[15px]"
              style={{ background: 'var(--panel2)' }}
            />
            <div className="relative shrink-0">
              <button
                onClick={() => setEmojiPickerMode((m) => (m === 'emoji' ? null : 'emoji'))}
                className="w-10 h-10 rounded-full hover:bg-hover flex items-center justify-center text-accent"
                title="Эмодзи"
              >
                <IconSmile size={20} />
              </button>
              {emojiPickerMode === 'emoji' && (
                <EmojiPopover mode="emoji" align="right" onSelect={handleEmojiSelect} onClose={() => setEmojiPickerMode(null)} />
              )}
            </div>
            {text.trim() ? (
              <button
                onClick={() => sendMessage()}
                className="w-11 h-11 rounded-full text-white flex items-center justify-center shrink-0 transition-transform active:scale-90"
                style={{ background: 'linear-gradient(135deg, var(--accent), var(--accent-2))' }}
                title="Отправить"
              >
                <IconSend size={18} />
              </button>
            ) : (
              <button
                onClick={startRecording}
                disabled={uploading}
                className="w-11 h-11 rounded-full text-white flex items-center justify-center shrink-0 transition-transform active:scale-90 disabled:opacity-50"
                style={{ background: 'linear-gradient(135deg, var(--accent), var(--accent-2))' }}
                title="Голосовое сообщение"
              >
                <IconMic size={18} />
              </button>
            )}
          </>
        )}
      </div>

      {pendingFile && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4" onClick={cancelPendingFile}>
          <div
            className="w-full max-w-md rounded-2xl overflow-hidden flex flex-col pop-in"
            style={{ background: 'var(--overlay)', boxShadow: '0 20px 60px rgba(0,0,0,0.5)' }}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between px-4 pt-3 pb-2">
              <div className="font-semibold text-[15px]">Отправить {pendingFile.isImage ? 'фото' : 'файл'}</div>
              <button onClick={cancelPendingFile} className="w-9 h-9 rounded-full hover:bg-hover flex items-center justify-center text-muted">
                <IconClose size={16} />
              </button>
            </div>

            <div className="px-4 pb-3">
              {pendingFile.isImage ? (
                <img src={pendingFile.previewUrl} alt={pendingFile.file.name} className="w-full max-h-80 object-contain rounded-xl" />
              ) : (
                <div className="flex items-center gap-3 p-4 rounded-xl" style={{ background: 'var(--panel2)' }}>
                  <IconFile size={28} className="text-muted shrink-0" />
                  <span className="truncate text-sm">{pendingFile.file.name}</span>
                </div>
              )}
            </div>

            <div className="p-3 flex items-center gap-2" style={{ borderTop: '1px solid var(--border)' }}>
              <input
                autoFocus
                value={caption}
                onChange={(e) => setCaption(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault();
                    confirmSendFile();
                  }
                }}
                placeholder="Добавьте подпись…"
                className="flex-1 px-4 py-2.5 rounded-full outline-none text-[15px]"
                style={{ background: 'var(--panel2)' }}
              />
              <button
                onClick={confirmSendFile}
                disabled={uploading}
                className="w-11 h-11 rounded-full text-white flex items-center justify-center shrink-0 transition-transform active:scale-90 disabled:opacity-50"
                style={{ background: 'linear-gradient(135deg, var(--accent), var(--accent-2))' }}
                title="Отправить"
              >
                <IconSend size={18} />
              </button>
            </div>
          </div>
        </div>
      )}

      <ProfileInfoPanel
        conversation={conversation}
        open={infoOpen}
        onClose={() => setInfoOpen(false)}
        onOpenConversation={onOpenConversation}
        onAction={onConversationAction}
      />
    </div>
  );
}
