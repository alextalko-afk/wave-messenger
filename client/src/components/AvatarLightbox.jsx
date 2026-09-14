import { IconClose } from './Icons.jsx';

export default function AvatarLightbox({ src, onClose }) {
  if (!src) return null;
  return (
    <div
      className="fixed inset-0 bg-black/85 flex items-center justify-center z-[60] p-6"
      onClick={onClose}
    >
      <button
        onClick={onClose}
        className="absolute top-4 right-4 w-10 h-10 rounded-full flex items-center justify-center text-white hover:bg-white/10"
      >
        <IconClose size={20} />
      </button>
      <img
        src={src}
        alt=""
        className="max-w-full max-h-full rounded-xl object-contain"
        onClick={(e) => e.stopPropagation()}
      />
    </div>
  );
}
