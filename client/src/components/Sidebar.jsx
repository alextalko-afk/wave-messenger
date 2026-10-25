import { useEffect, useState } from 'react';
import Avatar from './Avatar.jsx';
import SettingsModal from './SettingsModal.jsx';
import CallHistoryModal from './CallHistoryModal.jsx';
import ContextMenu from './ContextMenu.jsx';
import { formatTime, formatDayLabel } from '../lib/format.js';
import { api } from '../lib/api.js';
import { getDraft, useDraftsVersion } from '../lib/drafts.js';
import { useAuth } from '../context/AuthContext.jsx';
import { useTheme } from '../context/ThemeContext.jsx';
import {
  IconSearch,
  IconSun,
  IconMoon,
  IconLogout,
  IconEdit,
  IconMenu,
  IconUsers,
  IconUser,
  IconGroup,
  IconCheck,
  IconCheckAll,
  IconClose,
  IconPin,
  IconBell,
  IconBellOff,
  IconMailUnread,
  IconEraser,
  IconTrash,
  IconPhone,
  IconPlus,
  IconSettings,
  IconChatLogo,
  IconChat,
} from './Icons.jsx';

function lastMessagePreview(lastMessage) {
  if (!lastMessage) return 'Нет сообщений';
  if (lastMessage.content) return lastMessage.content;
  if (lastMessage.fileType?.startsWith('audio/')) return 'Голосовое сообщение';
  if (lastMessage.fileType) return 'Файл';
  return '';
}

function Switch({ on }) {
  return (
    <span
      className="w-10 h-6 rounded-full relative shrink-0 transition-colors"
      style={{ background: on ? 'var(--accent-fill)' : 'var(--badge-muted)' }}
    >
      <span
        className="absolute top-0.5 w-5 h-5 rounded-full bg-white transition-transform"
        style={{ transform: on ? 'translateX(18px)' : 'translateX(2px)' }}
      />
    </span>
  );
}

function RailButton({ label, active, onClick, badge, children }) {
  return (
    <button
      onClick={onClick}
      aria-label={label}
      title={label}
      className={`relative w-12 h-12 rounded-2xl flex items-center justify-center transition-colors ${
        active ? '' : 'hover:bg-hover'
      }`}
      style={{ background: active ? 'var(--selected)' : 'transparent', color: active ? 'var(--accent)' : 'var(--muted)' }}
    >
      {children}
      {badge > 0 && (
        <span
          className="absolute top-0.5 right-0 min-w-[18px] h-[18px] px-1 rounded-full text-[11px] leading-[18px] font-semibold text-white text-center"
          style={{ background: 'var(--accent-fill)' }}
        >
          {badge > 99 ? '99+' : badge}
        </span>
      )}
    </button>
  );
}

const CHAT_TABS = [
  ['all', 'Все'],
  ['direct', 'Личные'],
  ['group', 'Группы'],
];

function MenuRow({ icon, label, danger, onClick, right }) {
  return (
    <button
      onClick={onClick}
      className="w-full flex items-center gap-4 px-5 py-3 text-left hover:bg-hover"
      style={{ color: danger ? '#f45b69' : 'var(--text)' }}
    >
      <span style={{ color: danger ? '#f45b69' : 'var(--muted)' }}>{icon}</span>
      <span className="flex-1 text-[15px]">{label}</span>
      {right}
    </button>
  );
}

const MIN_MESSAGE_SEARCH_LENGTH = 2;

export function Highlighted({ text, needle }) {
  const idx = text.toLowerCase().indexOf(needle.toLowerCase());
  if (idx === -1) return text;
  return (
    <>
      {text.slice(0, idx)}
      <mark className="rounded-sm px-px" style={{ background: 'var(--accent-fill)', color: '#fff' }}>
        {text.slice(idx, idx + needle.length)}
      </mark>
      {text.slice(idx + needle.length)}
    </>
  );
}

