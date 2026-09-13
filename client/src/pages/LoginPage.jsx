import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext.jsx';
import { IconChatLogo } from '../components/Icons.jsx';

export default function LoginPage() {
  const { login } = useAuth();
  const navigate = useNavigate();
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

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
    <div className="safe-area h-screen w-screen flex items-center justify-center chat-bg text-text">
      <form onSubmit={handleSubmit} className="w-full max-w-[360px] px-6">
        <div className="flex flex-col items-center mb-8">
          <div
            className="w-20 h-20 rounded-full flex items-center justify-center mb-4 shadow-lg text-white"
            style={{ background: 'linear-gradient(135deg, var(--accent), var(--accent-2))' }}
          >
            <IconChatLogo size={38} />
          </div>
          <h1 className="text-2xl font-semibold">Wave</h1>
          <p className="text-muted text-sm mt-1">Быстрый и удобный мессенджер</p>
        </div>

        <div className="rounded-2xl p-6" style={{ background: 'var(--panel)', boxShadow: 'var(--bubble-shadow)' }}>
          <h2 className="text-lg font-semibold mb-5 text-center">Вход в аккаунт</h2>
          {error && <div className="mb-4 text-sm text-red-400 bg-red-500/10 rounded-xl px-3 py-2.5">{error}</div>}

          <input
            className="w-full mb-3 px-4 py-3 rounded-xl outline-none focus:ring-2 focus:ring-accent/40 text-[15px]"
            style={{ background: 'var(--panel2)' }}
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            placeholder="Логин"
            autoFocus
          />
          <input
            type="password"
            className="w-full mb-5 px-4 py-3 rounded-xl outline-none focus:ring-2 focus:ring-accent/40 text-[15px]"
            style={{ background: 'var(--panel2)' }}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="Пароль"
          />
          <button
            disabled={busy}
            className="w-full py-3 rounded-full text-white font-medium hover:opacity-90 transition disabled:opacity-50"
            style={{ background: 'linear-gradient(135deg, var(--accent), var(--accent-2))' }}
          >
            {busy ? 'Входим…' : 'Войти'}
          </button>
        </div>

        <p className="text-sm text-muted text-center mt-5">
          Нет аккаунта?{' '}
          <Link to="/register" className="font-medium" style={{ color: 'var(--accent)' }}>
            Зарегистрироваться
          </Link>
        </p>
      </form>
    </div>
  );
}
