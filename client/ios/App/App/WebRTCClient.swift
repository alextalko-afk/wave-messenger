import Foundation
import WebRTC
import CoreMedia

protocol WebRTCClientDelegate: AnyObject {
    func webRTCClient(_ client: WebRTCClient, didGenerateCandidate candidate: RTCIceCandidate)
    func webRTCClient(_ client: WebRTCClient, didChangeConnectionState state: RTCIceConnectionState)
    func webRTCClient(_ client: WebRTCClient, didReceiveRemoteVideoTrack track: RTCVideoTrack)
}

extension RTCSdpType {
    var wireValue: String {
        switch self {
        case .offer: return "offer"
        case .answer: return "answer"
        case .prAnswer: return "pranswer"
        case .rollback: return "rollback"
        @unknown default: return "offer"
        }
    }
}

/// Thin wrapper around a single RTCPeerConnection for one call. A new
/// instance is created per call (the factory below is the only thing
/// shared across calls, as recommended by WebRTC).
final class WebRTCClient: NSObject {
    private static let factory: RTCPeerConnectionFactory = {
        RTCInitializeSSL()
        let encoder = RTCDefaultVideoEncoderFactory()
        let decoder = RTCDefaultVideoDecoderFactory()
        return RTCPeerConnectionFactory(encoderFactory: encoder, decoderFactory: decoder)
    }()

    static func sdpType(from string: String) -> RTCSdpType {
        switch string {
        case "offer": return .offer
        case "answer": return .answer
        case "pranswer": return .prAnswer
        case "rollback": return .rollback
        default: return .offer
        }
    }

    weak var delegate: WebRTCClientDelegate?
    let isVideoCall: Bool

    private let peerConnection: RTCPeerConnection
    private let audioSession = RTCAudioSession.sharedInstance()
    private let audioQueue = DispatchQueue(label: "wave.webrtc.audio")
    private var videoCapturer: RTCVideoCapturer?
    private(set) var localVideoTrack: RTCVideoTrack?
    private(set) var remoteVideoTrack: RTCVideoTrack?

    init(isVideoCall: Bool) {
        self.isVideoCall = isVideoCall

        let config = RTCConfiguration()
        config.iceServers = [
            RTCIceServer(urlStrings: [
                "stun:stun.l.google.com:19302",
                "stun:stun1.l.google.com:19302",
            ])
        ]
        config.sdpSemantics = .unifiedPlan
        config.continualGatheringPolicy = .gatherContinually

        let constraints = RTCMediaConstraints(
            mandatoryConstraints: nil,
            optionalConstraints: ["DtlsSrtpKeyAgreement": kRTCMediaConstraintsValueTrue]
        )
        guard let pc = WebRTCClient.factory.peerConnection(with: config, constraints: constraints, delegate: nil) else {
            fatalError("Could not create RTCPeerConnection")
        }
        self.peerConnection = pc

        super.init()
        configureAudioSession()
        createMediaSenders()
        self.peerConnection.delegate = self
    }

    // MARK: Signaling

    func createOffer(completion: @escaping (RTCSessionDescription) -> Void) {
        let constraints = offerAnswerConstraints()
        peerConnection.offer(for: constraints) { [weak self] sdp, _ in
            guard let self, let sdp else { return }
            self.peerConnection.setLocalDescription(sdp) { _ in completion(sdp) }
        }
    }

    func createAnswer(completion: @escaping (RTCSessionDescription) -> Void) {
        let constraints = offerAnswerConstraints()
        peerConnection.answer(for: constraints) { [weak self] sdp, _ in
            guard let self, let sdp else { return }
            self.peerConnection.setLocalDescription(sdp) { _ in completion(sdp) }
        }
    }

    func setRemoteDescription(_ sdp: RTCSessionDescription, completion: @escaping (Error?) -> Void) {
        peerConnection.setRemoteDescription(sdp, completionHandler: completion)
    }

    func addIceCandidate(_ candidate: RTCIceCandidate) {
        peerConnection.add(candidate) { _ in }
    }

    private func offerAnswerConstraints() -> RTCMediaConstraints {
        RTCMediaConstraints(
            mandatoryConstraints: [
                kRTCMediaConstraintsOfferToReceiveAudio: kRTCMediaConstraintsValueTrue,
                kRTCMediaConstraintsOfferToReceiveVideo: isVideoCall ? kRTCMediaConstraintsValueTrue : kRTCMediaConstraintsValueFalse,
            ],
            optionalConstraints: nil
        )
    }

    // MARK: Media

