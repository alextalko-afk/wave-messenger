const ICE_SERVERS = [
  { urls: 'stun:stun.l.google.com:19302' },
  { urls: 'stun:stun1.l.google.com:19302' },
];

export class WebRTCClient {
  constructor({ isVideoCall, onIceCandidate, onRemoteStream, onConnectionStateChange }) {
    this.isVideoCall = isVideoCall;
    this.onIceCandidate = onIceCandidate;
    this.onRemoteStream = onRemoteStream;
    this.onConnectionStateChange = onConnectionStateChange;

    this.localStream = null;
    this.remoteStream = new MediaStream();

    this.pc = new RTCPeerConnection({ iceServers: ICE_SERVERS });
    this.pc.onicecandidate = (e) => {
      if (e.candidate) this.onIceCandidate?.(e.candidate);
    };
    this.pc.ontrack = (e) => {
      this.remoteStream.addTrack(e.track);
      this.onRemoteStream?.(this.remoteStream);
    };
    this.pc.oniceconnectionstatechange = () => {
      this.onConnectionStateChange?.(this.pc.iceConnectionState);
    };
  }

  async openLocalMedia() {
    this.localStream = await navigator.mediaDevices.getUserMedia({
      audio: true,
      video: this.isVideoCall ? { facingMode: 'user' } : false,
    });
    for (const track of this.localStream.getTracks()) {
      this.pc.addTrack(track, this.localStream);
    }
    return this.localStream;
  }

  async createOffer() {
    const offer = await this.pc.createOffer({
      offerToReceiveAudio: true,
      offerToReceiveVideo: this.isVideoCall,
    });
    await this.pc.setLocalDescription(offer);
    return offer;
  }

  async createAnswer() {
    const answer = await this.pc.createAnswer();
    await this.pc.setLocalDescription(answer);
    return answer;
  }

  async setRemoteDescription(sdp) {
    await this.pc.setRemoteDescription(new RTCSessionDescription(sdp));
  }

  async addIceCandidate(candidate) {
    await this.pc.addIceCandidate(new RTCIceCandidate(candidate));
  }

  setAudioEnabled(enabled) {
    this.localStream?.getAudioTracks().forEach((t) => (t.enabled = enabled));
  }

  setVideoEnabled(enabled) {
    this.localStream?.getVideoTracks().forEach((t) => (t.enabled = enabled));
  }

  close() {
    this.localStream?.getTracks().forEach((t) => t.stop());
    this.pc.close();
  }
}
