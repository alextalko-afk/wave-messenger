import Foundation
import WebRTC
import AVFoundation

enum CallKind: String {
    case audio
    case video
}

struct CallPeer: Equatable {
    let id: String
    let displayName: String
    let avatarColor: String?
    let avatarUrl: String?
}

enum CallState: Equatable {
    case idle
    case outgoing(peer: CallPeer, kind: CallKind)
    case incoming(callId: String, peer: CallPeer, conversationId: String, kind: CallKind)
    case connecting(peer: CallPeer, kind: CallKind)
    case connected(peer: CallPeer, kind: CallKind, startedAt: Date)

    static func == (lhs: CallState, rhs: CallState) -> Bool {
        switch (lhs, rhs) {
        case (.idle, .idle): return true
        case (.outgoing(let a, let ka), .outgoing(let b, let kb)): return a == b && ka == kb
        case (.incoming(let ca, let pa, let coa, let ka), .incoming(let cb, let pb, let cob, let kb)):
            return ca == cb && pa == pb && coa == cob && ka == kb
        case (.connecting(let a, let ka), .connecting(let b, let kb)): return a == b && ka == kb
        case (.connected(let a, let ka, _), .connected(let b, let kb, _)): return a == b && ka == kb
        default: return false
        }
    }
}

final class CallManager: NSObject, ObservableObject {
    static let shared = CallManager()

    @Published private(set) var state: CallState = .idle
    @Published private(set) var localVideoTrack: RTCVideoTrack?
    @Published private(set) var remoteVideoTrack: RTCVideoTrack?
    @Published var isMuted = false
    @Published var isSpeakerOn = true
    @Published var isVideoEnabled = true
    @Published var lastError: String?

    private var webRTCClient: WebRTCClient?
    private var currentCallId: String?
    private var targetUserId: String?
    private var pendingRemoteCandidates: [RTCIceCandidate] = []
    private var remoteDescriptionSet = false
    private var pendingInviteSDP: SDPPayload?

    private override init() {
        super.init()
    }

    func registerSignaling() {
        AppSocketManager.shared.onCallInvite = { [weak self] event in
            self?.handleInvite(event)
        }
        AppSocketManager.shared.onCallAnswer = { [weak self] event in
            self?.handleAnswer(event)
        }
        AppSocketManager.shared.onCallIceCandidate = { [weak self] event in
            self?.handleRemoteCandidate(event)
        }
        AppSocketManager.shared.onCallReject = { [weak self] event in
            self?.handleReject(event)
        }
        AppSocketManager.shared.onCallEnd = { [weak self] event in
            self?.handleRemoteEnd(event)
        }
    }

    private func showError(_ message: String) {
        lastError = message
        DispatchQueue.main.asyncAfter(deadline: .now() + 6) { [weak self] in
            if self?.lastError == message {
                self?.lastError = nil
            }
        }
    }

    // MARK: Permissions

    private func checkCallPermissions(needsVideo: Bool, completion: @escaping (Bool) -> Void) {
        AVAudioSession.sharedInstance().requestRecordPermission { [weak self] audioGranted in
            DispatchQueue.main.async {
                guard let self else { return }
                guard audioGranted else {
                    self.showError("Нет доступа к микрофону. Разрешите его в Настройки → Wave → Микрофон.")
                    completion(false)
                    return
                }
                guard needsVideo else {
                    completion(true)
                    return
                }
                switch AVCaptureDevice.authorizationStatus(for: .video) {
                case .authorized:
                    completion(true)
                case .notDetermined:
                    AVCaptureDevice.requestAccess(for: .video) { videoGranted in
                        DispatchQueue.main.async {
                            if !videoGranted {
                                self.showError("Нет доступа к камере. Разрешите его в Настройки → Wave → Камера.")
                            }
                            completion(videoGranted)
                        }
                    }
                default:
                    self.lastError = "Нет доступа к камере. Разрешите его в Настройки → Wave → Камера."
                    completion(false)
                }
            }
        }
    }

