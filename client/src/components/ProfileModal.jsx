import { useState } from 'react';
import { api } from '../lib/api.js';
import { useAuth } from '../context/AuthContext.jsx';
import Avatar from './Avatar.jsx';

export default function ProfileModal({ onClose }) {
  const { user, setUser } = useAuth();
  const [displayName, setDisplayName] = useState(user.displayName);
  const [bio, setBio] = useState(user.bio || '');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  async function handleSave() {
    if (!displayName.trim()) {
      setError('Введите имя');
      return;
    }
    setBusy(true);
    try {
      const { user: updated } = await api.updateMe({ displayName: displayName.trim(), bio: bio.trim() });
      setUser(updated);
      onClose();
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
        <h2 className="text-lg font-semibold mb-4 text-center">Мой профиль</h2>

        <div className="flex justify-center mb-5">
          <Avatar name={displayName || user.displayName} seed={user.id} size={80} />
        </div>

        {error && <div className="mb-3 text-sm text-red-400 bg-red-500/10 rounded-xl px-3 py-2">{error}</div>}

        <label className="block text-xs text-muted mb-1.5">Имя</label>
        <input
          className="w-full mb-3 px-3.5 py-2.5 rounded-xl outline-none focus:ring-2 focus:ring-accent/40 text-sm"
          style={{ background: 'var(--panel2)' }}
          value={displayName}
          onChange={(e) => setDisplayName(e.target.value)}
        />

        <label className="block text-xs text-muted mb-1.5">О себе</label>
        <textarea
          rows={3}
          className="w-full mb-1 px-3.5 py-2.5 rounded-xl outline-none focus:ring-2 focus:ring-accent/40 text-sm resize-none"
          style={{ background: 'var(--panel2)' }}
          value={bio}
          onChange={(e) => setBio(e.target.value)}
          placeholder="Пара слов о себе"
        />

        <div className="text-xs text-muted mb-4">@{user.username}</div>

        <button
          disabled={busy}
          onClick={handleSave}
          className="w-full py-2.5 rounded-full text-white font-medium hover:opacity-90 transition disabled:opacity-50"
          style={{ background: 'linear-gradient(135deg, var(--accent), var(--accent-2))' }}
        >
          {busy ? 'Сохраняем…' : 'Сохранить'}
        </button>
      </div>
    </div>
  );
}
