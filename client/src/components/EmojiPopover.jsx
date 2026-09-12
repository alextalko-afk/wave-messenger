import { useEffect, useRef } from 'react';
import { EMOJI_GROUPS, STICKERS } from '../lib/emoji.js';

export default function EmojiPopover({ mode, onSelect, onClose, align = 'left' }) {
  const ref = useRef(null);

  useEffect(() => {
    function onDocClick(e) {
      if (ref.current && !ref.current.contains(e.target)) onClose();
    }
    document.addEventListener('mousedown', onDocClick);
    return () => document.removeEventListener('mousedown', onDocClick);
  }, [onClose]);

  return (
    <div
      ref={ref}
      className={`absolute bottom-full mb-2 ${align === 'right' ? 'right-0' : 'left-0'} z-50 rounded-2xl pop-in overflow-hidden flex flex-col`}
      style={{
        width: 320,
        maxHeight: 360,
        background: 'var(--overlay)',
        boxShadow: '0 12px 36px rgba(0,0,0,0.4)',
        border: '1px solid var(--border)',
      }}
    >
      <div className="flex-1 overflow-y-auto p-3">
        {mode === 'sticker' ? (
          <div className="grid grid-cols-8 gap-1">
            {STICKERS.map((s, i) => (
              <button
                key={i}
                onClick={() => onSelect(s)}
                className="text-3xl leading-none aspect-square flex items-center justify-center rounded-lg hover:bg-hover"
              >
                {s}
              </button>
            ))}
          </div>
        ) : (
          EMOJI_GROUPS.map((group) => (
            <div key={group.title} className="mb-2">
              <div className="text-xs text-muted mb-1 px-1">{group.title}</div>
              <div className="grid grid-cols-8 gap-0.5">
                {group.emojis.map((e, i) => (
                  <button
                    key={i}
                    onClick={() => onSelect(e)}
                    className="text-xl leading-none aspect-square flex items-center justify-center rounded-lg hover:bg-hover"
                  >
                    {e}
                  </button>
                ))}
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
