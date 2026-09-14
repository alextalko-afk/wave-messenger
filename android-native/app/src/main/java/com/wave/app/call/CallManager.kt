package com.wave.app.call

import android.content.Context
import android.media.AudioManager
import android.os.Handler
import android.os.Looper
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.setValue
import com.wave.app.data.SessionStore
import com.wave.app.model.Conversation
import com.wave.app.network.CallAnswerEvent
import com.wave.app.network.CallEndEvent
import com.wave.app.network.CallIceCandidateEvent
import com.wave.app.network.CallInviteEvent
import com.wave.app.network.SdpPayload
import com.wave.app.network.SocketManager
import org.webrtc.IceCandidate
import org.webrtc.PeerConnection
import org.webrtc.SessionDescription
import org.webrtc.VideoTrack
import java.util.UUID

enum class CallKind { AUDIO, VIDEO }

data class CallPeer(val id: String, val displayName: String, val avatarColor: String?, val avatarUrl: String?)

sealed class CallState {
    object Idle : CallState()
    data class Outgoing(val peer: CallPeer, val kind: CallKind) : CallState()
    data class Incoming(val callId: String, val peer: CallPeer, val conversationId: String, val kind: CallKind) : CallState()
    data class Connecting(val peer: CallPeer, val kind: CallKind) : CallState()
    data class Connected(val peer: CallPeer, val kind: CallKind, val startedAt: Long) : CallState()
}

/**
 * App-wide call orchestrator, mirroring the iOS CallManager singleton:
 * one active call at a time, client owns the whole call lifecycle, the
 * server only relays SDP/ICE by target user id.
 */
object CallManager : WebRTCClientListener {
    var state by mutableStateOf<CallState>(CallState.Idle)
        private set
    var localVideoTrack by mutableStateOf<VideoTrack?>(null)
        private set
    var remoteVideoTrack by mutableStateOf<VideoTrack?>(null)
        private set
    var isMuted by mutableStateOf(false)
    var isSpeakerOn by mutableStateOf(true)
    var isVideoEnabled by mutableStateOf(true)

    private lateinit var appContext: Context
    private var webRTCClient: WebRTCClient? = null
    private var currentCallId: String? = null
    private var targetUserId: String? = null
    private val pendingCandidates = mutableListOf<IceCandidate>()
    private var remoteDescriptionSet = false
    private var pendingInviteSdp: SdpPayload? = null
    private val mainHandler = Handler(Looper.getMainLooper())

    private fun runOnMain(block: () -> Unit) {
        if (Looper.myLooper() == Looper.getMainLooper()) block() else mainHandler.post(block)
    }

    fun init(context: Context) {
        appContext = context.applicationContext
    }

    fun registerSignaling() {
        SocketManager.onCallInvite = { handleInvite(it) }
        SocketManager.onCallAnswer = { handleAnswer(it) }
        SocketManager.onCallIceCandidate = { handleRemoteCandidate(it) }
        SocketManager.onCallReject = { handleReject(it) }
        SocketManager.onCallEnd = { handleRemoteEnd(it) }
    }

    fun startCall(conversation: Conversation, kind: CallKind) {
        val other = conversation.otherUser ?: return
        if (state != CallState.Idle) return
        val callId = UUID.randomUUID().toString()
        currentCallId = callId
        targetUserId = other.id
        isMuted = false
        isVideoEnabled = true
        isSpeakerOn = kind == CallKind.VIDEO
        val peer = CallPeer(other.id, other.displayName, other.avatarColor, other.avatarUrl)
        state = CallState.Outgoing(peer, kind)

        val client = setupClient(kind)
        if (kind == CallKind.VIDEO) client.startCapturingVideo()
        applyAudioRouting()

        client.createOffer { sdp ->
            val user = SessionStore(appContext).user
            SocketManager.sendCallInvite(
                conversationId = conversation.id,
                targetUserId = other.id,
                callId = callId,
                kind = kind.name.lowercase(),
                sdp = sdp,
                fromDisplayName = user?.displayName,
                fromAvatarColor = user?.avatarColor,
                fromAvatarUrl = user?.avatarUrl
            )
        }
    }

    fun acceptCall() {
        val current = state as? CallState.Incoming ?: return
        val sdp = pendingInviteSdp ?: return
        targetUserId = current.peer.id
        isMuted = false
        isVideoEnabled = true
        isSpeakerOn = current.kind == CallKind.VIDEO
        state = CallState.Connecting(current.peer, current.kind)

        val client = setupClient(current.kind)
        if (current.kind == CallKind.VIDEO) client.startCapturingVideo()
        applyAudioRouting()

        val remoteSdp = SessionDescription(WebRTCClient.sdpType(sdp.type), sdp.sdp)
        client.setRemoteDescription(remoteSdp) {
            runOnMain {
                remoteDescriptionSet = true
                flushPendingCandidates()
                client.createAnswer { answer ->
                    SocketManager.sendCallAnswer(current.peer.id, current.callId, answer)
                }
            }
        }
    }

    fun rejectCall() {
        val current = state as? CallState.Incoming ?: return
        SocketManager.sendCallReject(current.peer.id, current.callId)
        resetState()
    }