    // MARK: Outgoing

    func startCall(conversation: Conversation, kind: CallKind) {
        guard case .idle = state, let otherUser = conversation.otherUser else { return }
        checkCallPermissions(needsVideo: kind == .video) { [weak self] granted in
            guard let self, granted else { return }
            self.beginOutgoingCall(conversation: conversation, otherUser: otherUser, kind: kind)
        }
    }

    private func beginOutgoingCall(conversation: Conversation, otherUser: Member, kind: CallKind) {
        let callId = UUID().uuidString
        currentCallId = callId
        targetUserId = otherUser.id
        isMuted = false
        isVideoEnabled = true
        isSpeakerOn = kind == .video

        let peer = CallPeer(id: otherUser.id, displayName: otherUser.displayName, avatarColor: otherUser.avatarColor, avatarUrl: otherUser.avatarUrl)
        state = .outgoing(peer: peer, kind: kind)

        let client = WebRTCClient(isVideoCall: kind == .video)
        client.delegate = self
        webRTCClient = client
        localVideoTrack = client.localVideoTrack
        if kind == .video {
            client.speakerOn()
            client.startCapturingVideo()
        }

        client.createOffer { [weak self] sdp in
            guard let self, let targetUserId = self.targetUserId, let callId = self.currentCallId else { return }
            AppSocketManager.shared.sendCallInvite(
                conversationId: conversation.id,
                targetUserId: targetUserId,
                callId: callId,
                kind: kind.rawValue,
                sdp: sdp
            )
        }
    }

    // MARK: Incoming

    func acceptCall() {
        guard case .incoming(_, _, _, let kind) = state else { return }
        checkCallPermissions(needsVideo: kind == .video) { [weak self] granted in
            guard let self else { return }
            if granted {
                self.beginAcceptCall()
            } else {
                self.rejectCall()
            }
        }
    }

    private func beginAcceptCall() {
        guard case .incoming(let callId, let peer, _, let kind) = state, let sdp = pendingInviteSDP else { return }
        targetUserId = peer.id
        currentCallId = callId
        isMuted = false
        isVideoEnabled = true
        isSpeakerOn = kind == .video

        let client = WebRTCClient(isVideoCall: kind == .video)
        client.delegate = self
        webRTCClient = client
        localVideoTrack = client.localVideoTrack
        if kind == .video {
            client.speakerOn()
            client.startCapturingVideo()
        }

        state = .connecting(peer: peer, kind: kind)

        let remoteSdp = RTCSessionDescription(type: WebRTCClient.sdpType(from: sdp.type), sdp: sdp.sdp)
        client.setRemoteDescription(remoteSdp) { [weak self] _ in
            guard let self else { return }
            self.remoteDescriptionSet = true
            self.flushPendingCandidates()
            client.createAnswer { sdp in
                AppSocketManager.shared.sendCallAnswer(targetUserId: peer.id, callId: callId, sdp: sdp)
            }
        }
    }

    func rejectCall() {
        guard case .incoming(let callId, let peer, _, _) = state else { return }
        AppSocketManager.shared.sendCallReject(targetUserId: peer.id, callId: callId)
        resetState()
    }

    // MARK: Ending

    func endCall() {
        if let targetUserId, let callId = currentCallId {
            AppSocketManager.shared.sendCallEnd(targetUserId: targetUserId, callId: callId)
        }
        resetState()
    }

    // MARK: Controls

    func toggleMute() {
        isMuted.toggle()
        webRTCClient?.setAudioEnabled(!isMuted)
    }

    func toggleSpeaker() {
        isSpeakerOn.toggle()
        if isSpeakerOn {
            webRTCClient?.speakerOn()
        } else {
            webRTCClient?.speakerOff()
        }
    }

    func toggleVideo() {
        isVideoEnabled.toggle()
        webRTCClient?.setVideoEnabled(isVideoEnabled)
    }

    // MARK: Signaling handlers

