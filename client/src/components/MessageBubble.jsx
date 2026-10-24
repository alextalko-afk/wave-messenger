import { useState } from 'react';
import { formatTime } from '../lib/format.js';
import { isStickerContent } from '../lib/emoji.js';
import { IconEdit, IconTrash, IconCheck, IconCheckAll, IconFile, IconClose, IconDownload, IconPlay } from './Icons.jsx';
import VoiceMessage from './VoiceMessage.jsx';

// Must match ALLOWED_REACTIONS on the server.
const QUICK_REACTIONS = ['👍', '❤️', '😂', '😮', '😢', '🙏', '🔥', '👎'];

export default function MessageBubble({
  message,
  isMine,
  showSender,
  isRead,
  isDelivered,
  showTail,
  currentUserId,
  onEdit,
  onDelete,
  onReply,
  onReact,
}) {
  const [menuOpen, setMenuOpen] = useState(false);
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(message.content);
  const [lightboxOpen, setLightboxOpen] = useState(false);

  const isImage = message.fileType?.startsWith('image/');
  const isVideo = message.fileType?.startsWith('video/');
  const isAudio = message.fileType?.startsWith('audio/');
  const isSticker = !message.fileUrl && !editing && isStickerContent(message.content);

  function submitEdit() {
    if (draft.trim() && draft !== message.content) onEdit(message.id, draft.trim());
    setEditing(false);
  }

  if (message.deleted) {
    return (
      <div className={`flex ${isMine ? 'justify-end' : 'justify-start'} msg-in px-1`}>
        <div className="italic text-muted text-xs px-3 py-1.5 my-0.5 bg-panel2 rounded-full">Сообщение удалено</div>
      </div>
    );
  }

  const reactions = message.reactions || [];

  const reactionBar = menuOpen && !editing && onReact && (
    <div
      className={`absolute -top-10 pb-2 z-10 ${isMine ? 'right-2' : 'left-2'}`}
      onClick={(e) => e.stopPropagation()}
      onDoubleClick={(e) => e.stopPropagation()}
    >
      <div
        className="flex gap-0.5 rounded-full px-1.5 py-1 shadow-lg pop-in"
        style={{ background: 'var(--overlay)', border: '1px solid var(--border)' }}
      >
        {QUICK_REACTIONS.map((emoji) => {
          const mine = reactions.some((r) => r.emoji === emoji && r.userIds.includes(currentUserId));
          return (
            <button
              key={emoji}
              className="w-7 h-7 flex items-center justify-center rounded-full text-[17px] leading-none hover:scale-125 transition-transform"
              style={{ background: mine ? 'var(--hover)' : 'transparent' }}
              onClick={() => {
                onReact(message.id, emoji);
                setMenuOpen(false);
              }}
              title={emoji}
            >
              {emoji}
            </button>
          );
        })}
      </div>
    </div>
  );

  const reactionChips = reactions.length > 0 && (
    <div className="flex flex-wrap gap-1 mt-1.5 clear-both">
      {reactions.map(({ emoji, userIds }) => {
        const mine = userIds.includes(currentUserId);
        return (
          <button
            key={emoji}
            onClick={() => onReact?.(message.id, emoji)}
            className="flex items-center gap-1 rounded-full px-2.5 py-1 text-[13px] leading-none transition-colors"
            style={{
              background: mine ? 'var(--react-mine)' : 'var(--react)',
              color: 'var(--text)',
              boxShadow: 'var(--bubble-shadow)',
            }}
            title={mine ? 'Убрать реакцию' : 'Поставить реакцию'}
          >
            <span>{emoji}</span>
            {userIds.length > 1 && <span className="text-[11px] font-medium">{userIds.length}</span>}
          </button>
        );
      })}
    </div>
  );

  const editDeleteMenu = isMine && menuOpen && !editing && (
    <div
      className="absolute -top-3 right-2 flex gap-0.5 rounded-full px-1.5 py-1 shadow-lg pop-in"
      style={{ background: 'var(--overlay)', border: '1px solid var(--border)' }}
    >
      {!message.fileUrl && (
        <button className="p-1 hover:opacity-70" onClick={() => setEditing(true)} title="Редактировать">
          <IconEdit size={14} />
        </button>
      )}
      <button className="p-1 hover:opacity-70" onClick={() => onDelete(message.id)} title="Удалить">
        <IconTrash size={14} />
      </button>
    </div>
  );

  if (isSticker) {
    return (
      <div className={`flex ${isMine ? 'justify-end' : 'justify-start'} msg-in group px-1`}>
        <div
          className="relative flex flex-col px-1 py-1"
          style={{ alignItems: isMine ? 'flex-end' : 'flex-start' }}
          onMouseEnter={() => setMenuOpen(true)}
          onMouseLeave={() => setMenuOpen(false)}
        >
          {showSender && !isMine && (
            <div className="text-xs font-semibold mb-0.5 px-1" style={{ color: 'var(--accent)' }}>
              {message.senderName}
            </div>
          )}
          <div style={{ fontSize: 72, lineHeight: 1 }} className="select-none">
            {message.content}
          </div>
          <div className="flex items-center gap-1 text-[11px] text-muted px-1 -mt-1">
            {message.editedAt && <span>изм.</span>}
            {formatTime(message.createdAt)}
            {isMine && (
              <span style={{ color: isRead ? 'var(--check)' : 'inherit', display: 'inline-flex' }}>
                {isRead || isDelivered ? <IconCheckAll size={14} /> : <IconCheck size={11} />}
              </span>
            )}
          </div>
          {editDeleteMenu}
        </div>
      </div>
    );
  }

  return (
    <div className={`flex ${isMine ? 'justify-end' : 'justify-start'} msg-in group px-1 mb-1`}>
      <div
        className={`relative max-w-[85%] sm:max-w-[70%] pl-3.5 pr-3 py-2 rounded-[18px] ${
          showTail ? (isMine ? 'rounded-br-[6px]' : 'rounded-bl-[6px]') : ''
        }`}
        style={{
          background: isMine ? 'var(--bubble-out)' : 'var(--bubble-in)',
          color: isMine ? 'var(--bubble-out-text)' : 'var(--bubble-in-text)',
          boxShadow: 'var(--bubble-shadow)',
        }}
        onMouseEnter={() => setMenuOpen(true)}
        onMouseLeave={() => setMenuOpen(false)}
        onContextMenu={(e) => {
          // long-press on touch devices opens the reaction bar
          if (!onReact) return;
          e.preventDefault();
          setMenuOpen(true);
        }}
        onDoubleClick={() => onReply && onReply()}
      >
        {showSender && !isMine && (
          <div className="text-xs font-medium mb-0.5" style={{ color: 'var(--accent)' }}>
            {message.senderName}
          </div>
        )}

        {message.replyToId && (
          <div
            className="px-2.5 py-1.5 mb-1.5 rounded-xl cursor-pointer"
            style={{ background: isMine ? 'var(--reply-out)' : 'var(--reply-in)' }}
          >
            <div
              className="text-[12px] leading-4 font-semibold"
              style={{ color: isMine ? 'var(--bubble-out-text)' : 'var(--accent)' }}
            >
              {message.replyToSenderName || 'Пользователь'}
            </div>
            <div className="text-[13px] leading-[18px] truncate">{message.replyToContent || 'Медиафайл'}</div>
          </div>
        )}

        {message.fileUrl && isImage && (
          <img
            src={message.fileUrl}
            alt={message.fileName}
            onClick={() => setLightboxOpen(true)}
            className="rounded-xl mb-1 max-h-72 object-cover -mx-0.5 cursor-pointer"
          />
        )}
        {message.fileUrl && isVideo && (
          <div
            onClick={() => setLightboxOpen(true)}
            className="relative rounded-xl mb-1 -mx-0.5 cursor-pointer overflow-hidden"
          >
            <video src={message.fileUrl} playsInline muted className="max-h-72 w-full" style={{ background: '#000' }} />
            <div className="absolute inset-0 flex items-center justify-center bg-black/20">
              <div className="w-10 h-10 rounded-full flex items-center justify-center bg-black/50 text-white">
                <IconPlay size={20} />
              </div>
            </div>
          </div>
        )}
        {message.fileUrl && isAudio && <VoiceMessage url={message.fileUrl} isMine={isMine} />}
        {message.fileUrl && !isImage && !isVideo && !isAudio && (
          <a
            href={message.fileUrl}
            target="_blank"
            rel="noreferrer"
            className="flex items-center gap-2 mb-1 px-3 py-2 rounded-xl hover:opacity-80 transition-opacity"
            style={{ background: isMine ? 'var(--reply-out)' : 'var(--reply-in)' }}
          >
            <IconFile size={18} />
            <span className="truncate underline text-sm">{message.fileName || 'Файл'}</span>
          </a>
        )}

        {editing ? (
          <div className="flex gap-1 items-center min-w-[160px]">
            <input
              autoFocus
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && submitEdit()}
              className="bg-transparent border-b outline-none flex-1 text-sm"
              style={{ borderColor: 'currentColor' }}
            />
            <button onClick={submitEdit} className="opacity-80 shrink-0">
              <IconCheck size={14} />
            </button>
          </div>
        ) : (
          message.content && (
            <div className="whitespace-pre-wrap break-words text-[15px] leading-normal pr-10">{message.content}</div>
          )
        )}

        <div
          className={`flex items-center gap-1 justify-end text-[10px] mt-0.5 whitespace-nowrap ${
            isAudio ? '' : 'float-right -mb-1 ml-1'
          }`}
          style={{ color: isMine ? 'var(--bubble-out-meta)' : 'var(--muted)' }}
        >
          {message.editedAt && <span className="mr-0.5">изм.</span>}
          {formatTime(message.createdAt)}
          {isMine && (
            <span
              style={{
                color: isRead ? 'var(--bubble-out-text)' : 'inherit',
                opacity: isRead ? 1 : 0.75,
                display: 'inline-flex',
                marginLeft: '2px',
              }}
            >
              {isRead || isDelivered ? <IconCheckAll size={15} /> : <IconCheck size={12} />}
            </span>
          )}
        </div>

        {reactionChips}
        {reactionBar}
        {editDeleteMenu}
      </div>

      {lightboxOpen && (
        <div
          className="fixed inset-0 bg-black/90 flex items-center justify-center z-50 p-4"
          onClick={() => setLightboxOpen(false)}
        >
          <button
            onClick={() => setLightboxOpen(false)}
            className="absolute top-4 right-4 w-10 h-10 rounded-full flex items-center justify-center text-white bg-white/10 hover:bg-white/20"
          >
            <IconClose size={18} />
          </button>
          <a
            href={message.fileUrl}
            download={message.fileName || true}
            onClick={(e) => e.stopPropagation()}
            className="absolute top-4 right-16 w-10 h-10 rounded-full flex items-center justify-center text-white bg-white/10 hover:bg-white/20"
            title="Скачать"
          >
            <IconDownload size={18} />
          </a>
          {isVideo ? (
            <video
              src={message.fileUrl}
              controls
              autoPlay
              playsInline
              onClick={(e) => e.stopPropagation()}
              className="max-w-full max-h-full object-contain pop-in"
            />
          ) : (
            <img
              src={message.fileUrl}
              alt={message.fileName}
              onClick={(e) => e.stopPropagation()}
              className="max-w-full max-h-full object-contain pop-in"
            />
          )}
        </div>
      )}
    </div>
  );
}
