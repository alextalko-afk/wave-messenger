import { useEffect, useRef, useState } from 'react';
import { api } from '../lib/api.js';
import { useAuth } from '../context/AuthContext.jsx';
import { useTheme } from '../context/ThemeContext.jsx';
import { renderGoogleButton } from '../lib/googleAuth.js';
import { resizeImageFile } from '../lib/imageResize.js';
import Avatar from './Avatar.jsx';
import TwoFactorSettings from './TwoFactorSettings.jsx';
import { IconEdit, IconUser, IconPalette, IconLock, IconLogout, IconClose, IconCheck } from './Icons.jsx';

function GoogleBadge({ size = 20 }) {
  return (
    <span
      className="inline-flex items-center justify-center rounded-full font-bold"
      style={{ width: size, height: size, fontSize: size * 0.55, background: 'currentColor' }}
      aria-hidden="true"
    >
      <span style={{ color: 'var(--overlay)' }}>G</span>
    </span>
  );
}

const SECTIONS = [
  { id: 'profile', label: 'Профиль', Icon: IconUser },
  { id: 'appearance', label: 'Внешний вид', Icon: IconPalette },
  { id: 'security', label: 'Безопасность', Icon: IconLock },
  { id: 'google', label: 'Вход через Google', Icon: GoogleBadge },
];

const THEMES = [
  ['system', 'Системная'],
  ['light', 'Светлая'],
  ['dark', 'Тёмная'],
];

const PREVIEW_COLORS = {
  light: { bg: '#e6edf5', panel: '#ffffff', incoming: '#ffffff', line: '#cbd5e1' },
  dark: { bg: '#0c131b', panel: '#0f1620', incoming: '#17212c', line: '#2b3a4b' },
};

function MiniChat({ colors }) {
  return (
    <div className="w-full h-full flex" style={{ background: colors.bg }}>
      <div className="w-4 h-full shrink-0" style={{ background: colors.panel }} />
      <div className="flex-1 p-2 flex flex-col justify-end gap-1.5">
        <span className="block h-2.5 w-3/5 rounded-md" style={{ background: colors.incoming }} />
        <span className="block h-2.5 w-2/5 rounded-md self-end" style={{ background: '#2563eb' }} />
        <span className="block h-2.5 w-1/2 rounded-md" style={{ background: colors.incoming }} />
      </div>
    </div>
  );
}

function ThemePreview({ kind }) {
  if (kind !== 'system') return <MiniChat colors={PREVIEW_COLORS[kind]} />;
  return (
    <div className="relative w-full h-full">
      <div className="absolute inset-0" style={{ clipPath: 'inset(0 50% 0 0)' }}>
        <MiniChat colors={PREVIEW_COLORS.light} />
      </div>
      <div className="absolute inset-0" style={{ clipPath: 'inset(0 0 0 50%)' }}>
        <MiniChat colors={PREVIEW_COLORS.dark} />
      </div>
    </div>
  );
}

function Notice({ tone = 'muted', children }) {
  if (!children) return null;
  const styles = {
    error: { color: '#f87171', background: 'rgba(248,113,113,0.12)' },
    success: { color: 'var(--online)', background: 'transparent' },
    muted: { color: 'var(--muted)', background: 'transparent' },
  }[tone];
  return (
    <div className="text-sm rounded-xl px-3 py-2 flex items-center gap-1.5" style={styles} role={tone === 'error' ? 'alert' : 'status'}>
      {tone === 'success' && <IconCheck size={14} />}
      {children}
    </div>
  );
}

function Field({ id, label, hint, children }) {
  return (
    <div className="flex flex-col gap-1.5">
      <label htmlFor={id} className="text-[13px] font-medium text-muted">
        {label}
      </label>
      {children}
      {hint && <span className="text-xs text-muted">{hint}</span>}
    </div>
  );
}

const inputClass =
  'w-full h-12 px-3.5 rounded-xl outline-none focus:ring-2 focus:ring-accent/40 text-[15px] border';
const inputStyle = { background: 'var(--panel2)', borderColor: 'var(--border)' };

