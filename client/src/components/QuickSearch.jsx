import { useEffect, useMemo, useRef, useState } from 'react';
import { api } from '../lib/api.js';
import { useAuth } from '../context/AuthContext.jsx';
import { formatDayLabel } from '../lib/format.js';
import Avatar from './Avatar.jsx';
import { Highlighted } from './Sidebar.jsx';
import { IconSearch } from './Icons.jsx';

const MIN_MESSAGE_LENGTH = 2;

function GroupTitle({ children }) {
  return <div className="px-3 pt-3 pb-1 text-[11px] font-semibold text-muted uppercase tracking-wider">{children}</div>;
}

// Ctrl/Cmd+K palette: chats, messages and people in one list, driven by the keyboard.
export default function QuickSearch({ conversations, onOpenConversation, onCreated, onClose }) {
  const { user } = useAuth();
  const [query, setQuery] = useState('');
  const [messages, setMessages] = useState([]);
  const [people, setPeople] = useState([]);
  const [active, setActive] = useState(0);
  const inputRef = useRef(null);
  const activeRef = useRef(null);

  const q = query.trim();
  const needle = q.toLowerCase();

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  useEffect(() => {
    if (!q) {
      setMessages([]);
      setPeople([]);
      return;
    }
    let cancelled = false;
    const t = setTimeout(() => {
      if (q.length >= MIN_MESSAGE_LENGTH) {
        api.searchMessages(q).then((r) => !cancelled && setMessages(r.results)).catch(() => !cancelled && setMessages([]));
      } else {
        setMessages([]);
      }
      api
        .searchUsers(q)
        .then((r) => !cancelled && setPeople(r.users.filter((u) => u.id !== user.id)))
        .catch(() => !cancelled && setPeople([]));
    }, 250);
    return () => {
      cancelled = true;
      clearTimeout(t);
    };
  }, [q, user.id]);

  const items = useMemo(() => {
    const chats = (q ? conversations.filter((c) => c.name.toLowerCase().includes(needle)) : conversations.slice(0, 6)).map((c) => ({
      kind: 'chat',
      key: `c:${c.id}`,
      conv: c,
    }));
    const hits = messages
      .map((r) => ({ kind: 'message', key: `m:${r.id}`, r, conv: conversations.find((c) => c.id === r.conversationId) }))
      .filter((x) => x.conv);
    const known = new Set(conversations.filter((c) => c.otherUser).map((c) => c.otherUser.id));
    const newPeople = people.filter((u) => !known.has(u.id)).map((u) => ({ kind: 'user', key: `u:${u.id}`, u }));
    return [...chats, ...hits, ...newPeople];
  }, [conversations, messages, people, q, needle]);

  useEffect(() => {
    setActive(0);
  }, [q]);

  useEffect(() => {
    activeRef.current?.scrollIntoView({ block: 'nearest' });
  }, [active]);

  async function run(item) {
    if (!item) return;
    if (item.kind === 'chat') onOpenConversation(item.conv.id);
    else if (item.kind === 'message') onOpenConversation(item.r.conversationId);
    else {
      const { conversation } = await api.createDirect(item.u.id);
      onCreated(conversation);
    }
    onClose();
  }

  function onKeyDown(e) {
    if (e.key === 'Escape') {
      e.preventDefault();
      onClose();
    } else if (e.key === 'ArrowDown') {
      e.preventDefault();
      setActive((i) => (items.length ? (i + 1) % items.length : 0));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setActive((i) => (items.length ? (i - 1 + items.length) % items.length : 0));
    } else if (e.key === 'Enter') {
      e.preventDefault();
      run(items[active]);
    }
  }

  const sections = [
    { title: q ? 'Чаты' : 'Недавние чаты', kind: 'chat' },
    { title: 'Сообщения', kind: 'message' },
    { title: 'Люди', kind: 'user' },
  ];

  return (
    <div className="fixed inset-0 z-50 flex justify-center items-start pt-[12vh] px-4" style={{ background: 'rgba(5,8,12,0.62)' }} onClick={onClose}>
      <div
        className="w-full max-w-[640px] rounded-3xl overflow-hidden pop-in flex flex-col max-h-[70vh]"
        style={{ background: 'var(--overlay)', border: '1px solid var(--border)', boxShadow: '0 32px 90px rgba(0,0,0,0.5)' }}
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-label="Быстрый поиск"
      >
        <label className="flex items-center gap-3 h-16 px-5 shrink-0" style={{ borderBottom: '1px solid var(--border)' }}>
          <span style={{ color: 'var(--accent)' }}>
            <IconSearch size={20} />
          </span>
          <input
            ref={inputRef}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={onKeyDown}
            placeholder="Чаты, сообщения, люди…"
            aria-label="Быстрый поиск"
            className="flex-1 min-w-0 bg-transparent outline-none text-[18px]"
          />
          <kbd className="text-[12px] px-2 py-0.5 rounded-md text-muted" style={{ border: '1px solid var(--border)' }}>Esc</kbd>
        </label>

        <div className="flex-1 overflow-y-auto p-2.5">
          {sections.map((s) => {
            const rows = items.map((it, index) => ({ it, index })).filter(({ it }) => it.kind === s.kind);
            if (rows.length === 0) return null;
            return (
              <div key={s.kind}>
                <GroupTitle>{s.title}</GroupTitle>
                {rows.map(({ it, index }) => {
                  const on = index === active;
                  const common = {
                    key: it.key,
                    ref: on ? activeRef : undefined,
                    onClick: () => run(it),
                    onMouseMove: () => setActive(index),
                    className: 'w-full flex items-center gap-3 px-2.5 py-2 rounded-2xl text-left',
                    style: { background: on ? 'var(--selected)' : 'transparent' },
                  };
                  if (it.kind === 'user') {
                    return (
                      <button {...common}>
                        <Avatar name={it.u.displayName} seed={it.u.id} size={42} online={it.u.online} src={it.u.avatarUrl} />
                        <div className="flex-1 min-w-0">
                          <div className="font-medium truncate text-[15px]">
                            <Highlighted text={it.u.displayName} needle={q} />
                          </div>
                          <div className="text-[13px] text-muted truncate">@{it.u.username} · написать</div>
                        </div>
                      </button>
                    );
                  }
                  if (it.kind === 'message') {
                    return (
                      <button {...common}>
                        <Avatar name={it.conv.name} seed={it.conv.id} size={42} isGroup={it.conv.isGroup} src={it.conv.avatarUrl} />
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center justify-between gap-2">
                            <span className="font-medium truncate text-[15px]">{it.conv.name}</span>
                            <span className="text-xs text-muted shrink-0">{formatDayLabel(it.r.createdAt)}</span>
                          </div>
                          <div className="text-[13px] text-muted truncate">
                            {it.r.senderId === user.id ? 'Вы: ' : it.r.isGroup ? `${it.r.senderName}: ` : ''}
                            <Highlighted text={it.r.snippet} needle={q} />
                          </div>
                        </div>
                      </button>
                    );
                  }
                  return (
                    <button {...common}>
                      <Avatar name={it.conv.name} seed={it.conv.id} size={42} online={it.conv.otherUser?.online} isGroup={it.conv.isGroup} src={it.conv.avatarUrl} />
                      <div className="flex-1 min-w-0">
                        <div className="font-medium truncate text-[15px]">
                          <Highlighted text={it.conv.name} needle={q} />
                        </div>
                        <div className="text-[13px] text-muted truncate">{it.conv.isGroup ? `${it.conv.members.length} участников` : 'Личный чат'}</div>
                      </div>
                    </button>
                  );
                })}
              </div>
            );
          })}
          {q && items.length === 0 && <div className="text-center text-muted text-sm py-10">Ничего не найдено</div>}
        </div>

        <div className="flex items-center gap-5 px-5 py-3 text-[13px] text-muted shrink-0" style={{ borderTop: '1px solid var(--border)' }}>
          <span>↑ ↓ выбрать</span>
          <span>Enter открыть</span>
        </div>
      </div>
    </div>
  );
}
