import { IconChatLogo, IconVideo, IconGroup, IconSearch } from './Icons.jsx';

const FEATURES = [
  [IconVideo, 'Голосовые и видеозвонки'],
  [IconGroup, 'Группы, ответы и реакции'],
  [IconSearch, 'Поиск по всей переписке'],
];

// Shared frame of the sign-in and sign-up pages: a brand panel on wide screens,
// the form on its own below the `lg` breakpoint.
export default function AuthShell({ title, subtitle, children, footer }) {
  return (
    <div className="safe-area h-dvh w-screen flex bg-bg text-text overflow-hidden">
      <aside
        className="hidden lg:flex relative w-[46%] max-w-[640px] shrink-0 flex-col justify-center px-16 text-white overflow-hidden"
        style={{ background: '#0d2342' }}
      >
        <svg
          className="absolute left-0 bottom-0 w-full pointer-events-none"
          viewBox="0 0 640 260"
          preserveAspectRatio="none"
          fill="none"
          stroke="#2563eb"
          strokeWidth="2"
          strokeLinecap="round"
          aria-hidden="true"
          style={{ height: 260, opacity: 0.55 }}
        >
          <path d="M-20 60c80-70 160-70 240 0s160 70 240 0 160-70 240 0" />
          <path d="M-20 110c80-70 160-70 240 0s160 70 240 0 160-70 240 0" opacity="0.7" />
          <path d="M-20 160c80-70 160-70 240 0s160 70 240 0 160-70 240 0" opacity="0.45" />
          <path d="M-20 210c80-70 160-70 240 0s160 70 240 0 160-70 240 0" opacity="0.25" />
        </svg>

        <div className="relative">
          <div className="flex items-center gap-3.5 mb-24">
            <div className="w-12 h-12 rounded-2xl flex items-center justify-center" style={{ background: '#2563eb' }}>
              <IconChatLogo size={28} />
            </div>
            <span className="font-display font-extrabold text-[26px]">Wave</span>
          </div>
          <h2 className="font-display font-extrabold text-5xl leading-[56px]">
            Общайтесь легко.
            <br />
            Где угодно.
          </h2>
          <p className="mt-5 max-w-[420px] text-lg leading-7" style={{ color: '#c3d3e6' }}>
            Сообщения, звонки и группы в одном месте. Быстро на телефоне и на компьютере.
          </p>
          <ul className="mt-12 space-y-4">
            {FEATURES.map(([Icon, text]) => (
              <li key={text} className="flex items-center gap-3.5 text-base">
                <span
                  className="w-10 h-10 rounded-xl flex items-center justify-center"
                  style={{ background: 'rgba(255,255,255,0.1)' }}
                >
                  <Icon size={22} />
                </span>
                {text}
              </li>
            ))}
          </ul>
        </div>
      </aside>

      <main className="flex-1 min-w-0 flex items-center justify-center overflow-y-auto">
        <div className="w-full max-w-[400px] px-6 py-10">
          <div className="lg:hidden flex items-center gap-3 mb-8">
            <div
              className="w-11 h-11 rounded-[14px] flex items-center justify-center text-white"
              style={{ background: 'var(--accent-fill)' }}
            >
              <IconChatLogo size={26} />
            </div>
            <span className="font-display font-extrabold text-2xl">Wave</span>
          </div>
          <h1 className="font-display font-bold text-[30px] leading-[38px]">{title}</h1>
          <p className="mt-1.5 text-[15px] text-muted">{subtitle}</p>
          <div className="mt-7">{children}</div>
          {footer && <p className="text-sm text-muted text-center mt-6">{footer}</p>}
        </div>
      </main>
    </div>
  );
}
