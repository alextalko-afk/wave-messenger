import { useEffect, useState } from 'react';
import QRCode from 'qrcode';
import { api } from '../lib/api.js';
import { useAuth } from '../context/AuthContext.jsx';
import { IconCheck, IconLock } from './Icons.jsx';

const inputClass =
  'h-12 px-3.5 rounded-xl outline-none focus:ring-2 focus:ring-accent/40 text-[15px] border w-full max-w-[260px]';
const inputStyle = { background: 'var(--panel2)', borderColor: 'var(--border)' };

function ActionButton({ variant = 'secondary', ...props }) {
  const style =
    variant === 'primary'
      ? { background: 'var(--accent-fill)', color: '#fff' }
      : variant === 'danger'
      ? { background: 'transparent', color: '#f87171', border: '1px solid rgba(248,113,113,0.45)' }
      : { background: 'var(--panel2)', color: 'var(--text)' };
  return (
    <button
      {...props}
      className="h-11 px-5 rounded-xl font-medium text-[15px] hover:opacity-90 transition disabled:opacity-50 disabled:cursor-not-allowed"
      style={style}
    />
  );
}

function Error({ children }) {
  if (!children) return null;
  return (
    <div role="alert" className="text-sm text-red-400 bg-red-500/10 rounded-xl px-3 py-2">
      {children}
    </div>
  );
}

function RecoveryCodes({ codes, onDone }) {
  const [copied, setCopied] = useState(false);
  const text = codes.join('\n');

  async function copy() {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      /* clipboard can be unavailable; the codes are still on screen */
    }
  }

  function download() {
    const url = URL.createObjectURL(new Blob([`Резервные коды Wave\n\n${text}\n`], { type: 'text/plain' }));
    const link = document.createElement('a');
    link.href = url;
    link.download = 'wave-recovery-codes.txt';
    link.click();
    URL.revokeObjectURL(url);
  }

  return (
    <div className="max-w-[460px]">
      <p className="text-sm text-muted mb-3">
        Сохраните эти коды в надёжном месте. Каждый подходит один раз, если у вас не будет доступа к приложению. Больше они
        показаны не будут.
      </p>
      <ul
        className="grid grid-cols-2 gap-x-6 gap-y-1.5 p-4 rounded-2xl font-mono text-[15px] mb-4"
        style={{ background: 'var(--panel)', border: '1px solid var(--border)' }}
      >
        {codes.map((code) => (
          <li key={code}>{code}</li>
        ))}
      </ul>
      <div className="flex gap-3 flex-wrap">
        <ActionButton onClick={copy}>{copied ? 'Скопировано' : 'Скопировать'}</ActionButton>
        <ActionButton onClick={download}>Скачать файл</ActionButton>
        <ActionButton variant="primary" onClick={onDone}>
          Я сохранил коды
        </ActionButton>
      </div>
    </div>
  );
}

