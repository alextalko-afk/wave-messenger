import { useEffect, useRef, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext.jsx';
import AuthShell from '../components/AuthShell.jsx';
import { renderGoogleButton } from '../lib/googleAuth.js';

export default function LoginPage() {
  const { login, loginWithGoogle } = useAuth();
  const navigate = useNavigate();
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const googleButtonRef = useRef(null);

  useEffect(() => {
    if (!googleButtonRef.current) return;
    renderGoogleButton(googleButtonRef.current, {
      onCredential: async (idToken) => {
        setError('');
        try {
          await loginWithGoogle(idToken);
          navigate('/');
        } catch (err) {
          setError(err.message);
        }
      },
      onError: (message) => setError(message),
    });
  }, []);

  async function handleSubmit(e) {
    e.preventDefault();
    setError('');
    setBusy(true);
    try {
      await login(username, password);
      navigate('/');
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <AuthShell
      title="Вход в Wave"
      subtitle="Введите логин и пароль или войдите через Google"
      footer={
        <>
          Нет аккаунта?{' '}
          <Link to="/register" className="font-medium" style={{ color: 'var(--accent)' }}>
            Зарегистрироваться
          </Link>
        </>
      }
    >
      <form onSubmit={handleSubmit} className="flex flex-col" style={{ gap: 18 }}>
        {error && <div className="text-sm text-red-400 bg-red-500/10 rounded-xl px-3 py-2.5">{error}</div>}

        <div className="flex flex-col gap-1.5">
          <label htmlFor="login-username" className="text-[13px] font-medium text-muted">
            Логин
          </label>
          <input
            id="login-username"
            className="h-[52px] px-4 rounded-[14px] outline-none focus:ring-2 focus:ring-accent/40 text-[15px] border"
            style={{ background: 'var(--panel)', borderColor: 'var(--border)' }}
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            placeholder="alice"
            autoComplete="username"
            autoFocus
          />
        </div>
        <div className="flex flex-col gap-1.5">
          <label htmlFor="login-password" className="text-[13px] font-medium text-muted">
            Пароль
          </label>
          <input
            id="login-password"
            type="password"
            className="h-[52px] px-4 rounded-[14px] outline-none focus:ring-2 focus:ring-accent/40 text-[15px] border"
            style={{ background: 'var(--panel)', borderColor: 'var(--border)' }}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="••••••••"
            autoComplete="current-password"
          />
        </div>
        <button
          disabled={busy}
          className="h-[52px] rounded-[14px] text-white text-base font-semibold hover:opacity-90 transition disabled:opacity-50"
          style={{ background: 'var(--accent-fill)' }}
        >
          {busy ? 'Входим…' : 'Войти'}
        </button>

        <div className="flex items-center gap-3 text-[13px] text-muted">
          <div className="flex-1 h-px" style={{ background: 'var(--border)' }} />
          или
          <div className="flex-1 h-px" style={{ background: 'var(--border)' }} />
        </div>

        <div ref={googleButtonRef} className="flex justify-center" />
      </form>
    </AuthShell>
  );
}