function Button({ variant = 'primary', className = '', ...props }) {
  const style =
    variant === 'primary'
      ? { background: 'var(--accent-fill)', color: '#fff' }
      : variant === 'danger'
      ? { background: 'transparent', color: '#f87171', border: '1px solid rgba(248,113,113,0.45)' }
      : { background: 'var(--panel2)', color: 'var(--text)' };
  return (
    <button
      {...props}
      className={`h-12 px-5 rounded-xl font-medium text-[15px] hover:opacity-90 transition disabled:opacity-50 disabled:cursor-not-allowed ${className}`}
      style={style}
    />
  );
}

function SectionTitle({ title, children }) {
  return (
    <header className="mb-6">
      <h3 className="font-display text-[22px] leading-7 font-bold">{title}</h3>
      {children && <p className="mt-1 text-sm text-muted">{children}</p>}
    </header>
  );
}

export default function SettingsModal({ onClose }) {
  const { user, setUser, linkGoogle, logout } = useAuth();
  const { theme, setTheme } = useTheme();
  const [section, setSection] = useState('profile');

  const [displayName, setDisplayName] = useState(user.displayName);
  const [username, setUsername] = useState(user.username);
  const [bio, setBio] = useState(user.bio || '');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [saved, setSaved] = useState(false);

  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [passwordBusy, setPasswordBusy] = useState(false);
  const [passwordError, setPasswordError] = useState('');
  const [passwordSaved, setPasswordSaved] = useState(false);

  const [sessionsBusy, setSessionsBusy] = useState(false);
  const [sessionsMessage, setSessionsMessage] = useState('');

  const [googleError, setGoogleError] = useState('');
  const googleButtonRef = useRef(null);

  const [avatarBusy, setAvatarBusy] = useState(false);
  const [avatarError, setAvatarError] = useState('');
  const avatarInputRef = useRef(null);

  const dirty =
    displayName.trim() !== user.displayName || username.trim() !== user.username || bio.trim() !== (user.bio || '');

  useEffect(() => {
    const onKey = (e) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  // The Google button only exists while its section is open.
  useEffect(() => {
    const container = googleButtonRef.current;
    if (section !== 'google' || user.hasGoogle || !container) return undefined;
    renderGoogleButton(container, {
      onCredential: async (idToken) => {
        setGoogleError('');
        try {
          await linkGoogle(idToken);
        } catch (err) {
          setGoogleError(err.message);
        }
      },
      onError: (message) => setGoogleError(message),
    });
    // The Google SDK injects its own DOM into the container; make sure none of
    // it outlives the button (e.g. after the account has just been linked).
    return () => container.replaceChildren();
  }, [section, user.hasGoogle]);

  async function handleAvatarPick(e) {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    if (!file.type.startsWith('image/')) {
      setAvatarError('Выберите изображение');
      return;
    }
    setAvatarBusy(true);
    setAvatarError('');
    try {
      const resized = await resizeImageFile(file);
      const { user: updated } = await api.uploadAvatar(resized);
      setUser(updated);
    } catch (err) {
      setAvatarError(err.message);
    } finally {
      setAvatarBusy(false);
    }
  }

  async function handleAvatarDelete() {
    setAvatarBusy(true);
    setAvatarError('');
    try {
      const { user: updated } = await api.deleteAvatar();
      setUser(updated);
    } catch (err) {
      setAvatarError(err.message);
    } finally {
      setAvatarBusy(false);
    }
  }

  async function handleSave() {
    if (!displayName.trim()) {
      setError('Введите имя');
      return;
    }
    if (username.trim().length < 3) {
      setError('Логин от 3 символов');
      return;
    }
    setBusy(true);
    setError('');
    try {
      const { user: updated } = await api.updateMe({
        displayName: displayName.trim(),
        bio: bio.trim(),
        username: username.trim(),
      });
      setUser(updated);
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  }

  async function handleChangePassword() {
    if (newPassword.length < 8) {
      setPasswordError('Новый пароль от 8 символов');
      return;
    }
    if (newPassword !== confirmPassword) {
      setPasswordError('Пароли не совпадают');
      return;
    }
    setPasswordBusy(true);
    setPasswordError('');
    try {
      await api.changePassword({ currentPassword, newPassword });
      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');
      setPasswordSaved(true);
      setTimeout(() => setPasswordSaved(false), 2500);
    } catch (err) {
      setPasswordError(err.message);
    } finally {
      setPasswordBusy(false);
    }
  }

  async function handleRevokeSessions() {
    setSessionsBusy(true);
    setSessionsMessage('');
    try {
      await api.revokeOtherSessions();
      setSessionsMessage('Вы вышли на всех остальных устройствах');
    } catch (err) {
      setSessionsMessage(err.message);
    } finally {
      setSessionsBusy(false);
    }
  }

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-3 sm:p-6" onClick={onClose}>
      <div
        role="dialog"
        aria-modal="true"
        aria-label="Настройки"
        className="w-full max-w-[900px] h-[min(660px,92vh)] rounded-3xl shadow-2xl pop-in flex flex-col md:flex-row overflow-hidden"
        style={{ background: 'var(--overlay)' }}
        onClick={(e) => e.stopPropagation()}
      >
        <nav
          aria-label="Разделы настроек"
          className="md:w-[250px] shrink-0 flex md:flex-col gap-1 p-3 md:p-4 overflow-x-auto md:overflow-visible border-b md:border-b-0 md:border-r"
          style={{ borderColor: 'var(--border)', background: 'var(--panel)' }}
        >
          <div className="hidden md:flex items-center gap-3 px-2 pt-1 pb-4">
            <Avatar name={user.displayName} seed={user.id} size={44} src={user.avatarUrl} />
            <div className="min-w-0">
              <div className="font-semibold truncate leading-5">{user.displayName}</div>
              <div className="text-xs text-muted truncate">@{user.username}</div>
            </div>
          </div>
          {SECTIONS.map(({ id, label, Icon }) => {
            const active = section === id;
            return (
              <button
                key={id}
                onClick={() => setSection(id)}
                aria-current={active ? 'page' : undefined}
                className="flex items-center gap-3 px-3.5 h-11 rounded-xl text-[15px] font-medium whitespace-nowrap shrink-0 transition-colors hover:bg-hover"
                style={{
                  background: active ? 'var(--selected)' : 'transparent',
                  color: active ? 'var(--accent)' : 'var(--text)',
                }}
              >
                <span style={{ color: active ? 'var(--accent)' : 'var(--muted)', display: 'inline-flex' }}>
                  <Icon size={20} />
                </span>
                {label}
              </button>
            );
          })}
          <div className="hidden md:block flex-1" />
          <button
            onClick={() => {
              onClose();
              logout();
            }}
            className="flex items-center gap-3 px-3.5 h-11 rounded-xl text-[15px] font-medium whitespace-nowrap shrink-0 hover:bg-hover"
            style={{ color: '#f87171' }}
          >
            <IconLogout size={20} />
            Выйти
          </button>
        </nav>

        <div className="flex-1 min-w-0 flex flex-col">
          <div className="flex justify-end px-4 pt-3 shrink-0">
            <button
              onClick={onClose}
              aria-label="Закрыть настройки"
              className="w-10 h-10 rounded-xl hover:bg-hover flex items-center justify-center text-muted"
            >
              <IconClose size={18} />
            </button>
          </div>

          <div className="flex-1 overflow-y-auto px-5 md:px-8 pb-8">
            {section === 'profile' && (
              <section>
                <SectionTitle title="Профиль">Так вас видят собеседники</SectionTitle>

                <div className="flex items-center gap-5 mb-6">
                  <button
                    onClick={() => avatarInputRef.current?.click()}
                    disabled={avatarBusy}
                    className="relative rounded-full disabled:opacity-60 shrink-0"
                    title="Изменить фото"
                    aria-label="Изменить фото"
                  >
                    <Avatar name={displayName || user.displayName} seed={user.id} size={88} src={user.avatarUrl} />
                    <span
                      className="absolute -bottom-0.5 -right-0.5 w-8 h-8 rounded-full flex items-center justify-center text-white"
                      style={{ background: 'var(--accent-fill)', border: '3px solid var(--overlay)' }}
                    >
                      <IconEdit size={14} />
                    </span>
                  </button>
                  <input ref={avatarInputRef} type="file" accept="image/*" className="hidden" onChange={handleAvatarPick} />
                  <div className="flex flex-col gap-1.5 items-start">
                    <Button variant="secondary" className="!h-10 !px-4 !text-sm" onClick={() => avatarInputRef.current?.click()} disabled={avatarBusy}>
                      {avatarBusy ? 'Загружаем…' : 'Загрузить фото'}
                    </Button>
                    {user.avatarUrl && !avatarBusy && (
                      <button onClick={handleAvatarDelete} className="text-sm text-red-400 hover:underline">
                        Удалить фото
                      </button>
                    )}
                    <Notice tone="error">{avatarError}</Notice>
                  </div>
                </div>

                <div className="grid gap-4 md:grid-cols-2">
                  <Field id="settings-name" label="Имя">
                    <input
                      id="settings-name"
                      className={inputClass}
                      style={inputStyle}
                      value={displayName}
                      onChange={(e) => setDisplayName(e.target.value)}
                    />
                  </Field>
                  <Field id="settings-username" label="Логин" hint="Латиница, цифры и «_», от 3 символов">
                    <input
                      id="settings-username"
                      className={inputClass}
                      style={inputStyle}
                      value={username}
                      onChange={(e) => setUsername(e.target.value.replace(/\s+/g, ''))}
                    />
                  </Field>
                  <div className="md:col-span-2">
                    <Field id="settings-bio" label="О себе">
                      <textarea
                        id="settings-bio"
                        rows={3}
                        className={`${inputClass} !h-auto py-3 resize-none`}
                        style={inputStyle}
                        value={bio}
                        onChange={(e) => setBio(e.target.value)}
                        placeholder="Пара слов о себе"
                      />
                    </Field>
                  </div>
                </div>

                <div className="mt-5 flex items-center gap-4 flex-wrap">
                  <Button onClick={handleSave} disabled={busy || !dirty}>
                    {busy ? 'Сохраняем…' : 'Сохранить'}
                  </Button>
                  {saved && <Notice tone="success">Сохранено</Notice>}
                  <Notice tone="error">{error}</Notice>
                </div>
              </section>
            )}

            {section === 'appearance' && (
              <section>
                <SectionTitle title="Внешний вид">Тема применяется сразу и запоминается на этом устройстве</SectionTitle>
                <div role="radiogroup" aria-label="Тема" className="grid grid-cols-3 gap-3 max-w-[560px]">
                  {THEMES.map(([id, label]) => {
                    const active = theme === id;
                    return (
                      <button
                        key={id}
                        role="radio"
                        aria-checked={active}
                        onClick={() => setTheme(id)}
                        className="flex flex-col items-stretch gap-2.5 p-2.5 rounded-2xl text-left transition-colors"
                        style={{
                          background: 'var(--panel)',
                          border: `2px solid ${active ? 'var(--accent-fill)' : 'var(--border)'}`,
                        }}
                      >
                        <span className="block h-[84px] rounded-xl overflow-hidden" style={{ border: '1px solid var(--border)' }}>
                          <ThemePreview kind={id} />
                        </span>
                        <span className="flex items-center justify-between px-0.5 text-[14px] font-medium">
                          {label}
                          {active && (
                            <span
                              className="w-5 h-5 rounded-full flex items-center justify-center text-white"
                              style={{ background: 'var(--accent-fill)' }}
                            >
                              <IconCheck size={12} />
                            </span>
                          )}
                        </span>
                      </button>
                    );
                  })}
                </div>
                <p className="mt-4 text-sm text-muted">«Системная» следует настройке вашей операционной системы.</p>
              </section>
            )}

            {section === 'security' && (
              <section>
                <SectionTitle title="Безопасность">Двухэтапная проверка, пароль и устройства, на которых вы вошли</SectionTitle>

                <TwoFactorSettings />

                <div className="my-7" style={{ borderTop: '1px solid var(--border)' }} />

                <h4 className="font-semibold mb-3">Смена пароля</h4>
                <form
                  className="grid gap-4 max-w-[420px]"
                  onSubmit={(e) => {
                    e.preventDefault();
                    handleChangePassword();
                  }}
                >
                  <Field id="settings-current-password" label="Текущий пароль">
                    <input
                      id="settings-current-password"
                      type="password"
                      autoComplete="current-password"
                      className={inputClass}
                      style={inputStyle}
                      value={currentPassword}
                      onChange={(e) => setCurrentPassword(e.target.value)}
                    />
                  </Field>
                  <Field id="settings-new-password" label="Новый пароль" hint="От 8 символов">
                    <input
                      id="settings-new-password"
                      type="password"
                      autoComplete="new-password"
                      className={inputClass}
                      style={inputStyle}
                      value={newPassword}
                      onChange={(e) => setNewPassword(e.target.value)}
                    />
                  </Field>
                  <Field id="settings-confirm-password" label="Повторите новый пароль">
                    <input
                      id="settings-confirm-password"
                      type="password"
                      autoComplete="new-password"
                      className={inputClass}
                      style={inputStyle}
                      value={confirmPassword}
                      onChange={(e) => setConfirmPassword(e.target.value)}
                    />
                  </Field>
                  <div className="flex items-center gap-4 flex-wrap">
                    <Button
                      type="submit"
                      variant="secondary"
                      disabled={passwordBusy || !currentPassword || !newPassword || !confirmPassword}
                    >
                      {passwordBusy ? 'Сохраняем…' : 'Сменить пароль'}
                    </Button>
                    {passwordSaved && <Notice tone="success">Пароль изменён</Notice>}
                  </div>
                  <Notice tone="error">{passwordError}</Notice>
                </form>

                <div className="my-7" style={{ borderTop: '1px solid var(--border)' }} />

                <h4 className="font-semibold mb-1">Устройства</h4>
                <p className="text-sm text-muted mb-4 max-w-[480px]">
                  Завершит сеанс везде, кроме этого устройства. Например, если вы потеряли телефон.
                </p>
                <div className="flex items-center gap-4 flex-wrap">
                  <Button variant="danger" onClick={handleRevokeSessions} disabled={sessionsBusy}>
                    {sessionsBusy ? 'Выходим…' : 'Выйти на других устройствах'}
                  </Button>
                  <Notice>{sessionsMessage}</Notice>
                </div>
              </section>
            )}

            {section === 'google' && (
              <section>
                <SectionTitle title="Вход через Google">Входите в Wave одним нажатием, без пароля</SectionTitle>
                {user.hasGoogle ? (
                  <div
                    key="google-linked"
                    className="flex items-center gap-4 p-4 rounded-2xl max-w-[480px]"
                    style={{ background: 'var(--panel)', border: '1px solid var(--border)' }}
                  >
                    <span className="text-[var(--accent)]">
                      <GoogleBadge size={36} />
                    </span>
                    <div className="flex-1 min-w-0">
                      <div className="font-semibold">Google-аккаунт привязан</div>
                      <div className="text-sm text-muted">Теперь можно входить через Google на любом устройстве</div>
                    </div>
                    <span
                      className="w-7 h-7 rounded-full flex items-center justify-center text-white shrink-0"
                      style={{ background: 'var(--accent-fill)' }}
                      role="img"
                      aria-label="Привязан"
                    >
                      <IconCheck size={15} />
                    </span>
                  </div>
                ) : (
                  <div key="google-unlink" className="max-w-[420px]">
                    <p className="text-sm text-muted mb-4">
                      Привяжите Google-аккаунт: вы сможете входить без логина и пароля, а старый пароль останется запасным способом.
                    </p>
                    <div ref={googleButtonRef} className="flex justify-center min-h-[44px]" />
                    <div className="mt-3">
                      <Notice tone="error">{googleError}</Notice>
                    </div>
                  </div>
                )}
              </section>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
