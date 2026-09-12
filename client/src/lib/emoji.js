export const EMOJI_GROUPS = [
  {
    title: 'Смайлы',
    emojis: [
      '😀', '😃', '😄', '😁', '😆', '😅', '🤣', '😂', '🙂', '🙃',
      '😉', '😊', '😇', '🥰', '😍', '🤩', '😘', '😗', '😚', '😙',
      '😋', '😛', '😜', '🤪', '😝', '🤑', '🤗', '🤭', '🤫', '🤔',
      '😐', '😑', '😶', '😏', '😒', '🙄', '😬', '🤥', '😌', '😔',
      '😪', '🤤', '😴', '😷', '🤒', '🤕', '🤢', '🤮', '🥵', '🥶',
    ],
  },
  {
    title: 'Эмоции',
    emojis: [
      '😀', '😠', '😡', '🤬', '🤯', '😳', '🥺', '😢', '😭', '😱',
      '😨', '😰', '😥', '😓', '🤗', '🫠', '🙁', '☹️', '😤', '😩',
      '😫', '🥱', '😈', '👿', '💀', '👻', '👽', '🤖', '🎃', '😸',
    ],
  },
  {
    title: 'Жесты',
    emojis: [
      '👍', '👎', '👌', '🤌', '✌️', '🤞', '🤟', '🤘', '👊', '✊',
      '👏', '🙌', '👐', '🤝', '🙏', '💪', '👋', '🤙', '☝️', '👆',
      '👇', '👉', '👈', '✋', '🖐️', '🖖', '🫶', '❤️', '🔥', '💯',
    ],
  },
  {
    title: 'Разное',
    emojis: [
      '🎉', '🎊', '🎁', '🎈', '⭐', '✨', '💫', '☕', '🍕', '🍔',
      '🍎', '🍺', '🍾', '⚽', '🏆', '🎮', '📱', '💻', '🚀', '✅',
      '❌', '❗', '❓', '💤', '⏰', '📍', '💰', '🎵', '📸', '🌹',
    ],
  },
];

export const STICKERS = [
  '😂', '🥹', '😍', '🥳', '😎', '🤩', '😭', '🥰',
  '🙈', '🙉', '🙊', '🐶', '🐱', '🐼', '🦄', '🐸',
  '❤️', '💔', '🔥', '👍', '👏', '🙏', '🎉', '🎂',
  '🍾', '☕', '🚀', '💯', '👻', '🤖', '🌈', '⭐',
];

export function isStickerContent(text) {
  if (!text || !text.trim()) return false;
  if (typeof Intl === 'undefined' || !Intl.Segmenter) return false;
  const trimmed = text.trim();
  const segmenter = new Intl.Segmenter(undefined, { granularity: 'grapheme' });
  const graphemes = [...segmenter.segment(trimmed)].map((s) => s.segment);
  if (graphemes.length === 0 || graphemes.length > 3) return false;
  const emojiRe = /^[\p{Extended_Pictographic}‍️\p{Emoji_Component}]+$/u;
  return graphemes.every((g) => emojiRe.test(g));
}
