import { useState } from 'react';
import { formatTime } from '../lib/format.js';
import { isStickerContent } from '../lib/emoji.js';
import { IconEdit, IconTrash, IconCheck, IconCheckAll, IconFile } from './Icons.jsx';
import VoiceMessage from './VoiceMessage.jsx';

export default function MessageBubble({ message, isMine, showSender, isRead, showTail, onEdit, onDelete }) {
  const [menuOpen, setMenuOpen] = useState(false);
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(message.content);

  const isImage = message.fileType?.startsWith('image/');
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
                {isRead ? <IconCheckAll size={14} /> : <IconCheck size={11} />}
              </span>
            )}
          </div>
          {editDeleteMenu}
        </div>
      </div>
    );
  }

  return (
    <div className={`flex ${isMine ? 'justify-end' : 'justify-start'} msg-in group px-1`}>
      <div
        className={`relative max-w-[72%] sm:max-w-[65%] pl-3 pr-3.5 py-1.5 my-[1px] ${
          showTail
            ? isMine
              ? 'bubble-tail-out rounded-2xl rounded-br-md'
              : 'bubble-tail-in rounded-2xl rounded-bl-md'
            : 'rounded-2xl'
        }`}
        style={{
          background: isMine ? 'var(--bubble-out)' : 'var(--bubble-in)',
          color: isMine ? 'var(--bubble-out-text)' : 'var(--bubble-in-text)',
          boxShadow: 'var(--bubble-shadow)',
        }}
        onMouseEnter={() => setMenuOpen(true)}
        onMouseLeave={() => setMenuOpen(false)}
      >
        {showSender && !isMine && (
          <div className="text-xs font-semibold mb-0.5" style={{ color: 'var(--accent)' }}>
            {message.senderName}
          </div>
        )}

        {message.fileUrl && isImage && (
          <img src={message.fileUrl} alt={message.fileName} className="rounded-lg mb-1 max-h-72 object-cover -mx-0.5" />
        )}
        {message.fileUrl && isAudio && <VoiceMessage url={message.fileUrl} isMine={isMine} />}
        {message.fileUrl && !isImage && !isAudio && (
          <a
            href={message.fileUrl}
            target="_blank"
            rel="noreferrer"
            className="flex items-center gap-2 mb-1 px-2.5 py-2 rounded-xl bg-black/5"
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
            <div className="whitespace-pre-wrap break-words text-[15px] leading-snug pr-12">{message.content}</div>
          )
        )}

        <div
          className={`flex items-center gap-1 justify-end text-[11px] mt-0.5 whitespace-nowrap ${
            isAudio ? '' : 'float-right -mb-1 ml-1'
          }`}
          style={{ color: isMine ? 'rgba(23,33,43,0.55)' : 'var(--muted)' }}
        >
          {message.editedAt && <span>изм.</span>}
          {formatTime(message.createdAt)}
          {isMine && (
            <span style={{ color: isRead ? 'var(--check)' : 'inherit', display: 'inline-flex' }}>
              {isRead ? <IconCheckAll size={16} /> : <IconCheck size={13} />}
            </span>
          )}
        </div>

        {editDeleteMenu}
      </div>
    </div>
  );
}
