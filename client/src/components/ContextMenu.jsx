import { useEffect, useRef, useState } from 'react';

export default function ContextMenu({ x, y, items, onClose }) {
  const ref = useRef(null);
  const [pos, setPos] = useState({ x, y, ready: false });

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    const clampedX = Math.min(x, window.innerWidth - rect.width - 8);
    const clampedY = Math.min(y, window.innerHeight - rect.height - 8);
    setPos({ x: Math.max(8, clampedX), y: Math.max(8, clampedY), ready: true });
  }, [x, y]);

  useEffect(() => {
    function onKey(e) {
      if (e.key === 'Escape') onClose();
    }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  return (
    <>
      <div className="fixed inset-0 z-40" onClick={onClose} onContextMenu={(e) => e.preventDefault()} />
      <div
        ref={ref}
        className="fixed z-50 w-64 rounded-xl py-1.5 pop-in"
        style={{
          left: pos.x,
          top: pos.y,
          opacity: pos.ready ? 1 : 0,
          background: 'var(--overlay)',
          boxShadow: '0 8px 30px rgba(0,0,0,0.4)',
          border: '1px solid var(--border)',
        }}
      >
        {items.map((item, i) =>
          item.divider ? (
            <div key={i} className="my-1" style={{ borderTop: '1px solid var(--border)' }} />
          ) : (
            <button
              key={i}
              onClick={() => {
                item.onClick();
                onClose();
              }}
              className="w-full text-left px-3.5 py-2.5 text-sm hover:bg-hover flex items-center gap-2.5 transition-colors"
              style={{ color: item.danger ? '#f45b69' : 'var(--text)' }}
            >
              <span style={{ color: item.danger ? '#f45b69' : 'var(--muted)' }}>{item.icon}</span>
              {item.label}
            </button>
          )
        )}
      </div>
    </>
  );
}
