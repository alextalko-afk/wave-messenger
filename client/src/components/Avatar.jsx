import { gradientFor } from '../lib/avatarPalette.js';
import { IconGroup } from './Icons.jsx';

export default function Avatar({ name, seed, size = 40, online, isGroup }) {
  const initials = (name || '?')
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((w) => w[0]?.toUpperCase())
    .join('');

  return (
    <div className="relative shrink-0" style={{ width: size, height: size }}>
      <div
        className="rounded-full flex items-center justify-center text-white font-medium select-none"
        style={{
          width: size,
          height: size,
          background: gradientFor(seed || name),
          fontSize: size * 0.4,
          letterSpacing: '-0.02em',
        }}
      >
        {isGroup ? <IconGroup size={size * 0.45} /> : initials}
      </div>
      {online && (
        <span
          className="absolute rounded-full"
          style={{
            width: size * 0.28,
            height: size * 0.28,
            right: -1,
            bottom: -1,
            background: '#4fae4e',
            border: '2px solid var(--panel)',
          }}
        />
      )}
    </div>
  );
}