    fun endCall() {
        val callId = currentCallId
        val target = targetUserId
        if (target != null && callId != null) {
            SocketManager.sendCallEnd(target, callId)
        }
        resetState()
    }

    fun toggleMute() {
        isMuted = !isMuted
        webRTCClient?.setAudioEnabled(!isMuted)
    }

    fun toggleSpeaker() {
        isSpeakerOn = !isSpeakerOn
        applyAudioRouting()
    }

    fun toggleVideo() {
        isVideoEnabled = !isVideoEnabled
        webRTCClient?.setVideoEnabled(isVideoEnabled)
    }

    private fun applyAudioRouting() {
        val audioManager = appContext.getSystemService(Context.AUDIO_SERVICE) as? AudioManager ?: return
        audioManager.mode = AudioManager.MODE_IN_COMMUNICATION
        audioManager.isSpeakerphoneOn = isSpeakerOn
    }

    private fun setupClient(kind: CallKind): WebRTCClient {
        val client = WebRTCClient(appContext, kind == CallKind.VIDEO, this)
        webRTCClient = client
        localVideoTrack = client.localVideoTrack
        return client
    }

    private fun handleInvite(event: CallInviteEvent) = runOnMain {
        if (state != CallState.Idle) {
            SocketManager.sendCallReject(event.fromUserId, event.callId)
            return@runOnMain
        }
        pendingInviteSdp = event.sdp
        val peer = CallPeer(
            id = event.fromUserId,
            displayName = event.fromDisplayName?.takeIf { it.isNotEmpty() } ?: "Собеседник",
            avatarColor = event.fromAvatarColor,
            avatarUrl = event.fromAvatarUrl
        )
        state = CallState.Incoming(
            callId = event.callId,
            peer = peer,
            conversationId = event.conversationId,
            kind = if (event.kind == "video") CallKind.VIDEO else CallKind.AUDIO
        )
    }

    private fun handleAnswer(event: CallAnswerEvent) {
        val client = webRTCClient ?: return
        if (event.callId != currentCallId) return
        val sdp = SessionDescription(WebRTCClient.sdpType(event.sdp.type), event.sdp.sdp)
        client.setRemoteDescription(sdp) {
            runOnMain {
                remoteDescriptionSet = true
                flushPendingCandidates()
                (state as? CallState.Outgoing)?.let { state = CallState.Connecting(it.peer, it.kind) }
            }
        }
    }

    private fun handleRemoteCandidate(event: CallIceCandidateEvent) {
        if (event.callId != currentCallId) return
        val candidate = IceCandidate(event.candidate.sdpMid, event.candidate.sdpMLineIndex, event.candidate.candidate)
        if (remoteDescriptionSet) {
            webRTCClient?.addIceCandidate(candidate)
        } else {
            pendingCandidates.add(candidate)
        }
    }

    private fun handleReject(event: CallEndEvent) = runOnMain {
        if (event.callId == currentCallId) resetState()
    }

    private fun handleRemoteEnd(event: CallEndEvent) = runOnMain {
        if (event.callId == currentCallId) resetState()
    }

    private fun flushPendingCandidates() {
        val client = webRTCClient ?: return
        pendingCandidates.forEach { client.addIceCandidate(it) }
        pendingCandidates.clear()
    }

    private fun resetState() {
        webRTCClient?.close()
        webRTCClient = null
        currentCallId = null
        targetUserId = null
        pendingCandidates.clear()
        remoteDescriptionSet = false
        pendingInviteSdp = null
        localVideoTrack = null
        remoteVideoTrack = null
        isMuted = false
        state = CallState.Idle
        if (::appContext.isInitialized) {
            val audioManager = appContext.getSystemService(Context.AUDIO_SERVICE) as? AudioManager
            audioManager?.mode = AudioManager.MODE_NORMAL
            audioManager?.isSpeakerphoneOn = false
        }
    }

    // MARK: WebRTCClientListener

    override fun onIceCandidate(candidate: IceCandidate) {
        val target = targetUserId ?: return
        val callId = currentCallId ?: return
        SocketManager.sendCallIceCandidate(target, callId, candidate)
    }

    override fun onConnectionStateChange(state: PeerConnection.IceConnectionState) = runOnMain {
        when (state) {
            PeerConnection.IceConnectionState.CONNECTED, PeerConnection.IceConnectionState.COMPLETED -> {
                val current = this.state
                if (current is CallState.Connecting) {
                    this.state = CallState.Connected(current.peer, current.kind, System.currentTimeMillis())
                } else if (current is CallState.Outgoing) {
                    this.state = CallState.Connected(current.peer, current.kind, System.currentTimeMillis())
                }
            }
            PeerConnection.IceConnectionState.DISCONNECTED,
            PeerConnection.IceConnectionState.FAILED,
            PeerConnection.IceConnectionState.CLOSED -> resetState()
            else -> {}
        }
    }

    override fun onRemoteVideoTrack(track: VideoTrack) = runOnMain {
        remoteVideoTrack = track
    }
}