    /// Starts the front camera feeding frames into the local video track.
    /// Independent of any UI renderer - a renderer just needs to call
    /// `track.add(_:)` separately to display those frames (or the remote
    /// peer receives them regardless of whether we're displaying a
    /// local preview at all).
    func startCapturingVideo() {
        guard isVideoCall, let capturer = videoCapturer as? RTCCameraVideoCapturer,
              let camera = RTCCameraVideoCapturer.captureDevices().first(where: { $0.position == .front }),
              let format = RTCCameraVideoCapturer.supportedFormats(for: camera).sorted(by: {
                  CMVideoFormatDescriptionGetDimensions($0.formatDescription).width < CMVideoFormatDescriptionGetDimensions($1.formatDescription).width
              }).last,
              let fps = format.videoSupportedFrameRateRanges.sorted(by: { $0.maxFrameRate < $1.maxFrameRate }).last
        else { return }
        capturer.startCapture(with: camera, format: format, fps: Int(fps.maxFrameRate))
    }

    func setAudioEnabled(_ enabled: Bool) {
        peerConnection.transceivers.compactMap { $0.sender.track as? RTCAudioTrack }.forEach { $0.isEnabled = enabled }
    }

    func setVideoEnabled(_ enabled: Bool) {
        peerConnection.transceivers.compactMap { $0.sender.track as? RTCVideoTrack }.forEach { $0.isEnabled = enabled }
    }

    func speakerOn() {
        audioQueue.async { [weak self] in
            guard let self else { return }
            self.audioSession.lockForConfiguration()
            try? self.audioSession.setCategory(.playAndRecord)
            try? self.audioSession.overrideOutputAudioPort(.speaker)
            self.audioSession.unlockForConfiguration()
        }
    }

    func speakerOff() {
        audioQueue.async { [weak self] in
            guard let self else { return }
            self.audioSession.lockForConfiguration()
            try? self.audioSession.setCategory(.playAndRecord)
            try? self.audioSession.overrideOutputAudioPort(.none)
            self.audioSession.unlockForConfiguration()
        }
    }

    func close() {
        peerConnection.close()
    }

    private func configureAudioSession() {
        audioSession.lockForConfiguration()
        try? audioSession.setCategory(.playAndRecord)
        try? audioSession.setMode(.voiceChat)
        audioSession.unlockForConfiguration()
    }

    private func createMediaSenders() {
        let streamId = "wave-stream"

        let audioSource = WebRTCClient.factory.audioSource(with: RTCMediaConstraints(mandatoryConstraints: nil, optionalConstraints: nil))
        let audioTrack = WebRTCClient.factory.audioTrack(with: audioSource, trackId: "wave-audio0")
        peerConnection.add(audioTrack, streamIds: [streamId])

        if isVideoCall {
            let videoSource = WebRTCClient.factory.videoSource()
            #if targetEnvironment(simulator)
            videoCapturer = RTCFileVideoCapturer(delegate: videoSource)
            #else
            videoCapturer = RTCCameraVideoCapturer(delegate: videoSource)
            #endif
            let videoTrack = WebRTCClient.factory.videoTrack(with: videoSource, trackId: "wave-video0")
            localVideoTrack = videoTrack
            peerConnection.add(videoTrack, streamIds: [streamId])
        }
    }
}

extension WebRTCClient: RTCPeerConnectionDelegate {
    func peerConnection(_ peerConnection: RTCPeerConnection, didChange stateChanged: RTCSignalingState) {}

    func peerConnection(_ peerConnection: RTCPeerConnection, didAdd stream: RTCMediaStream) {
        if let track = stream.videoTracks.first {
            remoteVideoTrack = track
            delegate?.webRTCClient(self, didReceiveRemoteVideoTrack: track)
        }
    }

    func peerConnection(_ peerConnection: RTCPeerConnection, didRemove stream: RTCMediaStream) {}
    func peerConnectionShouldNegotiate(_ peerConnection: RTCPeerConnection) {}

    func peerConnection(_ peerConnection: RTCPeerConnection, didChange newState: RTCIceConnectionState) {
        if newState == .connected || newState == .completed, remoteVideoTrack == nil {
            remoteVideoTrack = peerConnection.transceivers.first(where: { $0.mediaType == .video })?.receiver.track as? RTCVideoTrack
            if let remoteVideoTrack {
                delegate?.webRTCClient(self, didReceiveRemoteVideoTrack: remoteVideoTrack)
            }
        }
        delegate?.webRTCClient(self, didChangeConnectionState: newState)
    }

    func peerConnection(_ peerConnection: RTCPeerConnection, didChange newState: RTCIceGatheringState) {}

    func peerConnection(_ peerConnection: RTCPeerConnection, didGenerate candidate: RTCIceCandidate) {
        delegate?.webRTCClient(self, didGenerateCandidate: candidate)
    }

    func peerConnection(_ peerConnection: RTCPeerConnection, didRemove candidates: [RTCIceCandidate]) {}
    func peerConnection(_ peerConnection: RTCPeerConnection, didOpen dataChannel: RTCDataChannel) {}
}
