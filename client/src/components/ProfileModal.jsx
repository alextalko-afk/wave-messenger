import { useEffect, useRef, useState } from 'react';
import { api } from '../lib/api.js';
import { useAuth } from '../context/AuthContext.jsx';
import { useTheme } from '../context/ThemeContext.jsx';
import { renderGoogleButton } from '../lib/googleAuth.js';
import Avatar from './Avatar.jsx';
import { IconEdit } from './Icons.jsx';

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

export default function ProfileModal({ onClose }) {
  const { user, setUser, linkGoogle } = useAuth();
  const { accent, toggleAccent } = useTheme();
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

  const [googleError, setGoogleError] = useState('');
  const googleButtonRef = useRef(null);

  const [avatarBusy, setAvatarBusy] = useState(false);
  const [avatarError, setAvatarError] = useState('');
  const avatarInputRef = useRef(null);

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
      const { user: updated } = await api.uploadAvatar(file);
      setUser(updated);
    } catch (err) {
      setAvatarError(err.message);
    } finally {
      setAvatarBusy(false);
    }
  }

  useEffect(() => {
    if (user.hasGoogle || !googleButtonRef.current) return;
    renderGoogleButton(googleButtonRef.current, {
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
  }, [user.hasGoogle]);

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
      setTimeout(() => setSaved(false), 1600);
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  }

  async function handleChangePassword() {
    if (newPassword.length < 4) {
      setPasswordError('Новый пароль от 4 символов');
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
      setTimeout(() => setPasswordSaved(false), 1600);
    } catch (err) {
      setPasswordError(err.message);
    } finally {
      setPasswordBusy(false);
    }
  }

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4" onClick={onClose}>
      <div
        className="w-full max-w-md rounded-2xl p-5 shadow-2xl pop-in max-h-[90vh] overflow-y-auto"
        style={{ background: 'var(--overlay)' }}
        onClick={(e) => e.stopPropagation()}
      >
        <h2 className="text-lg font-semibold mb-4 text-center">Настройки</h2>

        <div className="flex flex-col items-center mb-5">
          <button
            onClick={() => avatarInputRef.current?.click()}
            disabled={avatarBusy}
            className="relative rounded-full disabled:opacity-60"
            title="Изменить фото"
          >
            <Avatar name={displayName || user.displayName} seed={user.id} size={80} src={user.avatarUrl} />
            <span
              className="absolute -bottom-0.5 -right-0.5 w-7 h-7 rounded-full flex items-center justify-center"
              style={{ background: 'var(--accent)', border: '2px solid var(--overlay)' }}
            >
              <IconEdit size={13} className="text-white" />
            </span>
          </button>
          <input
            ref={avatarInputRef}
            type="file"
            accept="image/*"
            className="hidden"
            onChange={handleAvatarPick}
          />
          {avatarBusy && <div className="mt-1.5 text-xs text-muted">Загружаем…</div>}
          {avatarError && <div className="mt-1.5 text-xs text-red-400">{avatarError}</div>}
        </div>

        {error && <div className="mb-3 text-sm text-red-400 bg-red-500/10 rounded-xl px-3 py-2">{error}</div>}
        {saved && <div className="mb-3 text-sm text-muted">Сохранено</div>}

        <label className="block text-xs text-muted mb-1.5">Имя</label>
        <input
          className="w-full mb-3 px-3.5 py-2.5 rounded-xl outline-none focus:ring-2 focus:ring-accent/40 text-sm"
          style={{ background: 'var(--panel2)' }}
          value={displayName}
          onChange={(e) => setDisplayName(e.target.value)}
        />

        <label className="block text-xs text-muted mb-1.5">Логин</label>
        <input
          className="w-full mb-3 px-3.5 py-2.5 rounded-xl outline-none focus:ring-2 focus:ring-accent/40 text-sm"
          style={{ background: 'var(--panel2)' }}
          value={username}
          onChange={(e) => setUsername(e.target.value.replace(/\s+/g, ''))}
        />

        <label className="block text-xs text-muted mb-1.5">О себе</label>
        <textarea
          rows={3}
          className="w-full mb-4 px-3.5 py-2.5 rounded-xl outline-none focus:ring-2 focus:ring-accent/40 text-sm resize-none"
          style={{ background: 'var(--panel2)' }}
          value={bio}
          onChange={(e) => setBio(e.target.value)}
          placeholder="Пара слов о себе"
        />

        <button
          disabled={busy}
          onClick={handleSave}
          className="w-full py-2.5 rounded-full text-white font-medium hover:opacity-90 transition disabled:opacity-50"
          style={{ background: 'linear-gradient(135deg, var(--accent), var(--accent-2))' }}
        >
          {busy ? 'Сохраняем…' : 'Сохранить'}
        </button>

        <div className="my-5" style={{ borderTop: '1px solid var(--border)' }} />

        <h3 className="text-sm font-semibold mb-3">Смена пароля</h3>
        {passwordError && (
          <div className="mb-3 text-sm text-red-400 bg-red-500/10 rounded-xl px-3 py-2">{passwordError}</div>
        )}
        {passwordSaved && <div className="mb-3 text-sm text-muted">Пароль изменён</div>}

        <input
          type="password"
          className="w-full mb-2.5 px-3.5 py-2.5 rounded-xl outline-none focus:ring-2 focus:ring-accent/40 text-sm"
          style={{ background: 'var(--panel2)' }}
          value={currentPassword}
          onChange={(e) => setCurrentPassword(e.target.value)}
          placeholder="Текущий пароль"
        />
        <input
          type="password"
          className="w-full mb-2.5 px-3.5 py-2.5 rounded-xl outline-none focus:ring-2 focus:ring-accent/40 text-sm"
          style={{ background: 'var(--panel2)' }}
          value={newPassword}
          onChange={(e) => setNewPassword(e.target.value)}
          placeholder="Новый пароль"
        />
        <input
          type="password"
          className="w-full mb-4 px-3.5 py-2.5 rounded-xl outline-none focus:ring-2 focus:ring-accent/40 text-sm"
          style={{ background: 'var(--panel2)' }}
          value={confirmPassword}
          onChange={(e) => setConfirmPassword(e.target.value)}
          placeholder="Повторите новый пароль"
        />

        <button
          disabled={passwordBusy || !currentPassword || !newPassword || !confirmPassword}
          onClick={handleChangePassword}
          className="w-full py-2.5 rounded-full font-medium hover:opacity-90 transition disabled:opacity-50"
          style={{ background: 'var(--panel2)', color: 'var(--text)' }}
        >
          {passwordBusy ? 'Сохраняем…' : 'Сменить пароль'}
        </button>

        <div className="my-5" style={{ borderTop: '1px solid var(--border)' }} />

        <h3 className="text-sm font-semibold mb-3">Google-аккаунт</h3>
        {googleError && (
          <div className="mb-3 text-sm text-red-400 bg-red-500/10 rounded-xl px-3 py-2">{googleError}</div>
        )}
        {user.hasGoogle ? (
          <div className="text-sm text-muted mb-1">Google-аккаунт привязан</div>
        ) : (
          <>
            <div className="text-xs text-muted mb-2.5">
              Привяжите Google, чтобы входить в аккаунт в один клик
            </div>
            <div ref={googleButtonRef} className="flex justify-center" />
          </>
        )}

        <div className="my-5" style={{ borderTop: '1px solid var(--border)' }} />

        <div className="flex items-center justify-between py-1">
          <span className="text-sm">Монохромная тема</span>
          <button onClick={toggleAccent}>
            <Switch on={accent === 'mono'} />
          </button>
        </div>
      </div>
    </div>
  );
}
