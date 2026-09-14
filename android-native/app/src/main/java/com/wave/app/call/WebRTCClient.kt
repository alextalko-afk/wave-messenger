package com.wave.app.call

import android.content.Context
import org.webrtc.AudioTrack
import org.webrtc.Camera2Enumerator
import org.webrtc.DefaultVideoDecoderFactory
import org.webrtc.DefaultVideoEncoderFactory
import org.webrtc.EglBase
import org.webrtc.IceCandidate
import org.webrtc.MediaConstraints
import org.webrtc.MediaStream
import org.webrtc.PeerConnection
import org.webrtc.PeerConnectionFactory
import org.webrtc.RtpReceiver
import org.webrtc.SdpObserver
import org.webrtc.SessionDescription
import org.webrtc.SurfaceTextureHelper
import org.webrtc.VideoCapturer
import org.webrtc.VideoTrack

interface WebRTCClientListener {
    fun onIceCandidate(candidate: IceCandidate)
    fun onConnectionStateChange(state: PeerConnection.IceConnectionState)
    fun onRemoteVideoTrack(track: VideoTrack)
}

/**
 * One peer connection for one call. Mirrors the iOS WebRTCClient/Android's
 * own well-known quickstart shape: STUN-only ICE, Unified Plan, manual
 * camera capture start decoupled from rendering (a renderer just calls
 * track.addSink(view) separately).
 */
class WebRTCClient(context: Context, private val isVideoCall: Boolean, val listener: WebRTCClientListener) {

    companion object {
        val eglBase: EglBase = EglBase.create()

        private var factory: PeerConnectionFactory? = null

        fun factory(context: Context): PeerConnectionFactory {
            return factory ?: run {
                PeerConnectionFactory.initialize(
                    PeerConnectionFactory.InitializationOptions.builder(context.applicationContext)
                        .createInitializationOptions()
                )
                val encoderFactory = DefaultVideoEncoderFactory(eglBase.eglBaseContext, true, true)
                val decoderFactory = DefaultVideoDecoderFactory(eglBase.eglBaseContext)
                PeerConnectionFactory.builder()
                    .setVideoEncoderFactory(encoderFactory)
                    .setVideoDecoderFactory(decoderFactory)
                    .createPeerConnectionFactory()
                    .also { factory = it }
            }
        }

        fun sdpType(value: String): SessionDescription.Type =
            SessionDescription.Type.fromCanonicalForm(value)
    }

    private val appContext = context.applicationContext
    private val peerConnection: PeerConnection
    private var videoCapturer: VideoCapturer? = null
    private var surfaceTextureHelper: SurfaceTextureHelper? = null
    var localVideoTrack: VideoTrack? = null
        private set
    var localAudioTrack: AudioTrack? = null
        private set
    var remoteVideoTrack: VideoTrack? = null
        private set

    init {
        val iceServers = listOf(
            PeerConnection.IceServer.builder("stun:stun.l.google.com:19302").createIceServer(),
            PeerConnection.IceServer.builder("stun:stun1.l.google.com:19302").createIceServer()
        )
        val rtcConfig = PeerConnection.RTCConfiguration(iceServers).apply {
            sdpSemantics = PeerConnection.SdpSemantics.UNIFIED_PLAN
            continualGatheringPolicy = PeerConnection.ContinualGatheringPolicy.GATHER_CONTINUALLY
        }

        peerConnection = factory(appContext).createPeerConnection(rtcConfig, object : PeerConnection.Observer {
            override fun onIceCandidate(candidate: IceCandidate) {
                listener.onIceCandidate(candidate)
            }

            override fun onIceConnectionChange(state: PeerConnection.IceConnectionState) {
                listener.onConnectionStateChange(state)
            }

            override fun onAddTrack(receiver: RtpReceiver, streams: Array<out MediaStream>) {
                (receiver.track() as? VideoTrack)?.let {
                    remoteVideoTrack = it
                    listener.onRemoteVideoTrack(it)
                }
            }

            override fun onSignalingChange(state: PeerConnection.SignalingState) {}
            override fun onIceConnectionReceivingChange(receiving: Boolean) {}
            override fun onIceGatheringChange(state: PeerConnection.IceGatheringState) {}
            override fun onIceCandidatesRemoved(candidates: Array<out IceCandidate>) {}
            override fun onAddStream(stream: MediaStream) {}
            override fun onRemoveStream(stream: MediaStream) {}
            override fun onDataChannel(channel: org.webrtc.DataChannel) {}
            override fun onRenegotiationNeeded() {}
        }) ?: error("Failed to create PeerConnection")

        createMediaSenders()
    }

