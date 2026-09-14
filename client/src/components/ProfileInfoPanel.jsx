import { useEffect, useRef, useState } from 'react';
import { api } from '../lib/api.js';
import Avatar from './Avatar.jsx';
import AvatarLightbox from './AvatarLightbox.jsx';
import { useCall } from '../context/CallContext.jsx';
import { useAuth } from '../context/AuthContext.jsx';
import { resizeImageFile } from '../lib/imageResize.js';
import VoiceMessage from './VoiceMessage.jsx';
import { formatLastSeen, formatDayLabel, pluralRu } from '../lib/format.js';
import {
  IconClose,
  IconImage,
  IconFile,
  IconMic,
  IconUsers,
  IconGroup,
  IconBack,
  IconEdit,
  IconBell,
  IconBellOff,
  IconMailUnread,
  IconCheckAll,
  IconEraser,
  IconTrash,
  IconMoreDots,
  IconChatLogo,
  IconPhone,
} from './Icons.jsx';

function StatRow({ icon, count, words, onClick }) {
  if (!count) return null;
  return (
    <button onClick={onClick} className="w-full flex items-center gap-4 px-4 py-3 hover:bg-hover text-left">
      <span className="text-muted">{icon}</span>
      <span className="text-[15px]">
        {count} {pluralRu(count, words)}
      </span>
    </button>
  );
}

function SubHeader({ title, onBack }) {
  return (
    <div className="flex items-center gap-3 px-2 pt-2.5 pb-2 shrink-0" style={{ borderBottom: '1px solid var(--border)' }}>
      <button onClick={onBack} className="w-10 h-10 rounded-full hover:bg-hover flex items-center justify-center shrink-0 text-muted">
        <IconBack size={20} />
      </button>
      <div className="font-semibold text-[15px]">{title}</div>
    </div>
  );
}

function ActionButton({ icon, label, onClick, disabled, title }) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      title={title}
      className="flex-1 flex flex-col items-center justify-center gap-1.5 py-3 rounded-lg hover:brightness-125 disabled:opacity-40 transition-all outline-none focus:outline-none focus-visible:outline-none ring-0 focus:ring-0"
      style={{ background: 'var(--panel2)', color: 'var(--accent)', minWidth: 0 }}
    >
      {icon}
      <span className="text-[11px] text-text truncate max-w-full px-1">{label}</span>
    </button>
  );
}

