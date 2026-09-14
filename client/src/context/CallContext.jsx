import { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react';
import { useSocket } from './SocketContext.jsx';
import { useAuth } from './AuthContext.jsx';
import { WebRTCClient } from '../lib/webrtc.js';

const CallContext = createContext(null);

function mediaErrorMessage(err) {
  if (err?.name === 'NotAllowedError') return 'Нет доступа к микрофону/камере';
  if (err?.name === 'NotFoundError') return 'Микрофон или камера не найдены';
  return 'Не удалось начать звонок';
}

const initialState = {
  status: 'idle',
  peer: null,
  kind: null,
  callId: null,
  conversationId: null,
  startedAt: null,
};

export function CallProvider({ children }) {
  const socket = useSocket();
  const { user } = useAuth();
  const [state, setState] = useState(initialState);
  const [localStream, setLocalStream] = useState(null);
  const [remoteStream, setRemoteStream] = useState(null);
  const [isMuted, setIsMuted] = useState(false);
  const [isVideoEnabled, setIsVideoEnabled] = useState(true);
  const [error, setError] = useState(null);

  const clientRef = useRef(null);
  const targetUserIdRef = useRef(null);
  const pendingCandidatesRef = useRef([]);
  const remoteDescSetRef = useRef(false);
  const pendingInviteSdpRef = useRef(null);
  const stateRef = useRef(state);
  stateRef.current = state;

  const resetState = useCallback(() => {
    clientRef.current?.close();
    clientRef.current = null;
    targetUserIdRef.current = null;
    pendingCandidatesRef.current = [];
    remoteDescSetRef.current = false;
    pendingInviteSdpRef.current = null;
    setLocalStream(null);
    setRemoteStream(null);
    setIsMuted(false);
    setIsVideoEnabled(true);
    setState(initialState);
  }, []);

  const failCall = useCallback(
    (message) => {
      const s = stateRef.current;
      if (targetUserIdRef.current && s.callId) {
        socket?.emit('call:end', { targetUserId: targetUserIdRef.current, callId: s.callId });
      }
      resetState();
      setError(message);
      setTimeout(() => setError(null), 4000);
    },
    [socket, resetState]
  );

  const flushPendingCandidates = useCallback(() => {
    const client = clientRef.current;
    if (!client) return;
    for (const c of pendingCandidatesRef.current) client.addIceCandidate(c);
    pendingCandidatesRef.current = [];
  }, []);

  useEffect(() => {
    if (!socket) return;

    const onInvite = (event) => {
      if (stateRef.current.status !== 'idle') {
        socket.emit('call:reject', { targetUserId: event.fromUserId, callId: event.callId });
        return;
      }
      pendingInviteSdpRef.current = event.sdp;
      setState({
        status: 'incoming',
        peer: {
          id: event.fromUserId,
          displayName: event.fromDisplayName || 'Собеседник',
          avatarColor: event.fromAvatarColor,
          avatarUrl: event.fromAvatarUrl,
        },
        kind: event.kind,
        callId: event.callId,
        conversationId: event.conversationId,
        startedAt: null,
      });
    };

    const onAnswer = async (event) => {
      const client = clientRef.current;
      if (!client || event.callId !== stateRef.current.callId) return;
      await client.setRemoteDescription(event.sdp);
      remoteDescSetRef.current = true;
      flushPendingCandidates();
      setState((s) => (s.status === 'outgoing' ? { ...s, status: 'connecting' } : s));
    };

    const onIceCandidate = (event) => {
      if (event.callId !== stateRef.current.callId) return;
      const client = clientRef.current;
      if (client && remoteDescSetRef.current) {
        client.addIceCandidate(event.candidate);
      } else {
        pendingCandidatesRef.current.push(event.candidate);
      }
    };

    const onReject = (event) => {
      if (event.callId === stateRef.current.callId) resetState();
    };

    const onEnd = (event) => {
      if (event.callId === stateRef.current.callId) resetState();
    };

    socket.on('call:invite', onInvite);
    socket.on('call:answer', onAnswer);
    socket.on('call:ice-candidate', onIceCandidate);
    socket.on('call:reject', onReject);
    socket.on('call:end', onEnd);
    return () => {
      socket.off('call:invite', onInvite);
      socket.off('call:answer', onAnswer);
      socket.off('call:ice-candidate', onIceCandidate);
      socket.off('call:reject', onReject);
      socket.off('call:end', onEnd);
    };
  }, [socket, flushPendingCandidates, resetState]);

  function setupClient(kind, callId) {
    const client = new WebRTCClient({
      isVideoCall: kind === 'video',
      onIceCandidate: (candidate) => {
        if (!targetUserIdRef.current) return;
        socket.emit('call:ice-candidate', {
          targetUserId: targetUserIdRef.current,
          callId,
          candidate: {
            sdpMid: candidate.sdpMid,
            sdpMLineIndex: candidate.sdpMLineIndex,
            candidate: candidate.candidate,
          },
        });
      },
      onRemoteStream: (stream) => setRemoteStream(stream),
      onConnectionStateChange: (iceState) => {
        if (iceState === 'connected' || iceState === 'completed') {
          setState((s) => {
            if (s.status === 'connecting' || s.status === 'outgoing') {
              return { ...s, status: 'connected', startedAt: Date.now() };
            }
            return s;
          });
        } else if (iceState === 'disconnected' || iceState === 'failed' || iceState === 'closed') {
          resetState();
        }
      },
    });
    clientRef.current = client;
    return client;
  }

  async function startCall(conversation, kind) {
    if (stateRef.current.status !== 'idle' || !conversation.otherUser) return;
    const callId = crypto.randomUUID();
    targetUserIdRef.current = conversation.otherUser.id;
    setState({
      status: 'outgoing',
      peer: conversation.otherUser,
      kind,
      callId,
      conversationId: conversation.id,
      startedAt: null,
    });
    setIsVideoEnabled(true);
    setIsMuted(false);

    try {
      const client = setupClient(kind, callId);
      const stream = await client.openLocalMedia();
      setLocalStream(stream);
      const offer = await client.createOffer();
      socket.emit('call:invite', {
        conversationId: conversation.id,
        targetUserId: conversation.otherUser.id,
        callId,
        kind,
        sdp: { type: offer.type, sdp: offer.sdp },
        fromDisplayName: user?.displayName || '',
        fromAvatarColor: user?.avatarColor || '',
        fromAvatarUrl: user?.avatarUrl || '',
      });
    } catch (err) {
      failCall(mediaErrorMessage(err));
    }
  }

  async function acceptCall() {
    const s = stateRef.current;
    if (s.status !== 'incoming' || !pendingInviteSdpRef.current) return;
    targetUserIdRef.current = s.peer.id;
    setIsVideoEnabled(true);
    setIsMuted(false);
    setState({ ...s, status: 'connecting' });

    try {
      const client = setupClient(s.kind, s.callId);
      const stream = await client.openLocalMedia();
      setLocalStream(stream);
      await client.setRemoteDescription(pendingInviteSdpRef.current);
      remoteDescSetRef.current = true;
      flushPendingCandidates();
      const answer = await client.createAnswer();
      socket.emit('call:answer', {
        targetUserId: s.peer.id,
        callId: s.callId,
        sdp: { type: answer.type, sdp: answer.sdp },
      });
    } catch (err) {
      failCall(mediaErrorMessage(err));
    }
  }

  function rejectCall() {
    const s = stateRef.current;
    if (s.status !== 'incoming') return;
    socket.emit('call:reject', { targetUserId: s.peer.id, callId: s.callId });
    resetState();
  }

  function endCall() {
    const s = stateRef.current;
    if (targetUserIdRef.current && s.callId) {
      socket.emit('call:end', { targetUserId: targetUserIdRef.current, callId: s.callId });
    }
    resetState();
  }

  function toggleMute() {
    setIsMuted((prev) => {
      clientRef.current?.setAudioEnabled(prev);
      return !prev;
    });
  }

  function toggleVideo() {
    setIsVideoEnabled((prev) => {
      clientRef.current?.setVideoEnabled(!prev);
      return !prev;
    });
  }

  return (
    <CallContext.Provider
      value={{
        state,
        localStream,
        remoteStream,
        isMuted,
        isVideoEnabled,
        error,
        startCall,
        acceptCall,
        rejectCall,
        endCall,
        toggleMute,
        toggleVideo,
      }}
    >
      {children}
    </CallContext.Provider>
  );
}

export const useCall = () => useContext(CallContext);