    private fun createMediaSenders() {
        val audioSource = factory(appContext).createAudioSource(MediaConstraints())
        val audioTrack = factory(appContext).createAudioTrack("wave-audio0", audioSource)
        localAudioTrack = audioTrack
        peerConnection.addTrack(audioTrack, listOf("wave-stream"))

        if (isVideoCall) {
            val enumerator = Camera2Enumerator(appContext)
            val frontCamera = enumerator.deviceNames.firstOrNull { enumerator.isFrontFacing(it) }
                ?: enumerator.deviceNames.firstOrNull()
            if (frontCamera != null) {
                val capturer = enumerator.createCapturer(frontCamera, null)
                videoCapturer = capturer
                val helper = SurfaceTextureHelper.create("WaveCaptureThread", eglBase.eglBaseContext)
                surfaceTextureHelper = helper
                val videoSource = factory(appContext).createVideoSource(capturer.isScreencast)
                capturer.initialize(helper, appContext, videoSource.capturerObserver)
                val videoTrack = factory(appContext).createVideoTrack("wave-video0", videoSource)
                localVideoTrack = videoTrack
                peerConnection.addTrack(videoTrack, listOf("wave-stream"))
            }
        }
    }

    fun startCapturingVideo() {
        videoCapturer?.startCapture(1280, 720, 30)
    }

    fun createOffer(onSuccess: (SessionDescription) -> Unit) {
        val constraints = offerAnswerConstraints()
        peerConnection.createOffer(object : SdpObserverAdapter() {
            override fun onCreateSuccess(sdp: SessionDescription) {
                peerConnection.setLocalDescription(SdpObserverAdapter(), sdp)
                onSuccess(sdp)
            }
        }, constraints)
    }

    fun createAnswer(onSuccess: (SessionDescription) -> Unit) {
        val constraints = offerAnswerConstraints()
        peerConnection.createAnswer(object : SdpObserverAdapter() {
            override fun onCreateSuccess(sdp: SessionDescription) {
                peerConnection.setLocalDescription(SdpObserverAdapter(), sdp)
                onSuccess(sdp)
            }
        }, constraints)
    }

    fun setRemoteDescription(sdp: SessionDescription, onDone: () -> Unit) {
        peerConnection.setRemoteDescription(object : SdpObserverAdapter() {
            override fun onSetSuccess() {
                onDone()
            }
        }, sdp)
    }

    fun addIceCandidate(candidate: IceCandidate) {
        peerConnection.addIceCandidate(candidate)
    }

    private fun offerAnswerConstraints(): MediaConstraints {
        return MediaConstraints().apply {
            mandatory.add(MediaConstraints.KeyValuePair("OfferToReceiveAudio", "true"))
            mandatory.add(MediaConstraints.KeyValuePair("OfferToReceiveVideo", isVideoCall.toString()))
        }
    }

    fun setAudioEnabled(enabled: Boolean) {
        localAudioTrack?.setEnabled(enabled)
    }

    fun setVideoEnabled(enabled: Boolean) {
        localVideoTrack?.setEnabled(enabled)
    }

    fun close() {
        runCatching { videoCapturer?.stopCapture() }
        videoCapturer?.dispose()
        surfaceTextureHelper?.dispose()
        peerConnection.close()
        peerConnection.dispose()
    }
}

private open class SdpObserverAdapter : SdpObserver {
    override fun onCreateSuccess(sdp: SessionDescription) {}
    override fun onSetSuccess() {}
    override fun onCreateFailure(error: String?) {}
    override fun onSetFailure(error: String?) {}
}