export default function Sidebar({ conversations, activeId, onSelect, onNewChat, onAction, onCreated }) {
  const { user, logout } = useAuth();
  const { resolvedTheme: theme, toggle } = useTheme();
  useDraftsVersion(); // re-render the list when a draft changes
  const [filter, setFilter] = useState('');
  const [menuOpen, setMenuOpen] = useState(false);
  const [profileOpen, setProfileOpen] = useState(false);
  const [callHistoryOpen, setCallHistoryOpen] = useState(false);
  const [contextMenu, setContextMenu] = useState(null);
  const [userResults, setUserResults] = useState([]);
  const [searchingUsers, setSearchingUsers] = useState(false);
  const [messageResults, setMessageResults] = useState([]);
  const [openingUserId, setOpeningUserId] = useState(null);
  const [tab, setTab] = useState('all');

  const trimmedFilter = filter.trim();

  useEffect(() => {
    if (!trimmedFilter) {
      setUserResults([]);
      setSearchingUsers(false);
      return;
    }
    setSearchingUsers(true);
    const t = setTimeout(() => {
      api
        .searchUsers(trimmedFilter)
        .then((r) => setUserResults(r.users.filter((u) => u.id !== user.id)))
        .catch(() => setUserResults([]))
        .finally(() => setSearchingUsers(false));
    }, 300);
    return () => clearTimeout(t);
  }, [trimmedFilter, user.id]);

  useEffect(() => {
    if (trimmedFilter.length < MIN_MESSAGE_SEARCH_LENGTH) {
      setMessageResults([]);
      return;
    }
    let cancelled = false;
    const t = setTimeout(() => {
      api
        .searchMessages(trimmedFilter)
        .then((r) => !cancelled && setMessageResults(r.results))
        .catch(() => !cancelled && setMessageResults([]));
    }, 300);
    return () => {
      cancelled = true;
      clearTimeout(t);
    };
  }, [trimmedFilter]);

  // Only hits in chats still in the list can be opened.
  const visibleMessageResults = messageResults
    .map((r) => ({ ...r, conversation: conversations.find((c) => c.id === r.conversationId) }))
    .filter((r) => r.conversation);

  async function openUser(u) {
    if (openingUserId) return;
    setOpeningUserId(u.id);
    try {
      const { conversation } = await api.createDirect(u.id);
      onCreated(conversation);
      setFilter('');
    } finally {
      setOpeningUserId(null);
    }
  }

  function handleContextMenu(e, conv) {
    e.preventDefault();
    setContextMenu({ x: e.clientX, y: e.clientY, conv });
  }

  function contextMenuItems(conv) {
    return [
      {
        icon: <IconPin size={16} />,
        label: conv.pinned ? 'Открепить' : 'Закрепить',
        onClick: () => onAction('pin', conv),
      },
      {
        icon: conv.muted ? <IconBell size={16} /> : <IconBellOff size={16} />,
        label: conv.muted ? 'Включить уведомления' : 'Выключить уведомления',
        onClick: () => onAction('mute', conv),
      },
      {
        icon: conv.unreadCount > 0 ? <IconCheckAll size={16} /> : <IconMailUnread size={16} />,
        label: conv.unreadCount > 0 ? 'Пометить как прочитанное' : 'Пометить как непрочитанное',
        onClick: () => onAction('toggleRead', conv),
      },
      { divider: true },
      {
        icon: <IconEraser size={16} />,
        label: 'Очистить историю',
        onClick: () => onAction('clear', conv),
      },
      {
        icon: <IconTrash size={16} />,
        label: 'Удалить чат',
        danger: true,
        onClick: () => onAction('delete', conv),
      },
    ];
  }

  const filtered = conversations.filter(
    (c) =>
      (tab === 'all' || (tab === 'group' ? c.isGroup : !c.isGroup)) && c.name.toLowerCase().includes(filter.toLowerCase())
  );
  const totalUnread = conversations.reduce((n, c) => n + (c.muted ? 0 : c.unreadCount || 0), 0);

  return (
    <div className="relative w-full sm:w-[436px] shrink-0 h-full flex bg-panel overflow-hidden">
      <nav
        aria-label="Разделы"
        className="hidden sm:flex w-[76px] shrink-0 flex-col items-center py-4 gap-2.5 border-r bg-rail"
        style={{ borderColor: 'var(--border)' }}
      >
        <div
          className="w-11 h-11 rounded-[14px] flex items-center justify-center text-white mb-3"
          style={{ background: 'var(--accent-fill)' }}
        >
          <IconChatLogo size={26} />
        </div>
        <RailButton label="Чаты" active badge={totalUnread}>
          <IconChat size={24} />
        </RailButton>
        <RailButton label="Звонки" onClick={() => setCallHistoryOpen(true)}>
          <IconPhone size={24} />
        </RailButton>
        <RailButton label="Новая группа" onClick={() => onNewChat('group')}>
          <IconGroup size={24} />
        </RailButton>
        <div className="flex-1" />
        <RailButton label={theme === 'dark' ? 'Светлая тема' : 'Тёмная тема'} onClick={toggle}>
          {theme === 'dark' ? <IconSun size={22} /> : <IconMoon size={22} />}
        </RailButton>
        <RailButton label="Настройки" onClick={() => setProfileOpen(true)}>
          <IconSettings size={22} />
        </RailButton>
        <RailButton label="Выйти" onClick={logout}>
          <IconLogout size={22} />
        </RailButton>
        <button onClick={() => setProfileOpen(true)} aria-label="Мой профиль" className="mt-1 rounded-full">
          <Avatar name={user.displayName} seed={user.id} size={44} online src={user.avatarUrl} />
        </button>
      </nav>

      <div className="relative flex-1 min-w-0 h-full flex flex-col bg-panel overflow-hidden">
      <div
        className={`fixed inset-0 z-40 transition-opacity duration-200 ${
          menuOpen ? 'opacity-100 pointer-events-auto' : 'opacity-0 pointer-events-none'
        }`}
        style={{ background: 'rgba(0,0,0,0.45)' }}
        onClick={() => setMenuOpen(false)}
      />

      <div
        className="absolute top-0 left-0 h-full z-50 flex flex-col transition-transform duration-200 ease-out"
        style={{
          width: 260,
          background: 'var(--panel)',
          transform: menuOpen ? 'translateX(0)' : 'translateX(-100%)',
          boxShadow: menuOpen ? '4px 0 24px rgba(0,0,0,0.35)' : 'none',
        }}
      >
        <div className="flex items-center px-2 pt-2.5 pb-1">
          <button
            onClick={() => setMenuOpen(false)}
            className="w-10 h-10 rounded-full hover:bg-hover flex items-center justify-center shrink-0 text-muted"
          >
            <IconClose size={18} />
          </button>
        </div>

        <div className="px-4 pt-2 pb-4">
          <Avatar name={user.displayName} seed={user.id} size={60} src={user.avatarUrl} />
          <div className="mt-2.5 font-semibold text-[15px] truncate">{user.displayName}</div>
          <div className="text-xs text-muted truncate">@{user.username}</div>
        </div>

        <div style={{ borderTop: '1px solid var(--border)' }} />

        <div className="flex-1 overflow-y-auto py-2">
          <MenuRow
            icon={<IconUser size={18} />}
            label="Мой профиль"
            onClick={() => {
              setProfileOpen(true);
              setMenuOpen(false);
            }}
          />
          <MenuRow
            icon={<IconEdit size={17} />}
            label="Новый чат"
            onClick={() => {
              onNewChat('direct');
              setMenuOpen(false);
            }}
          />
          <MenuRow
            icon={<IconGroup size={18} />}
            label="Новая группа"
            onClick={() => {
              onNewChat('group');
              setMenuOpen(false);
            }}
          />
          <MenuRow
            icon={<IconPhone size={17} />}
            label="Звонки"
            onClick={() => {
              setCallHistoryOpen(true);
              setMenuOpen(false);
            }}
          />
          <div className="my-2" style={{ borderTop: '1px solid var(--border)' }} />
          <MenuRow
            icon={theme === 'dark' ? <IconMoon size={17} /> : <IconSun size={17} />}
            label="Тёмная тема"
            onClick={toggle}
            right={<Switch on={theme === 'dark'} />}
          />
          <MenuRow icon={<IconLogout size={17} />} label="Выйти" danger onClick={logout} />
        </div>

        <div className="px-4 py-3 text-[11px] text-muted" style={{ borderTop: '1px solid var(--border)' }}>
          Wave Desktop
          <br />
          Версия 1.0.0
        </div>
      </div>

      <div className="flex items-center gap-2 px-4 sm:px-5 pt-4 pb-3">
        <button
          onClick={() => setMenuOpen(true)}
          aria-label="Меню"
          className="sm:hidden w-10 h-10 -ml-2 rounded-full hover:bg-hover flex items-center justify-center shrink-0 text-muted"
        >
          <IconMenu size={22} />
        </button>
        <h1 className="flex-1 font-display text-2xl leading-[30px] font-bold">Чаты</h1>
        <button
          onClick={() => onNewChat('direct')}
          aria-label="Новый чат"
          title="Новый чат"
          className="w-10 h-10 rounded-xl flex items-center justify-center bg-panel2 hover:opacity-80"
        >
          <IconPlus size={20} />
        </button>
      </div>

      <div className="px-4 pb-3">
        <label className="relative block">
          <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-muted">
            <IconSearch size={18} />
          </span>
          <input
            value={filter}
            onChange={(e) => setFilter(e.target.value)}
            placeholder="Поиск людей и сообщений"
            aria-label="Поиск"
            className="w-full h-11 pl-10 pr-3 rounded-[14px] bg-panel2 outline-none text-sm placeholder:text-muted focus:ring-2 focus:ring-accent/40"
          />
        </label>
      </div>

      <div className="flex gap-2 px-4 pb-2.5" role="tablist" aria-label="Фильтр чатов">
        {CHAT_TABS.map(([id, label]) => (
          <button
            key={id}
            role="tab"
            aria-selected={tab === id}
            onClick={() => setTab(id)}
            className="px-3.5 py-1.5 rounded-full text-[13px] font-medium transition-colors"
            style={{
              background: tab === id ? 'var(--accent-fill)' : 'var(--panel2)',
              color: tab === id ? '#ffffff' : 'var(--text)',
            }}
          >
            {label}
          </button>
        ))}
      </div>

      <div className="flex-1 overflow-y-auto px-2 pb-2">
        {!trimmedFilter && filtered.length === 0 && (
          <div className="text-center text-muted text-sm mt-10 px-6 leading-relaxed">
            Пока нет чатов.
            <br />
            Нажмите «+», чтобы начать переписку.
          </div>
        )}
        {trimmedFilter && !searchingUsers && filtered.length === 0 && userResults.length === 0 && visibleMessageResults.length === 0 && (
          <div className="text-center text-muted text-sm mt-10 px-6 leading-relaxed">Никого не найдено</div>
        )}
        {filtered.map((c) => {
          const lastMine = c.lastMessage && c.lastMessage.senderId === user.id;
          const isReadByOther = lastMine && !c.isGroup && (c.otherUser?.lastReadAt || 0) >= c.lastMessage.createdAt;
          const isDeliveredToOther =
            lastMine && !c.isGroup && (c.otherUser?.lastDeliveredAt || 0) >= c.lastMessage.createdAt;
          return (
            <button
              key={c.id}
              onClick={() => onSelect(c.id)}
              onContextMenu={(e) => handleContextMenu(e, c)}
              className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-2xl text-left mb-0.5 transition-colors duration-150 ${
                activeId === c.id ? '' : 'hover:bg-[var(--hover)]'
              }`}
              style={{ background: activeId === c.id ? 'var(--selected)' : 'transparent' }}
            >
              <Avatar
                name={c.name}
                seed={c.id}
                size={52}
                online={c.otherUser?.online}
                isGroup={c.isGroup}
                src={c.avatarUrl}
              />
              <div className="flex-1 min-w-0">
                <div className="flex items-center justify-between">
                  <span className="flex items-center gap-1 min-w-0">
                    {c.pinned && <IconPin size={12} className="text-muted shrink-0" />}
                    {c.isGroup && <IconUsers size={13} className="text-muted shrink-0" />}
                    <span className="font-semibold truncate text-[15px]">{c.name}</span>
                    {c.muted && <IconBellOff size={12} className="text-muted shrink-0" />}
                  </span>
                  {c.lastMessage && (
                    <span className="flex items-center gap-0.5 shrink-0 ml-2 text-xs text-muted">
                      {lastMine && (
                        <span style={{ color: isReadByOther ? 'var(--check)' : 'var(--muted)', display: 'inline-flex' }}>
                          {isReadByOther || isDeliveredToOther ? <IconCheckAll size={14} /> : <IconCheck size={11} />}
                        </span>
                      )}
                      {formatTime(c.lastMessage.createdAt)}
                    </span>
                  )}
                </div>
                <div className="flex items-center justify-between mt-0.5">
                  {activeId !== c.id && getDraft(c.id) ? (
                    <span className="text-sm text-muted truncate max-w-[220px]">
                      <span style={{ color: '#f45b69' }}>Черновик: </span>
                      {getDraft(c.id)}
                    </span>
                  ) : (
                    <span className="text-sm text-muted truncate max-w-[220px]">
                      {c.isGroup && c.lastMessage ? `${c.lastMessage.senderName}: ` : ''}
                      {lastMessagePreview(c.lastMessage)}
                    </span>
                  )}
                  {c.unreadCount > 0 && (
                    <span
                      className="text-white text-xs font-medium rounded-full min-w-[20px] h-5 px-1.5 flex items-center justify-center shrink-0 ml-2 pop-in"
                      style={{ background: c.muted ? 'var(--badge-muted)' : 'var(--accent-fill)' }}
                    >
                      {c.unreadCount}
                    </span>
                  )}
                </div>
              </div>
            </button>
          );
        })}

        {visibleMessageResults.length > 0 && (
          <>
            <div className="px-3 pt-3 pb-1.5 text-xs font-medium text-muted uppercase tracking-wide">
              Сообщения
            </div>
            {visibleMessageResults.map((r) => (
              <button
                key={r.id}
                onClick={() => onSelect(r.conversationId)}
                className="w-full flex items-center gap-3 px-2.5 py-2.5 rounded-xl text-left mb-0.5 hover:bg-[var(--hover)]"
              >
                <Avatar
                  name={r.conversation.name}
                  seed={r.conversation.id}
                  size={44}
                  isGroup={r.conversation.isGroup}
                  src={r.conversation.avatarUrl}
                />
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between gap-2">
                    <span className="font-medium truncate text-[15px]">{r.conversation.name}</span>
                    <span className="text-xs text-muted shrink-0">{formatDayLabel(r.createdAt)}</span>
                  </div>
                  <div className="text-sm text-muted truncate">
                    {r.senderId === user.id ? 'Вы: ' : r.isGroup ? `${r.senderName}: ` : ''}
                    <Highlighted text={r.snippet} needle={trimmedFilter} />
                  </div>
                </div>
              </button>
            ))}
          </>
        )}

        {trimmedFilter && userResults.length > 0 && (
          <>
            <div className="px-3 pt-3 pb-1.5 text-xs font-medium text-muted uppercase tracking-wide">
              Глобальный поиск
            </div>
            {userResults.map((u) => (
              <button
                key={u.id}
                disabled={openingUserId === u.id}
                onClick={() => openUser(u)}
                className="w-full flex items-center gap-3 px-2.5 py-2.5 rounded-xl text-left mb-0.5 hover:bg-[var(--hover)] disabled:opacity-60"
              >
                <Avatar name={u.displayName} seed={u.id} size={52} online={u.online} src={u.avatarUrl} />
                <div className="flex-1 min-w-0">
                  <div className="font-medium truncate text-[15px]">{u.displayName}</div>
                  <div className="text-sm text-muted truncate">@{u.username}</div>
                </div>
              </button>
            ))}
          </>
        )}
      </div>

      {profileOpen && <SettingsModal onClose={() => setProfileOpen(false)} />}
      {callHistoryOpen && <CallHistoryModal onClose={() => setCallHistoryOpen(false)} />}

      {contextMenu && (
        <ContextMenu
          x={contextMenu.x}
          y={contextMenu.y}
          items={contextMenuItems(contextMenu.conv)}
          onClose={() => setContextMenu(null)}
        />
      )}
      </div>
    </div>
  );
}
