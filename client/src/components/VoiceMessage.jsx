import { useEffect, useRef, useState } from 'react';
import { IconPlay, IconPause } from './Icons.jsx';

function formatDuration(sec) {
  if (!isFinite(sec) || sec < 0) sec = 0;
  const m = Math.floor(sec / 60);
  const s = Math.floor(sec % 60);
  return `${m}:${String(s).padStart(2, '0')}`;
}

export default function VoiceMessage({ url, isMine }) {
  const audioRef = useRef(null);
  const [playing, setPlaying] = useState(false);
  const [duration, setDuration] = useState(0);
  const [currentTime, setCurrentTime] = useState(0);

  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;
    const onLoaded = () => setDuration(audio.duration || 0);
    const onTime = () => setCurrentTime(audio.currentTime);
    const onEnd = () => {
      setPlaying(false);
      setCurrentTime(0);
    };
    audio.addEventListener('loadedmetadata', onLoaded);
    audio.addEventListener('timeupdate', onTime);
    audio.addEventListener('ended', onEnd);
    return () => {
      audio.removeEventListener('loadedmetadata', onLoaded);
      audio.removeEventListener('timeupdate', onTime);
      audio.removeEventListener('ended', onEnd);
    };
  }, []);

  function toggle() {
    const audio = audioRef.current;
    if (!audio) return;
    if (playing) {
      audio.pause();
      setPlaying(false);
    } else {
      audio.play();
      setPlaying(true);
    }
  }

  function seek(e) {
    const audio = audioRef.current;
    if (!audio || !duration) return;
    const rect = e.currentTarget.getBoundingClientRect();
    const ratio = (e.clientX - rect.left) / rect.width;
    audio.currentTime = ratio * duration;
    setCurrentTime(audio.currentTime);
  }

  const progress = duration ? currentTime / duration : 0;
  const barColor = isMine ? 'rgba(23,33,43,0.5)' : 'var(--muted)';
  const fillColor = isMine ? 'var(--bubble-out-text)' : 'var(--accent)';

  return (
    <div className="flex items-center gap-2.5 py-1 min-w-[210px]">
      <audio ref={audioRef} src={url} preload="metadata" />
      <button
        onClick={toggle}
        className="w-9 h-9 rounded-full flex items-center justify-center shrink-0"
        style={{ background: fillColor, color: isMine ? 'var(--bubble-out)' : '#fff' }}
      >
        {playing ? <IconPause size={15} /> : <IconPlay size={15} />}
      </button>
      <div className="flex-1">
        <div
          className="h-1 rounded-full cursor-pointer relative"
          style={{ background: barColor, opacity: 0.35 }}
          onClick={seek}
        >
          <div
            className="h-1 rounded-full absolute left-0 top-0"
            style={{ width: `${progress * 100}%`, background: fillColor, opacity: 1 }}
          />
        </div>
        <div className="text-[11px] mt-1" style={{ color: isMine ? 'rgba(23,33,43,0.6)' : 'var(--muted)' }}>
          {formatDuration(playing || currentTime ? currentTime : duration)}
        </div>
      </div>
    </div>
  );
}
