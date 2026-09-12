import { useEffect, useState } from 'react';
import { api } from '../lib/api.js';
import Avatar from './Avatar.jsx';
import { IconSearch, IconClose } from './Icons.jsx';

export default function NewChatModal({ onClose, onCreated, initialMode = 'direct' }) {
  const [mode, setMode] = useState(initialMode); // 'direct' | 'group'
  const [query, setQuery] = useState('');
  const [results, setResults] = useState([]);
  const [selected, setSelected] = useState([]);
  const [groupName, setGroupName] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!query.trim()) {
      setResults([]);
      return;
    }
    const t = setTimeout(() => {
      api.searchUsers(query).then((r) => setResults(r.users)).catch(() => {});
    }, 250);
    return () => clearTimeout(t);
  }, [query]);

  function toggleSelect(user) {
    setSelected((prev) =>
      prev.find((u) => u.id === user.id) ? prev.filter((u) => u.id !== user.id) : [...prev, user]
    );
  }

  async function handleDirectClick(user) {
    setBusy(true);
    try {
      const { conversation } = await api.createDirect(user.id);
      onCreated(conversation);
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  }

  async function handleCreateGroup() {
    if (!groupName.trim() || selected.length === 0) {
      setError('Введите название группы и выберите участников');
      return;
    }
    setBusy(true);
    try {
      const { conversation } = await api.createGroup(groupName.trim(), selected.map((u) => u.id));
      onCreated(conversation);
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4" onClick={onClose}>
      <div
        className="w-full max-w-md rounded-2xl p-5 shadow-2xl pop-in"
        style={{ background: 'var(--overlay)' }}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex gap-1 mb-4 p-1 rounded-full" style={{ background: 'var(--panel2)' }}>
          <button
            className="flex-1 py-2 rounded-full font-medium text-sm transition-colors"
            style={mode === 'direct' ? { background: 'var(--accent)', color: '#fff' } : { color: 'var(--muted)' }}
            onClick={() => setMode('direct')}
          >
            Личный чат
          </button>
          <button
            className="flex-1 py-2 rounded-full font-medium text-sm transition-colors"
            style={mode === 'group' ? { background: 'var(--accent)', color: '#fff' } : { color: 'var(--muted)' }}
            onClick={() => setMode('group')}
          >
            Группа
          </button>
        </div>

        {error && <div className="mb-3 text-sm text-red-400 bg-red-500/10 rounded-lg px-3 py-2">{error}</div>}

        {mode === 'group' && (
          <input
            className="w-full mb-3 px-3.5 py-2.5 rounded-xl outline-none focus:ring-2 focus:ring-accent/40"
            style={{ background: 'var(--panel2)' }}
            placeholder="Название группы"
            value={groupName}
            onChange={(e) => setGroupName(e.target.value)}
          />
        )}

        {mode === 'group' && selected.length > 0 && (
          <div className="flex flex-wrap gap-2 mb-3">
            {selected.map((u) => (
              <span
                key={u.id}
                className="flex items-center gap-1 px-2.5 py-1 rounded-full text-sm cursor-pointer"
                style={{ background: 'var(--selected)', color: 'var(--accent-2)' }}
                onClick={() => toggleSelect(u)}
              >
                {u.displayName} <IconClose size={11} />
              </span>
            ))}
          </div>
        )}

        <div className="relative mb-2">
          <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-muted">
            <IconSearch size={16} />
          </span>
          <input
            className="w-full pl-9 pr-3.5 py-2.5 rounded-xl outline-none focus:ring-2 focus:ring-accent/40 text-sm"
            style={{ background: 'var(--panel2)' }}
            placeholder="Поиск по логину или имени"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            autoFocus
          />
        </div>

        <div className="max-h-64 overflow-y-auto flex flex-col gap-0.5 mt-2">
          {results.map((u) => {
            const isSelected = selected.some((s) => s.id === u.id);
            return (
              <button
                key={u.id}
                disabled={busy}
                onClick={() => (mode === 'direct' ? handleDirectClick(u) : toggleSelect(u))}
                className="flex items-center gap-3 px-2.5 py-2 rounded-xl hover:bg-hover text-left"
                style={isSelected ? { background: 'var(--selected)' } : {}}
              >
                <Avatar name={u.displayName} seed={u.id} size={40} online={u.online} />
                <div>
                  <div className="font-medium text-sm">{u.displayName}</div>
                  <div className="text-xs text-muted">@{u.username}</div>
                </div>
              </button>
            );
          })}
          {query && results.length === 0 && (
            <div className="text-muted text-sm text-center py-4">Никого не найдено</div>
          )}
        </div>

        {mode === 'group' && (
          <button
            disabled={busy}
            onClick={handleCreateGroup}
            className="w-full mt-4 py-2.5 rounded-full text-white font-medium hover:opacity-90 transition disabled:opacity-50"
            style={{ background: 'linear-gradient(135deg, var(--accent), var(--accent-2))' }}
          >
            {busy ? 'Создаём…' : 'Создать группу'}
          </button>
        )}
      </div>
    </div>
  );
}