export default function TwoFactorSettings() {
  const { user, setUser } = useAuth();
  const enabled = !!user.twoFactorEnabled;

  // 'idle' | 'scan' | 'codes' (recovery codes just shown) | 'disable' | 'regenerate'
  const [mode, setMode] = useState('idle');
  const [setup, setSetup] = useState(null); // { secret, otpauthUrl }
  const [qr, setQr] = useState('');
  const [code, setCode] = useState('');
  const [recoveryCodes, setRecoveryCodes] = useState([]);
  const [remaining, setRemaining] = useState(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!enabled) return;
    api
      .twoFactorRemaining()
      .then((r) => setRemaining(r.remaining))
      .catch(() => {});
  }, [enabled, mode]);

  useEffect(() => {
    if (!setup) {
      setQr('');
      return;
    }
    // Always dark-on-white so any scanner can read it, in either theme.
    QRCode.toDataURL(setup.otpauthUrl, { width: 200, margin: 1, color: { dark: '#000000', light: '#ffffff' } })
      .then(setQr)
      .catch(() => setQr(''));
  }, [setup]);

  function reset() {
    setMode('idle');
    setSetup(null);
    setCode('');
    setError('');
  }

  async function run(action) {
    setBusy(true);
    setError('');
    try {
      await action();
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  }

  const startSetup = () =>
    run(async () => {
      setSetup(await api.twoFactorSetup());
      setMode('scan');
    });

  const confirmEnable = () =>
    run(async () => {
      const res = await api.twoFactorEnable(code.trim());
      setUser(res.user);
      setRecoveryCodes(res.recoveryCodes);
      setSetup(null);
      setCode('');
      setMode('codes');
    });

  const confirmDisable = () =>
    run(async () => {
      const res = await api.twoFactorDisable(code.trim());
      setUser(res.user);
      reset();
    });

  const confirmRegenerate = () =>
    run(async () => {
      const res = await api.twoFactorRecoveryCodes(code.trim());
      setRecoveryCodes(res.recoveryCodes);
      setCode('');
      setMode('codes');
    });

  const codeField = (label) => (
    <div className="flex flex-col gap-1.5">
      <label htmlFor="two-factor-input" className="text-[13px] font-medium text-muted">
        {label}
      </label>
      <input
        id="two-factor-input"
        value={code}
        onChange={(e) => setCode(e.target.value)}
        inputMode="text"
        autoComplete="one-time-code"
        autoFocus
        placeholder="000000"
        className={inputClass}
        style={inputStyle}
      />
    </div>
  );

  return (
    <div>
      <div className="flex items-center gap-3 mb-1">
        <h4 className="font-semibold">Двухэтапная проверка</h4>
        {enabled && (
          <span
            className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-medium"
            style={{ background: 'var(--react-mine)', color: 'var(--text)' }}
          >
            <IconCheck size={12} /> Включена
          </span>
        )}
      </div>
      <p className="text-sm text-muted mb-4 max-w-[520px]">
        При входе, кроме пароля или Google, потребуется код из приложения Google Authenticator (или любого TOTP-приложения).
      </p>

      {mode === 'idle' && !enabled && (
        <>
          <ActionButton variant="primary" onClick={startSetup} disabled={busy}>
            <span className="inline-flex items-center gap-2">
              <IconLock size={16} /> Включить
            </span>
          </ActionButton>
          <p className="text-xs text-muted mt-3 max-w-[520px]">
            Пока что вход с кодом работает в веб-версии и в приложении для компьютера. В приложениях для телефона шаг с кодом
            ещё не добавлен: включайте защиту, если входите только с компьютера.
          </p>
        </>
      )}

      {mode === 'scan' && setup && (
        <div className="grid gap-5 max-w-[520px]">
          <ol className="text-sm text-muted list-decimal pl-5 space-y-1">
            <li>Откройте Google Authenticator и нажмите «+».</li>
            <li>Отсканируйте QR-код или введите ключ вручную.</li>
            <li>Введите 6-значный код из приложения.</li>
          </ol>
          <div className="flex gap-5 items-start flex-wrap">
            {qr ? (
              <img src={qr} alt="QR-код для приложения-аутентификатора" width="168" height="168" className="rounded-xl" />
            ) : (
              <div className="w-[168px] h-[168px] rounded-xl animate-pulse" style={{ background: 'var(--panel2)' }} />
            )}
            <div className="min-w-0">
              <div className="text-[13px] font-medium text-muted mb-1">Ключ для ручного ввода</div>
              <code className="block break-all text-[15px] font-mono select-all">{setup.secret.match(/.{1,4}/g).join(' ')}</code>
            </div>
          </div>
          {codeField('Код из приложения')}
          <Error>{error}</Error>
          <div className="flex gap-3">
            <ActionButton variant="primary" onClick={confirmEnable} disabled={busy || code.trim().length < 6}>
              {busy ? 'Проверяем…' : 'Включить защиту'}
            </ActionButton>
            <ActionButton onClick={reset}>Отмена</ActionButton>
          </div>
        </div>
      )}

      {mode === 'codes' && <RecoveryCodes codes={recoveryCodes} onDone={reset} />}

      {mode === 'idle' && enabled && (
        <div>
          {remaining !== null && (
            <p className="text-sm text-muted mb-3">
              Осталось резервных кодов: <span className="font-semibold text-[var(--text)]">{remaining}</span>
              {remaining <= 2 && <span className="text-red-400"> — создайте новые</span>}
            </p>
          )}
          <div className="flex gap-3 flex-wrap">
            <ActionButton onClick={() => setMode('regenerate')}>Новые резервные коды</ActionButton>
            <ActionButton variant="danger" onClick={() => setMode('disable')}>
              Отключить
            </ActionButton>
          </div>
        </div>
      )}

      {(mode === 'disable' || mode === 'regenerate') && (
        <div className="grid gap-4 max-w-[520px]">
          {codeField('Код из приложения или резервный код')}
          <Error>{error}</Error>
          <div className="flex gap-3">
            <ActionButton
              variant={mode === 'disable' ? 'danger' : 'primary'}
              onClick={mode === 'disable' ? confirmDisable : confirmRegenerate}
              disabled={busy || !code.trim()}
            >
              {busy ? 'Проверяем…' : mode === 'disable' ? 'Отключить защиту' : 'Создать новые коды'}
            </ActionButton>
            <ActionButton onClick={reset}>Отмена</ActionButton>
          </div>
        </div>
      )}

      {mode === 'idle' && <Error>{error}</Error>}
    </div>
  );
}
