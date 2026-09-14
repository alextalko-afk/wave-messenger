import SwiftUI
import WebRTC

private struct VideoRendererView: UIViewRepresentable {
    let track: RTCVideoTrack

    func makeUIView(context: Context) -> RTCMTLVideoView {
        let view = RTCMTLVideoView()
        view.videoContentMode = .scaleAspectFill
        track.add(view)
        return view
    }

    func updateUIView(_ uiView: RTCMTLVideoView, context: Context) {}
}

struct CallOverlayView: View {
    @ObservedObject private var callManager = CallManager.shared
    @State private var now = Date()

    var body: some View {
        Group {
            if isActive {
                ZStack {
                    Wave.bg.ignoresSafeArea()

                    if kind == .video, let remoteTrack = callManager.remoteVideoTrack {
                        VideoRendererView(track: remoteTrack)
                            .ignoresSafeArea()
                    }

                    VStack {
                        Spacer(minLength: 60)

                        VStack(spacing: 14) {
                            AvatarView(name: peer?.displayName ?? "?", colorHex: peer?.avatarColor, size: 100, avatarUrl: peer?.avatarUrl)
                            Text(peer?.displayName ?? "")
                                .font(.system(size: 24, weight: .semibold))
                                .foregroundColor(.white)
                            Text(statusText)
                                .font(.system(size: 15))
                                .foregroundColor(Wave.muted)
                        }

                        Spacer()

                        if kind == .video, let localTrack = callManager.localVideoTrack, isConnectedOrConnecting {
                            HStack {
                                Spacer()
                                VideoRendererView(track: localTrack)
                                    .frame(width: 100, height: 140)
                                    .clipShape(RoundedRectangle(cornerRadius: 14))
                                    .overlay(RoundedRectangle(cornerRadius: 14).stroke(Wave.border, lineWidth: 1))
                                    .padding(.trailing, 20)
                            }
                        }

                        if isIncoming {
                            HStack(spacing: 70) {
                                controlButton(icon: "phone.down.fill", background: .red) {
                                    callManager.rejectCall()
                                }
                                controlButton(icon: "phone.fill", background: .green) {
                                    callManager.acceptCall()
                                }
                            }
                            .padding(.bottom, 60)
                        } else {
                            HStack(spacing: 28) {
                                controlButton(
                                    icon: callManager.isMuted ? "mic.slash.fill" : "mic.fill",
                                    background: Wave.panel2
                                ) { callManager.toggleMute() }

                                controlButton(
                                    icon: callManager.isSpeakerOn ? "speaker.wave.2.fill" : "speaker.fill",
                                    background: Wave.panel2
                                ) { callManager.toggleSpeaker() }

                                if kind == .video {
                                    controlButton(
                                        icon: callManager.isVideoEnabled ? "video.fill" : "video.slash.fill",
                                        background: Wave.panel2
                                    ) { callManager.toggleVideo() }
                                }

                                controlButton(icon: "phone.down.fill", background: .red) {
                                    callManager.endCall()
                                }
                            }
                            .padding(.bottom, 60)
                        }
                    }
                    .padding(.top, 40)
                }
                .onReceive(Timer.publish(every: 1, on: .main, in: .common).autoconnect()) { date in
                    now = date
                }
            }
        }
    }

    private func controlButton(icon: String, background: Color, action: @escaping () -> Void) -> some View {
        Button(action: action) {
            Image(systemName: icon)
                .font(.system(size: 22, weight: .semibold))
                .foregroundColor(.white)
                .frame(width: 60, height: 60)
                .background(background)
                .clipShape(Circle())
        }
    }

    private var isActive: Bool {
        if case .idle = callManager.state { return false }
        return true
    }

    private var isIncoming: Bool {
        if case .incoming = callManager.state { return true }
        return false
    }

    private var isConnectedOrConnecting: Bool {
        switch callManager.state {
        case .connecting, .connected: return true
        default: return false
        }
    }

    private var peer: CallPeer? {
        switch callManager.state {
        case .outgoing(let peer, _), .connecting(let peer, _), .connected(let peer, _, _):
            return peer
        case .incoming(_, let peer, _, _):
            return peer
        case .idle:
            return nil
        }
    }

    private var kind: CallKind? {
        switch callManager.state {
        case .outgoing(_, let kind), .connecting(_, let kind), .connected(_, let kind, _):
            return kind
        case .incoming(_, _, _, let kind):
            return kind
        case .idle:
            return nil
        }
    }

    private var statusText: String {
        switch callManager.state {
        case .outgoing: return "Вызов…"
        case .incoming: return kind == .video ? "Входящий видеозвонок" : "Входящий звонок"
        case .connecting: return "Соединение…"
        case .connected(_, _, let startedAt):
            let seconds = max(0, Int(now.timeIntervalSince(startedAt)))
            return String(format: "%02d:%02d", seconds / 60, seconds % 60)
        case .idle: return ""
        }
    }
}
