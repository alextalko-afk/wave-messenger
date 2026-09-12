import { useState } from 'react';
import Avatar from './Avatar.jsx';
import ProfileModal from './ProfileModal.jsx';
import ContextMenu from './ContextMenu.jsx';
import { formatTime } from '../lib/format.js';
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
      style={{ background: on ? 'var(--accent)' : 'var(--border)' }}
    >
      <span
        className="absolute top-0.5 w-5 h-5 rounded-full bg-white transition-transform"
        style={{ transform: on ? 'translateX(18px)' : 'translateX(2px)' }}
      />
    </span>
  );
}

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

export default function Sidebar({ conversations, activeId, onSelect, onNewChat, onAction }) {
  const { user, logout } = useAuth();
  const { theme, toggle } = useTheme();
  const [filter, setFilter] = useState('');
  const [menuOpen, setMenuOpen] = useState(false);
  const [profileOpen, setProfileOpen] = useState(false);
  const [contextMenu, setContextMenu] = useState(null);

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

  const filtered = conversations.filter((c) => c.name.toLowerCase().includes(filter.toLowerCase()));

  return (
    <div className="relative w-full sm:w-[360px] shrink-0 h-full flex flex-col bg-panel overflow-hidden">
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
          <Avatar name={user.displayName} seed={user.id} size={60} />
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

      <div className="flex items-center gap-1.5 px-2 pt-2.5 pb-2">
        <button
          onClick={() => setMenuOpen(true)}
          className="w-10 h-10 rounded-full hover:bg-hover flex items-center justify-center shrink-0 text-muted"
        >
          <IconMenu size={20} />
        </button>
        <div className="flex-1 relative">
          <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-muted">
            <IconSearch size={16} />
          </span>
          <input
            value={filter}
            onChange={(e) => setFilter(e.target.value)}
            placeholder="Поиск"
            className="w-full pl-9 pr-3 py-2.5 rounded-full bg-panel2 outline-none text-sm placeholder:text-muted focus:ring-2 focus:ring-accent/40"
          />
        </div>
      </div>

      <div className="flex-1 overflow-y-auto px-1.5 pb-2">
        {filtered.length === 0 && (
          <div className="text-center text-muted text-sm mt-10 px-6 leading-relaxed">
            Пока нет чатов.
            <br />
            Нажмите на меню, чтобы начать переписку.
          </div>
        )}
        {filtered.map((c) => {
          const lastMine = c.lastMessage && c.lastMessage.senderId === user.id;
          const isReadByOther = lastMine && !c.isGroup && (c.otherUser?.lastReadAt || 0) >= c.lastMessage.createdAt;
          return (
            <button
              key={c.id}
              onClick={() => onSelect(c.id)}
              onContextMenu={(e) => handleContextMenu(e, c)}
              className={`w-full flex items-center gap-3 px-2.5 py-2.5 rounded-xl text-left mb-0.5 transition-colors duration-150 ${
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
              />
              <div className="flex-1 min-w-0">
                <div className="flex items-center justify-between">
                  <span className="flex items-center gap-1 min-w-0">
                    {c.pinned && <IconPin size={12} className="text-muted shrink-0" />}
                    {c.isGroup && <IconUsers size={13} className="text-muted shrink-0" />}
                    <span className="font-medium truncate text-[15px]">{c.name}</span>
                    {c.muted && <IconBellOff size={12} className="text-muted shrink-0" />}
                  </span>
                  {c.lastMessage && (
                    <span className="flex items-center gap-0.5 shrink-0 ml-2 text-xs text-muted">
                      {lastMine && (
                        <span style={{ color: isReadByOther ? 'var(--check)' : 'var(--muted)', display: 'inline-flex' }}>
                          {isReadByOther ? <IconCheckAll size={14} /> : <IconCheck size={11} />}
                        </span>
                      )}
                      {formatTime(c.lastMessage.createdAt)}
                    </span>
                  )}
                </div>
                <div className="flex items-center justify-between mt-0.5">
                  <span className="text-sm text-muted truncate max-w-[220px]">
                    {c.isGroup && c.lastMessage ? `${c.lastMessage.senderName}: ` : ''}
                    {lastMessagePreview(c.lastMessage)}
                  </span>
                  {c.unreadCount > 0 && (
                    <span
                      className="text-white text-xs font-medium rounded-full min-w-[20px] h-5 px-1.5 flex items-center justify-center shrink-0 ml-2 pop-in"
                      style={{ background: c.muted ? 'var(--muted)' : 'var(--accent)' }}
                    >
                      {c.unreadCount}
                    </span>
                  )}
                </div>
              </div>
            </button>
          );
        })}
      </div>

      {profileOpen && <ProfileModal onClose={() => setProfileOpen(false)} />}

      {contextMenu && (
        <ContextMenu
          x={contextMenu.x}
          y={contextMenu.y}
          items={contextMenuItems(contextMenu.conv)}
          onClose={() => setContextMenu(null)}
        />
      )}
    </div>
  );
}
