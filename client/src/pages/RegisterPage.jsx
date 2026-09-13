import { useEffect, useRef, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext.jsx';
import { IconChatLogo } from '../components/Icons.jsx';
import { renderGoogleButton } from '../lib/googleAuth.js';

export default function RegisterPage() {
  const { loginWithGoogle } = useAuth();
  const navigate = useNavigate();
  const [error, setError] = useState('');
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

  return (
    <div className="safe-area h-dvh w-screen flex items-center justify-center chat-bg text-text">
      <div className="w-full max-w-[360px] px-6">
        <div className="flex flex-col items-center mb-8">
          <div
            className="w-20 h-20 rounded-full flex items-center justify-center mb-4 shadow-lg text-white"
            style={{ background: 'linear-gradient(135deg, var(--accent), var(--accent-2))' }}
          >
            <IconChatLogo size={38} />
          </div>
          <h1 className="text-2xl font-semibold">Wave</h1>
          <p className="text-muted text-sm mt-1">Создайте аккаунт за пару секунд</p>
        </div>

        <div className="rounded-2xl p-6" style={{ background: 'var(--panel)', boxShadow: 'var(--bubble-shadow)' }}>
          <h2 className="text-lg font-semibold mb-2 text-center">Регистрация</h2>
          <p className="text-sm text-muted text-center mb-5">
            Новые аккаунты создаются через Google — это быстрее и безопаснее
          </p>
          {error && <div className="mb-4 text-sm text-red-400 bg-red-500/10 rounded-xl px-3 py-2.5">{error}</div>}

          <div ref={googleButtonRef} className="flex justify-center" />
        </div>

        <p className="text-sm text-muted text-center mt-5">
          Уже есть аккаунт?{' '}
          <Link to="/login" className="font-medium" style={{ color: 'var(--accent)' }}>
            Войти
          </Link>
        </p>
      </div>
    </div>
  );
}