export default function ProfileInfoPanel({ conversation, open, onClose, onOpenConversation, onAction, onConversationUpdate }) {
  const call = useCall();
  const { user } = useAuth();
  const [lightboxSrc, setLightboxSrc] = useState(null);
  const [groupAvatarBusy, setGroupAvatarBusy] = useState(false);
  const [groupAvatarError, setGroupAvatarError] = useState('');
  const groupAvatarInputRef = useRef(null);
  const isGroupAdmin =
    conversation.isGroup && conversation.members?.some((m) => m.id === user.id && m.role === 'admin');

  async function handleGroupAvatarPick(e) {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    setGroupAvatarBusy(true);
    setGroupAvatarError('');
    try {
      const resized = await resizeImageFile(file);
      const { conversation: updated } = await api.uploadGroupAvatar(conversation.id, resized);
      onConversationUpdate?.(conversation.id, { avatarUrl: updated.avatarUrl });
    } catch (err) {
      setGroupAvatarError(err.message);
    } finally {
      setGroupAvatarBusy(false);
    }
  }

  async function handleGroupAvatarDelete() {
    setGroupAvatarBusy(true);
    setGroupAvatarError('');
    try {
      const { conversation: updated } = await api.deleteGroupAvatar(conversation.id);
      onConversationUpdate?.(conversation.id, { avatarUrl: updated.avatarUrl });
    } catch (err) {
      setGroupAvatarError(err.message);
    } finally {
      setGroupAvatarBusy(false);
    }
  }
  const [stats, setStats] = useState(null);
  const [subView, setSubView] = useState(null); // 'photos' | 'files' | 'voice' | 'groups' | 'member'
  const [subItems, setSubItems] = useState(null);
  const [subLoading, setSubLoading] = useState(false);
  const [activeMember, setActiveMember] = useState(null);
  const [messagingBusy, setMessagingBusy] = useState(false);
  const [moreOpen, setMoreOpen] = useState(false);

  useEffect(() => {
    if (!open || !conversation) return;
    setStats(null);
    setSubView(null);
    setSubItems(null);
    setActiveMember(null);
    setMoreOpen(false);
    api.getConversationStats(conversation.id).then(setStats).catch(() => {});
  }, [open, conversation?.id]);

  if (!open || !conversation) return null;

  function openSubView(view) {
    setMoreOpen(false);
    setSubView(view);
    setSubLoading(true);
    const req =
      view === 'groups'
        ? api.getSharedGroups(conversation.id).then((r) => r.groups)
        : api.getConversationMedia(conversation.id, view).then((r) => r.items);
    req.then(setSubItems).finally(() => setSubLoading(false));
  }

  function openMember(member) {
    setActiveMember(member);
    setSubView('member');
  }

  async function handleMessageMember() {
    if (!activeMember) return;
    setMessagingBusy(true);
    try {
      const { conversation: conv } = await api.createDirect(activeMember.id);
      onOpenConversation?.(conv.id);
      onClose();
    } finally {
      setMessagingBusy(false);
    }
  }

  function runAction(action) {
    setMoreOpen(false);
    onAction?.(action, conversation);
    if (action === 'delete') onClose();
  }

  const subtitle = conversation.isGroup
    ? `${conversation.members.length} ${pluralRu(conversation.members.length, ['участник', 'участника', 'участников'])}`
    : conversation.otherUser?.online
    ? 'в сети'
    : formatLastSeen(conversation.otherUser?.lastSeen);

  return (
    <>
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4" onClick={onClose}>
      <div
        className="w-full max-w-[380px] max-h-[85vh] rounded-2xl flex flex-col overflow-hidden pop-in"
        style={{
          background: 'var(--overlay)',
          boxShadow: '0 20px 60px rgba(0,0,0,0.5)',
          border: '1px solid var(--border)',
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {subView ? (
          <>
            <SubHeader
              title={
                subView === 'photos'
                  ? 'Фотографии'
                  : subView === 'files'
                  ? 'Файлы'
                  : subView === 'voice'
                  ? 'Голосовые сообщения'
                  : subView === 'member'
                  ? 'Профиль'
                  : 'Общие группы'
              }
              onBack={() => setSubView(null)}
            />
            <div className="flex-1 overflow-y-auto">
              {subView === 'member' && activeMember && (
                <>
                  <div className="flex flex-col items-center px-4 pt-5 pb-4">
                    <button
                      onClick={() => activeMember.avatarUrl && setLightboxSrc(activeMember.avatarUrl)}
                      className="rounded-full"
                      style={{ cursor: activeMember.avatarUrl ? 'pointer' : 'default' }}
                    >
                      <Avatar name={activeMember.displayName} seed={activeMember.id} size={88} online={activeMember.online} src={activeMember.avatarUrl} />
                    </button>
                    <div className="mt-3 font-semibold text-lg text-center truncate max-w-full">
                      {activeMember.displayName}
                    </div>
                    <div className="text-sm text-muted mt-0.5">
                      {activeMember.online ? 'в сети' : formatLastSeen(activeMember.lastSeen)}
                    </div>
                    <div className="w-full mt-4">
                      <ActionButton
                        icon={<IconEdit size={19} />}
                        label="Написать"
                        onClick={handleMessageMember}
                        disabled={messagingBusy}
                      />
                    </div>
                  </div>
                  <div style={{ borderTop: '1px solid var(--border)' }} />
                  <div className="px-4 py-3">
                    <div className="text-[15px]">@{activeMember.username}</div>
                    <div className="text-xs text-muted mt-0.5">Логин</div>
                  </div>
                  {activeMember.bio && (
                    <div className="px-4 py-3">
                      <div className="text-[15px] whitespace-pre-wrap">{activeMember.bio}</div>
                      <div className="text-xs text-muted mt-0.5">О себе</div>
                    </div>
                  )}
                </>
              )}

              {subLoading && <div className="text-center text-muted text-sm mt-8">Загрузка…</div>}

              {!subLoading && subView === 'photos' && (
                <div className="grid grid-cols-3 gap-1 p-1">
                  {subItems?.map((item) => (
                    <a key={item.id} href={item.fileUrl} target="_blank" rel="noreferrer" className="aspect-square block">
                      <img src={item.fileUrl} alt="" className="w-full h-full object-cover rounded" />
                    </a>
                  ))}
                </div>
              )}

              {!subLoading && subView === 'files' && (
                <div className="py-1">
                  {subItems?.map((item) => (
                    <a
                      key={item.id}
                      href={item.fileUrl}
                      target="_blank"
                      rel="noreferrer"
                      className="flex items-center gap-3 px-4 py-2.5 hover:bg-hover"
                    >
                      <IconFile size={20} className="text-muted shrink-0" />
                      <div className="min-w-0">
                        <div className="text-sm truncate">{item.fileName || 'Файл'}</div>
                        <div className="text-xs text-muted">{formatDayLabel(item.createdAt)}</div>
                      </div>
                    </a>
                  ))}
                </div>
              )}

              {!subLoading && subView === 'voice' && (
                <div className="py-1">
                  {subItems?.map((item) => (
                    <div key={item.id} className="px-4 py-2 border-b" style={{ borderColor: 'var(--border)' }}>
                      <VoiceMessage url={item.fileUrl} isMine={false} />
                      <div className="text-xs text-muted -mt-1">{formatDayLabel(item.createdAt)}</div>
                    </div>
                  ))}
                </div>
              )}

              {!subLoading && subView === 'groups' && (
                <div className="py-1">
                  {subItems?.map((g) => (
                    <button
                      key={g.id}
                      onClick={() => {
                        onOpenConversation?.(g.id);
                        onClose();
                      }}
                      className="w-full flex items-center gap-3 px-4 py-2.5 hover:bg-hover text-left"
                    >
                      <Avatar name={g.name} seed={g.id} size={44} isGroup />
                      <div className="min-w-0">
                        <div className="text-sm truncate">{g.name}</div>
                        <div className="text-xs text-muted">
                          {g.memberCount} {pluralRu(g.memberCount, ['участник', 'участника', 'участников'])}
                        </div>
                      </div>
                    </button>
                  ))}
                </div>
              )}

              {!subLoading && subItems?.length === 0 && (
                <div className="text-center text-muted text-sm mt-8">Пусто</div>
              )}
            </div>
          </>
        ) : (
          <>
            <div className="relative flex flex-col items-center px-5 pt-6 pb-4 shrink-0">
              <button
                onClick={onClose}
                className="absolute top-2 right-2 w-9 h-9 rounded-full hover:bg-hover flex items-center justify-center text-muted"
              >
                <IconClose size={17} />
              </button>
              <div className="relative">
                <button
                  onClick={() => {
                    if (isGroupAdmin) groupAvatarInputRef.current?.click();
                    else if (conversation.avatarUrl) setLightboxSrc(conversation.avatarUrl);
                  }}
                  disabled={groupAvatarBusy}
                  className="rounded-full disabled:opacity-60"
                  style={{ cursor: isGroupAdmin || conversation.avatarUrl ? 'pointer' : 'default' }}
                >
                  <Avatar name={conversation.name} seed={conversation.id} size={88} isGroup={conversation.isGroup} src={conversation.avatarUrl} />
                  {isGroupAdmin && (
                    <span
                      className="absolute -bottom-0.5 -right-0.5 w-7 h-7 rounded-full flex items-center justify-center"
                      style={{ background: 'var(--accent)', border: '2px solid var(--overlay)' }}
                    >
                      <IconEdit size={13} className="text-white" />
                    </span>
                  )}
                </button>
                {isGroupAdmin && (
                  <input
                    ref={groupAvatarInputRef}
                    type="file"
                    accept="image/*"
                    className="hidden"
                    onChange={handleGroupAvatarPick}
                  />
                )}
              </div>
              {isGroupAdmin && groupAvatarBusy && <div className="text-xs text-muted mt-1">Загружаем…</div>}
              {isGroupAdmin && groupAvatarError && <div className="text-xs text-red-400 mt-1">{groupAvatarError}</div>}
              {isGroupAdmin && conversation.avatarUrl && !groupAvatarBusy && (
                <button onClick={handleGroupAvatarDelete} className="text-xs text-red-400 hover:underline mt-1">
                  Удалить фото группы
                </button>
              )}
              <div className="mt-3 font-semibold text-lg text-center truncate max-w-full">{conversation.name}</div>
              <div className="text-sm text-muted mt-0.5">{subtitle}</div>

              <div className="w-full flex gap-2 mt-4 relative">
                <ActionButton icon={<IconChatLogo size={19} />} label="Чат" onClick={onClose} />
                <ActionButton
                  icon={conversation.muted ? <IconBellOff size={19} /> : <IconBell size={19} />}
                  label="Звук"
                  onClick={() => runAction('mute')}
                />
                {conversation.otherUser && (
                  <ActionButton
                    icon={<IconPhone size={19} />}
                    label="Звонок"
                    disabled={call.state.status !== 'idle'}
                    onClick={() => {
                      call.startCall(conversation, 'audio');
                      onClose();
                    }}
                  />
                )}
                <div className="flex-1 relative">
                  <ActionButton icon={<IconMoreDots size={19} />} label="Ещё" onClick={() => setMoreOpen((v) => !v)} />
                  {moreOpen && (
                    <>
                      <div className="fixed inset-0 z-10" onClick={() => setMoreOpen(false)} />
                      <div
                        className="absolute top-full mt-1 right-0 w-56 rounded-xl py-1.5 z-20 pop-in"
                        style={{ background: 'var(--panel2)', boxShadow: '0 8px 24px rgba(0,0,0,0.4)', border: '1px solid var(--border)' }}
                      >
                        <button
                          onClick={() => runAction('toggleRead')}
                          className="w-full text-left px-3.5 py-2.5 text-sm hover:bg-hover flex items-center gap-2.5"
                        >
                          {conversation.unreadCount > 0 ? <IconCheckAll size={16} /> : <IconMailUnread size={16} />}
                          {conversation.unreadCount > 0 ? 'Пометить как прочитанное' : 'Пометить как непрочитанное'}
                        </button>
                        <button
                          onClick={() => runAction('clear')}
                          className="w-full text-left px-3.5 py-2.5 text-sm hover:bg-hover flex items-center gap-2.5"
                        >
                          <IconEraser size={16} />
                          Очистить историю
                        </button>
                        <button
                          onClick={() => runAction('delete')}
                          className="w-full text-left px-3.5 py-2.5 text-sm hover:bg-hover flex items-center gap-2.5"
                          style={{ color: '#f45b69' }}
                        >
                          <IconTrash size={16} />
                          Удалить чат
                        </button>
                      </div>
                    </>
                  )}
                </div>
              </div>
            </div>

            <div style={{ borderTop: '1px solid var(--border)' }} />

            <div className="flex-1 overflow-y-auto">
              {!conversation.isGroup && (
                <>
                  <div className="px-4 py-3">
                    <div className="text-[15px]">@{conversation.otherUser?.username}</div>
                    <div className="text-xs text-muted mt-0.5">Логин</div>
                  </div>
                  {conversation.otherUser?.bio && (
                    <div className="px-4 py-3">
                      <div className="text-[15px] whitespace-pre-wrap">{conversation.otherUser.bio}</div>
                      <div className="text-xs text-muted mt-0.5">О себе</div>
                    </div>
                  )}
                  <div style={{ borderTop: '1px solid var(--border)' }} />
                </>
              )}

              {stats && (
                <div className="py-1">
                  <StatRow
                    icon={<IconImage size={18} />}
                    count={stats.photos}
                    words={['фотография', 'фотографии', 'фотографий']}
                    onClick={() => openSubView('photos')}
                  />
                  <StatRow
                    icon={<IconFile size={18} />}
                    count={stats.files}
                    words={['файл', 'файла', 'файлов']}
                    onClick={() => openSubView('files')}
                  />
                  <StatRow
                    icon={<IconMic size={18} />}
                    count={stats.voice}
                    words={['голосовое сообщение', 'голосовых сообщения', 'голосовых сообщений']}
                    onClick={() => openSubView('voice')}
                  />
                  {!conversation.isGroup && (
                    <StatRow
                      icon={<IconGroup size={18} />}
                      count={stats.sharedGroups}
                      words={['общая группа', 'общие группы', 'общих групп']}
                      onClick={() => openSubView('groups')}
                    />
                  )}
                </div>
              )}

              {conversation.isGroup && (
                <>
                  <div style={{ borderTop: '1px solid var(--border)' }} />
                  <div className="px-4 py-2.5 text-xs text-muted flex items-center gap-2">
                    <IconUsers size={13} />
                    {conversation.members.length}{' '}
                    {pluralRu(conversation.members.length, ['участник', 'участника', 'участников'])}
                  </div>
                  {conversation.members.map((m) => (
                    <button
                      key={m.id}
                      onClick={() => openMember(m)}
                      className="w-full flex items-center gap-3 px-4 py-2 hover:bg-hover text-left"
                    >
                      <Avatar name={m.displayName} seed={m.id} size={40} online={m.online} src={m.avatarUrl} />
                      <div className="min-w-0">
                        <div className="text-sm truncate">{m.displayName}</div>
                        <div className="text-xs text-muted truncate">@{m.username}</div>
                      </div>
                    </button>
                  ))}
                </>
              )}
            </div>
          </>
        )}
      </div>
    </div>
    <AvatarLightbox src={lightboxSrc} onClose={() => setLightboxSrc(null)} />
    </>
  );
}
