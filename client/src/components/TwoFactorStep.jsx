import { useEffect, useRef, useState } from 'react';
import { useAuth } from '../context/AuthContext.jsx';
import AuthShell from './AuthShell.jsx';

// The second page of a sign-in for accounts with two-step verification:
// a code from the authenticator app, or one of the saved recovery codes.
export default function TwoFactorStep({ challengeToken, onDone, onCancel }) {
  const { verifyTwoFactor } = useAuth();
  const [useRecovery, setUseRecovery] = useState(false);
  const [code, setCode] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const inputRef = useRef(null);

  useEffect(() => {
    inputRef.current?.focus();
  }, [useRecovery]);

  async function submit(e) {
    e.preventDefault();
    if (!code.trim()) return;
    setBusy(true);
    setError('');
    try {
      await verifyTwoFactor(challengeToken, code.trim());
      onDone();
    } catch (err) {
      setError(err.message);
      setCode('');
      inputRef.current?.focus();
    } finally {
      setBusy(false);
    }
  }

  return (
    <AuthShell
      title="Подтвердите вход"
      subtitle={
        useRecovery
          ? 'Введите один из резервных кодов, которые вы сохранили при включении защиты'
          : 'Введите 6-значный код из приложения Google Authenticator'
      }
      footer={
        <>
          <button type="button" className="font-medium" style={{ color: 'var(--accent)' }} onClick={() => {
            setUseRecovery((v) => !v);
            setCode('');
            setError('');
          }}>
            {useRecovery ? 'Использовать код из приложения' : 'Использовать резервный код'}
          </button>
          <span className="mx-2">·</span>
          <button type="button" className="font-medium" style={{ color: 'var(--accent)' }} onClick={onCancel}>
            Назад
          </button>
        </>
      }
    >
      <form onSubmit={submit} className="flex flex-col" style={{ gap: 18 }}>
        {error && (
          <div role="alert" className="text-sm text-red-400 bg-red-500/10 rounded-xl px-3 py-2.5">
            {error}
          </div>
        )}
        <div className="flex flex-col gap-1.5">
          <label htmlFor="two-factor-code" className="text-[13px] font-medium text-muted">
            {useRecovery ? 'Резервный код' : 'Код подтверждения'}
          </label>
          <input
            id="two-factor-code"
            ref={inputRef}
            value={code}
            onChange={(e) => setCode(useRecovery ? e.target.value : e.target.value.replace(/\D/g, '').slice(0, 6))}
            inputMode={useRecovery ? 'text' : 'numeric'}
            autoComplete="one-time-code"
            placeholder={useRecovery ? 'xxxxx-xxxxx' : '000000'}
            className="h-[56px] px-4 rounded-[14px] outline-none focus:ring-2 focus:ring-accent/40 border text-center text-2xl tracking-[0.35em] font-semibold"
            style={{ background: 'var(--panel)', borderColor: 'var(--border)', letterSpacing: useRecovery ? '0.12em' : undefined }}
          />
        </div>
        <button
          disabled={busy || !code.trim()}
          className="h-[52px] rounded-[14px] text-white text-base font-semibold hover:opacity-90 transition disabled:opacity-50"
          style={{ background: 'var(--accent-fill)' }}
        >
          {busy ? 'Проверяем…' : 'Подтвердить'}
        </button>
      </form>
    </AuthShell>
  );
}
