import { useEffect, useRef, useState } from 'react';
import { api } from '../lib/api.js';
import Avatar from './Avatar.jsx';
import { IconSearch, IconClose, IconCheck } from './Icons.jsx';

// Admin tool: find people and add them to an existing group.
export default function AddMembersModal({ conversation, onClose, onAdded }) {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState([]);
  const [selected, setSelected] = useState([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const inputRef = useRef(null);
  const memberIds = new Set(conversation.members.map((m) => m.id));

  useEffect(() => {
    inputRef.current?.focus();
    function onKey(e) {
      if (e.key === 'Escape') onClose();
    }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  useEffect(() => {
    if (!query.trim()) {
      setResults([]);
      return;
    }
    let cancelled = false;
    const t = setTimeout(() => {
      api
        .searchUsers(query.trim())
        .then((r) => !cancelled && setResults(r.users.filter((u) => !memberIds.has(u.id))))
        .catch(() => !cancelled && setResults([]));
    }, 250);
    return () => {
      cancelled = true;
      clearTimeout(t);
    };
  }, [query]);

  function toggle(user) {
    setSelected((prev) => (prev.some((u) => u.id === user.id) ? prev.filter((u) => u.id !== user.id) : [...prev, user]));
  }

  async function submit() {
    setBusy(true);
    setError('');
    try {
      const { conversation: updated } = await api.addGroupMembers(conversation.id, selected.map((u) => u.id));
      onAdded(updated);
      onClose();
    } catch (err) {
      setError(err.message);
      setBusy(false);
    }
  }

  return (
    <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-[60] p-4" onClick={onClose}>
      <div
        className="w-full max-w-md max-h-[80vh] rounded-2xl overflow-hidden flex flex-col pop-in"
        style={{ background: 'var(--overlay)', boxShadow: '0 20px 60px rgba(0,0,0,0.5)', border: '1px solid var(--border)' }}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between px-4 pt-3 pb-2">
          <div className="font-semibold text-[15px]">Добавить в «{conversation.name}»</div>
          <button onClick={onClose} className="w-9 h-9 rounded-full hover:bg-hover flex items-center justify-center text-muted" title="Закрыть">
            <IconClose size={16} />
          </button>
        </div>

        {selected.length > 0 && (
          <div className="flex flex-wrap gap-1.5 px-4 pb-2">
            {selected.map((u) => (
              <button
                key={u.id}
                onClick={() => toggle(u)}
                className="flex items-center gap-1.5 pl-1 pr-2.5 py-1 rounded-full text-[13px]"
                style={{ background: 'var(--panel2)' }}
                title="Убрать"
              >
                <Avatar name={u.displayName} seed={u.id} size={22} src={u.avatarUrl} />
                {u.displayName}
              </button>
            ))}
          </div>
        )}

        <label className="mx-4 mb-2 flex items-center gap-2 px-3 h-10 rounded-xl text-muted" style={{ background: 'var(--panel2)' }}>
          <IconSearch size={16} />
          <input
            ref={inputRef}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Имя или логин"
            aria-label="Поиск людей"
            className="flex-1 min-w-0 bg-transparent outline-none text-[14px] text-text"
          />
        </label>

        <div className="flex-1 overflow-y-auto px-2 pb-2 min-h-[120px]">
          {results.map((u) => {
            const on = selected.some((s) => s.id === u.id);
            return (
              <button key={u.id} onClick={() => toggle(u)} className="w-full flex items-center gap-3 px-2 py-2 rounded-xl text-left hover:bg-hover transition-colors">
                <Avatar name={u.displayName} seed={u.id} size={42} online={u.online} src={u.avatarUrl} />
                <div className="flex-1 min-w-0">
                  <div className="font-medium truncate text-[15px]">{u.displayName}</div>
                  <div className="text-[13px] text-muted truncate">@{u.username}</div>
                </div>
                <span
                  className="w-6 h-6 rounded-full flex items-center justify-center shrink-0 text-white"
                  style={{ background: on ? 'var(--accent-fill)' : 'transparent', border: on ? 'none' : '2px solid var(--border)' }}
                >
                  {on && <IconCheck size={14} />}
                </span>
              </button>
            );
          })}
          {query.trim() && results.length === 0 && <div className="text-center text-muted text-sm py-8">Никого не найдено</div>}
          {!query.trim() && <div className="text-center text-muted text-sm py-8">Начните вводить имя или логин</div>}
        </div>

        <div className="p-3" style={{ borderTop: '1px solid var(--border)' }}>
          {error && <div className="text-red-400 text-sm mb-2 text-center">{error}</div>}
          <button
            onClick={submit}
            disabled={selected.length === 0 || busy}
            className="w-full h-11 rounded-xl text-white font-semibold disabled:opacity-40 transition-opacity"
            style={{ background: 'var(--accent-fill)' }}
          >
            {busy ? 'Добавляем…' : selected.length > 0 ? `Добавить (${selected.length})` : 'Добавить'}
          </button>
        </div>
      </div>
    </div>
  );
}
