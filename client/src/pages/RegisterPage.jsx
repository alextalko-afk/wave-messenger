import { useEffect, useRef, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext.jsx';
import AuthShell from '../components/AuthShell.jsx';
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
    <AuthShell
      title="Регистрация"
      subtitle="Новые аккаунты создаются через Google: это быстрее и безопаснее"
      footer={
        <>
          Уже есть аккаунт?{' '}
          <Link to="/login" className="font-medium" style={{ color: 'var(--accent)' }}>
            Войти
          </Link>
        </>
      }
    >
      {error && <div className="mb-4 text-sm text-red-400 bg-red-500/10 rounded-xl px-3 py-2.5">{error}</div>}
      <div ref={googleButtonRef} className="flex justify-center" />
    </AuthShell>
  );
}