    private func handleInvite(_ event: CallInviteEvent) {
        guard case .idle = state else {
            AppSocketManager.shared.sendCallReject(targetUserId: event.fromUserId, callId: event.callId)
            return
        }
        pendingInviteSDP = event.sdp
        let peer = CallPeer(
            id: event.fromUserId,
            displayName: (event.fromDisplayName?.isEmpty == false) ? event.fromDisplayName! : "Собеседник",
            avatarColor: event.fromAvatarColor,
            avatarUrl: event.fromAvatarUrl
        )
        state = .incoming(
            callId: event.callId,
            peer: peer,
            conversationId: event.conversationId,
            kind: CallKind(rawValue: event.kind) ?? .audio
        )
    }

    private func handleAnswer(_ event: CallAnswerEvent) {
        guard event.callId == currentCallId, let client = webRTCClient else { return }
        let sdp = RTCSessionDescription(type: WebRTCClient.sdpType(from: event.sdp.type), sdp: event.sdp.sdp)
        client.setRemoteDescription(sdp) { [weak self] _ in
            guard let self else { return }
            self.remoteDescriptionSet = true
            self.flushPendingCandidates()
            DispatchQueue.main.async {
                if case .outgoing(let peer, let kind) = self.state {
                    self.state = .connecting(peer: peer, kind: kind)
                }
            }
        }
    }

    private func handleRemoteCandidate(_ event: CallIceCandidateEvent) {
        guard event.callId == currentCallId else { return }
        let candidate = RTCIceCandidate(
            sdp: event.candidate.candidate,
            sdpMLineIndex: event.candidate.sdpMLineIndex,
            sdpMid: event.candidate.sdpMid
        )
        if remoteDescriptionSet, let client = webRTCClient {
            client.addIceCandidate(candidate)
        } else {
            pendingRemoteCandidates.append(candidate)
        }
    }

    private func handleReject(_ event: CallRejectEvent) {
        guard event.callId == currentCallId else { return }
        resetState()
    }

    private func handleRemoteEnd(_ event: CallEndEvent) {
        guard event.callId == currentCallId else { return }
        resetState()
    }

    private func flushPendingCandidates() {
        guard let client = webRTCClient else { return }
        for candidate in pendingRemoteCandidates {
            client.addIceCandidate(candidate)
        }
        pendingRemoteCandidates.removeAll()
    }

    private func resetState() {
        webRTCClient?.close()
        webRTCClient = nil
        currentCallId = nil
        targetUserId = nil
        pendingRemoteCandidates.removeAll()
        remoteDescriptionSet = false
        pendingInviteSDP = nil
        localVideoTrack = nil
        remoteVideoTrack = nil
        isMuted = false
        state = .idle
    }
}

extension CallManager: WebRTCClientDelegate {
    func webRTCClient(_ client: WebRTCClient, didGenerateCandidate candidate: RTCIceCandidate) {
        guard let targetUserId, let callId = currentCallId else { return }
        AppSocketManager.shared.sendCallIceCandidate(targetUserId: targetUserId, callId: callId, candidate: candidate)
    }

    func webRTCClient(_ client: WebRTCClient, didReceiveRemoteVideoTrack track: RTCVideoTrack) {
        DispatchQueue.main.async { [weak self] in
            self?.remoteVideoTrack = track
        }
    }

    func webRTCClient(_ client: WebRTCClient, didChangeConnectionState connectionState: RTCIceConnectionState) {
        DispatchQueue.main.async { [weak self] in
            guard let self else { return }
            switch connectionState {
            case .connected, .completed:
                if case .connecting(let peer, let kind) = self.state {
                    self.state = .connected(peer: peer, kind: kind, startedAt: Date())
                } else if case .outgoing(let peer, let kind) = self.state {
                    self.state = .connected(peer: peer, kind: kind, startedAt: Date())
                }
            case .disconnected, .failed, .closed:
                self.resetState()
            default:
                break
            }
        }
    }
}
