import { useEffect, useState } from 'react';
import { api } from '../lib/api.js';
import { useCall } from '../context/CallContext.jsx';
import Avatar from './Avatar.jsx';
import { IconPhone, IconVideo, IconClose } from './Icons.jsx';

function statusText(entry) {
  if (entry.status === 'answered') {
    const m = Math.floor(entry.durationSeconds / 60);
    const s = entry.durationSeconds % 60;
    const duration = `${m}:${String(s).padStart(2, '0')}`;
    return { text: (entry.isOutgoing ? 'Исходящий, ' : 'Входящий, ') + duration, missed: false };
  }
  if (entry.status === 'missed') {
    return { text: entry.isOutgoing ? 'Отменён' : 'Пропущенный', missed: !entry.isOutgoing };
  }
  if (entry.status === 'declined') {
    return { text: entry.isOutgoing ? 'Отклонён' : 'Отклонён вами', missed: entry.isOutgoing };
  }
  return { text: entry.isOutgoing ? 'Исходящий' : 'Входящий', missed: false };
}

function formatWhen(ts) {
  const date = new Date(ts * 1000);
  const now = new Date();
  const sameDay = date.toDateString() === now.toDateString();
  if (sameDay) return date.toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' });
  return date.toLocaleDateString('ru-RU', { day: 'numeric', month: 'short' });
}

export default function CallHistoryModal({ onClose }) {
  const call = useCall();
  const [calls, setCalls] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api
      .getCalls()
      .then(({ calls }) => setCalls(calls))
      .finally(() => setLoading(false));
  }, []);

  async function callBack(otherUserId, kind) {
    try {
      const { conversation } = await api.createDirect(otherUserId);
      onClose();
      call.startCall(conversation, kind);
    } catch {
      // ignore - user can retry from the chat itself
    }
  }

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4" onClick={onClose}>
      <div
        className="w-full max-w-md rounded-2xl p-5 shadow-2xl pop-in max-h-[80vh] flex flex-col"
        style={{ background: 'var(--overlay)' }}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold">Звонки</h2>
          <button onClick={onClose} className="w-8 h-8 rounded-full hover:bg-hover flex items-center justify-center text-muted">
            <IconClose size={16} />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto -mx-2 px-2">
          {loading && <div className="text-center text-muted py-8">Загрузка…</div>}
          {!loading && calls.length === 0 && (
            <div className="text-center text-muted py-8 text-sm">
              История звонков пуста.
              <br />
              Позвонить можно из открытого чата.
            </div>
          )}
          {calls.map((entry) => {
            const { text, missed } = statusText(entry);
            return (
              <div key={entry.id} className="flex items-center gap-3 py-2.5 px-2 rounded-xl hover:bg-hover">
                <Avatar name={entry.otherUser.displayName} seed={entry.otherUser.id} size={44} src={entry.otherUser.avatarUrl} />
                <div className="flex-1 min-w-0">
                  <div className="font-medium truncate text-[15px]">{entry.otherUser.displayName}</div>
                  <div className="text-xs flex items-center gap-1" style={{ color: missed ? '#e74c3c' : 'var(--muted)' }}>
                    {entry.isOutgoing ? '↗' : '↙'} {text}
                  </div>
                </div>
                <div className="text-xs text-muted shrink-0">{formatWhen(entry.startedAt)}</div>
                <button
                  onClick={() => callBack(entry.otherUser.id, entry.kind)}
                  className="w-9 h-9 rounded-full hover:bg-hover flex items-center justify-center text-accent shrink-0"
                  title="Перезвонить"
                >
                  {entry.kind === 'video' ? <IconVideo size={18} /> : <IconPhone size={18} />}
                </button>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
