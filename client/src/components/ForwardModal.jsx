import { useEffect, useRef, useState } from 'react';
import Avatar from './Avatar.jsx';
import { IconSearch, IconClose, IconCheck, IconSend } from './Icons.jsx';

// Pick one or more chats to forward a message to.
export default function ForwardModal({ conversations, message, onClose, onForward }) {
  const [query, setQuery] = useState('');
  const [selected, setSelected] = useState([]);
  const inputRef = useRef(null);

  useEffect(() => {
    inputRef.current?.focus();
    function onKey(e) {
      if (e.key === 'Escape') onClose();
    }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  const q = query.trim().toLowerCase();
  const list = conversations.filter((c) => !q || c.name.toLowerCase().includes(q));
  const preview = message.content || (message.fileType?.startsWith('audio/') ? 'Голосовое сообщение' : message.fileName || 'Вложение');

  function toggle(id) {
    setSelected((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));
  }

  return (
    <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4" onClick={onClose}>
      <div
        className="w-full max-w-md max-h-[80vh] rounded-2xl overflow-hidden flex flex-col pop-in"
        style={{ background: 'var(--overlay)', boxShadow: '0 20px 60px rgba(0,0,0,0.5)', border: '1px solid var(--border)' }}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between px-4 pt-3 pb-2">
          <div className="font-semibold text-[15px]">Переслать сообщение</div>
          <button onClick={onClose} className="w-9 h-9 rounded-full hover:bg-hover flex items-center justify-center text-muted" title="Закрыть">
            <IconClose size={16} />
          </button>
        </div>

        <div className="mx-4 mb-2 px-3 py-2 rounded-xl text-[13px] truncate text-muted" style={{ background: 'var(--panel2)' }}>
          {preview}
        </div>

        <label className="mx-4 mb-2 flex items-center gap-2 px-3 h-10 rounded-xl text-muted" style={{ background: 'var(--panel2)' }}>
          <IconSearch size={16} />
          <input
            ref={inputRef}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Поиск чата"
            aria-label="Поиск чата"
            className="flex-1 min-w-0 bg-transparent outline-none text-[14px] text-text"
          />
        </label>

        <div className="flex-1 overflow-y-auto px-2 pb-2">
          {list.map((c) => {
            const on = selected.includes(c.id);
            return (
              <button
                key={c.id}
                onClick={() => toggle(c.id)}
                className="w-full flex items-center gap-3 px-2 py-2 rounded-xl text-left hover:bg-hover transition-colors"
              >
                <Avatar name={c.name} seed={c.id} size={42} isGroup={c.isGroup} src={c.avatarUrl} />
                <span className="flex-1 min-w-0 truncate font-medium text-[15px]">{c.name}</span>
                <span
                  className="w-6 h-6 rounded-full flex items-center justify-center shrink-0 text-white"
                  style={{ background: on ? 'var(--accent-fill)' : 'transparent', border: on ? 'none' : '2px solid var(--border)' }}
                >
                  {on && <IconCheck size={14} />}
                </span>
              </button>
            );
          })}
          {list.length === 0 && <div className="text-center text-muted text-sm py-8">Чаты не найдены</div>}
        </div>

        <div className="p-3" style={{ borderTop: '1px solid var(--border)' }}>
          <button
            onClick={() => onForward(selected)}
            disabled={selected.length === 0}
            className="w-full h-11 rounded-xl text-white font-semibold flex items-center justify-center gap-2 disabled:opacity-40 transition-opacity"
            style={{ background: 'var(--accent-fill)' }}
          >
            <IconSend size={16} />
            {selected.length > 1 ? `Переслать в ${selected.length} чата` : 'Переслать'}
          </button>
        </div>
      </div>
    </div>
  );
}
