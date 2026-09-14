import { useEffect, useRef, useState } from 'react';
import { useCall } from '../context/CallContext.jsx';
import Avatar from './Avatar.jsx';
import { IconPhone, IconPhoneOff, IconMic, IconMicOff, IconVideo, IconVideoOff } from './Icons.jsx';

function ControlButton({ icon, background, onClick, title }) {
  return (
    <button
      onClick={onClick}
      title={title}
      className="w-14 h-14 rounded-full flex items-center justify-center text-white transition hover:opacity-90"
      style={{ background }}
    >
      {icon}
    </button>
  );
}

function useVideoRef(stream) {
  const ref = useRef(null);
  useEffect(() => {
    if (ref.current) ref.current.srcObject = stream || null;
  }, [stream]);
  return ref;
}

function formatDuration(startedAt, now) {
  if (!startedAt) return '';
  const seconds = Math.max(0, Math.floor((now - startedAt) / 1000));
  const m = String(Math.floor(seconds / 60)).padStart(2, '0');
  const s = String(seconds % 60).padStart(2, '0');
  return `${m}:${s}`;
}

export default function CallOverlay() {
  const call = useCall();
  const [now, setNow] = useState(Date.now());
  const remoteVideoRef = useVideoRef(call?.remoteStream);
  const localVideoRef = useVideoRef(call?.localStream);

  useEffect(() => {
    if (!call || call.state.status === 'idle') return;
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, [call?.state.status]);

  if (!call) return null;

  if (call.state.status === 'idle') {
    if (!call.error) return null;
    return (
      <div
        className="fixed top-4 left-1/2 -translate-x-1/2 z-50 px-4 py-2.5 rounded-xl text-sm text-white shadow-lg"
        style={{ background: '#e74c3c' }}
      >
        {call.error}
      </div>
    );
  }

  const { state } = call;
  const isVideo = state.kind === 'video';
  const isIncoming = state.status === 'incoming';
  const showVideo = isVideo && (state.status === 'connecting' || state.status === 'connected');

  let statusText = '';
  if (state.status === 'outgoing') statusText = 'Вызов…';
  else if (state.status === 'incoming') statusText = isVideo ? 'Входящий видеозвонок' : 'Входящий звонок';
  else if (state.status === 'connecting') statusText = 'Соединение…';
  else if (state.status === 'connected') statusText = formatDuration(state.startedAt, now);

  return (
    <div className="fixed inset-0 z-50 flex flex-col items-center" style={{ background: 'var(--bg)' }}>
      {showVideo && call.remoteStream && (
        <video
          ref={remoteVideoRef}
          autoPlay
          playsInline
          className="absolute inset-0 w-full h-full object-cover"
        />
      )}

      <div className="relative z-10 flex flex-col items-center pt-16 gap-3">
        <Avatar name={state.peer?.displayName} seed={state.peer?.id} src={state.peer?.avatarUrl} size={100} />
        <div className="text-xl font-semibold text-white">{state.peer?.displayName}</div>
        <div className="text-sm" style={{ color: 'var(--muted)' }}>
          {statusText}
        </div>
      </div>

      <div className="flex-1" />

      {showVideo && call.localStream && (
        <video
          ref={localVideoRef}
          autoPlay
          playsInline
          muted
          className="absolute bottom-40 right-6 w-32 h-44 object-cover rounded-2xl"
          style={{ border: '1px solid var(--border)' }}
        />
      )}

      <div className="relative z-10 flex gap-7 pb-16">
        {isIncoming ? (
          <>
            <ControlButton icon={<IconPhoneOff size={24} />} background="#e74c3c" onClick={call.rejectCall} title="Отклонить" />
            <ControlButton icon={<IconPhone size={24} />} background="#4fae4e" onClick={call.acceptCall} title="Принять" />
          </>
        ) : (
          <>
            <ControlButton
              icon={call.isMuted ? <IconMicOff size={22} /> : <IconMic size={22} />}
              background="var(--panel2)"
              onClick={call.toggleMute}
              title={call.isMuted ? 'Включить микрофон' : 'Выключить микрофон'}
            />
            {isVideo && (
              <ControlButton
                icon={call.isVideoEnabled ? <IconVideo size={22} /> : <IconVideoOff size={22} />}
                background="var(--panel2)"
                onClick={call.toggleVideo}
                title={call.isVideoEnabled ? 'Выключить камеру' : 'Включить камеру'}
              />
            )}
            <ControlButton icon={<IconPhoneOff size={22} />} background="#e74c3c" onClick={call.endCall} title="Завершить" />
          </>
        )}
      </div>
    </div>
  );
}
