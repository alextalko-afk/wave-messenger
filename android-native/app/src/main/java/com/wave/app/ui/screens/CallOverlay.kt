package com.wave.app.ui.screens

import android.Manifest
import android.content.pm.PackageManager
import androidx.activity.compose.rememberLauncherForActivityResult
import androidx.activity.result.contract.ActivityResultContracts
import androidx.compose.foundation.background
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.Call
import androidx.compose.material.icons.filled.CallEnd
import androidx.compose.material.icons.filled.Mic
import androidx.compose.material.icons.filled.MicOff
import androidx.compose.material.icons.filled.Videocam
import androidx.compose.material.icons.filled.VideocamOff
import androidx.compose.material3.Icon
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.DisposableEffect
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.core.content.ContextCompat
import com.wave.app.call.CallKind
import com.wave.app.call.CallManager
import com.wave.app.call.CallState
import com.wave.app.call.WebRTCClient
import com.wave.app.ui.components.Avatar
import com.wave.app.ui.theme.WaveBg
import com.wave.app.ui.theme.WaveMuted
import org.webrtc.VideoTrack
import org.webrtc.SurfaceViewRenderer

@Composable
private fun VideoRendererView(track: VideoTrack?, modifier: Modifier = Modifier) {
    var renderer by remember { mutableStateOf<SurfaceViewRenderer?>(null) }

    androidx.compose.ui.viewinterop.AndroidView(
        modifier = modifier,
        factory = { ctx ->
            SurfaceViewRenderer(ctx).apply {
                init(WebRTCClient.eglBase.eglBaseContext, null)
                setEnableHardwareScaler(true)
                renderer = this
            }
        },
        onRelease = { it.release() }
    )

    DisposableEffect(track, renderer) {
        val r = renderer
        if (track != null && r != null) track.addSink(r)
        onDispose {
            if (track != null && r != null) track.removeSink(r)
        }
    }
}

@Composable
private fun ControlButton(icon: androidx.compose.ui.graphics.vector.ImageVector, background: Color, contentDescription: String, onClick: () -> Unit) {
    Box(
        modifier = Modifier
            .size(60.dp)
            .clip(CircleShape)
            .background(background),
        contentAlignment = Alignment.Center
    ) {
        androidx.compose.material3.IconButton(onClick = onClick) {
            Icon(icon, contentDescription = contentDescription, tint = Color.White)
        }
    }
}

@Composable
fun CallOverlay() {
    val state = CallManager.state
    if (state == CallState.Idle) return

    val context = LocalContext.current
    var now by remember { mutableStateOf(System.currentTimeMillis()) }
    LaunchedEffect(state) {
        while (true) {
            kotlinx.coroutines.delay(1000)
            now = System.currentTimeMillis()
        }
    }

    val permissionsLauncher = rememberLauncherForActivityResult(ActivityResultContracts.RequestMultiplePermissions()) { granted ->
        if (granted.values.all { it }) CallManager.acceptCall()
    }

    fun acceptWithPermissions() {
        val kind = (state as? CallState.Incoming)?.kind
        val needed = mutableListOf(Manifest.permission.RECORD_AUDIO)
        if (kind == CallKind.VIDEO) needed.add(Manifest.permission.CAMERA)
        val allGranted = needed.all {
            ContextCompat.checkSelfPermission(context, it) == PackageManager.PERMISSION_GRANTED
        }
        if (allGranted) CallManager.acceptCall() else permissionsLauncher.launch(needed.toTypedArray())
    }

    val peer = when (state) {
        is CallState.Outgoing -> state.peer
        is CallState.Incoming -> state.peer
        is CallState.Connecting -> state.peer
        is CallState.Connected -> state.peer
        else -> null
    }
    val kind = when (state) {
        is CallState.Outgoing -> state.kind
        is CallState.Incoming -> state.kind
        is CallState.Connecting -> state.kind
        is CallState.Connected -> state.kind
        else -> null
    }
    val isIncoming = state is CallState.Incoming
    val isVideo = kind == CallKind.VIDEO
    val showVideo = isVideo && (state is CallState.Connecting || state is CallState.Connected)

    val statusText = when (state) {
        is CallState.Outgoing -> "Вызов…"
        is CallState.Incoming -> if (isVideo) "Входящий видеозвонок" else "Входящий звонок"
        is CallState.Connecting -> "Соединение…"
        is CallState.Connected -> {
            val seconds = ((now - state.startedAt) / 1000).coerceAtLeast(0)
            "%02d:%02d".format(seconds / 60, seconds % 60)
        }
        else -> ""
    }

    Box(modifier = Modifier.fillMaxSize().background(WaveBg)) {
        if (showVideo && CallManager.remoteVideoTrack != null) {
            VideoRendererView(track = CallManager.remoteVideoTrack, modifier = Modifier.fillMaxSize())
        }

        Column(modifier = Modifier.fillMaxSize().padding(top = 64.dp), horizontalAlignment = Alignment.CenterHorizontally) {
            Avatar(name = peer?.displayName ?: "?", colorHex = peer?.avatarColor, size = 100, avatarUrl = peer?.avatarUrl)
            Spacer(modifier = Modifier.padding(top = 14.dp))
            Text(peer?.displayName ?: "", color = Color.White, fontWeight = FontWeight.SemiBold, style = MaterialTheme.typography.headlineSmall)
            Spacer(modifier = Modifier.padding(top = 4.dp))
            Text(statusText, color = WaveMuted, style = MaterialTheme.typography.bodyMedium)

            Spacer(modifier = Modifier.weight(1f))

            if (showVideo && CallManager.localVideoTrack != null) {
                Row(modifier = Modifier.fillMaxWidth().padding(end = 20.dp), horizontalArrangement = androidx.compose.foundation.layout.Arrangement.End) {
                    VideoRendererView(
                        track = CallManager.localVideoTrack,
                        modifier = Modifier.width(100.dp).height(140.dp).clip(RoundedCornerShape(14.dp))
                    )
                }
                Spacer(modifier = Modifier.padding(top = 16.dp))
            }

            if (isIncoming) {
                Row(horizontalArrangement = androidx.compose.foundation.layout.Arrangement.spacedBy(70.dp), modifier = Modifier.padding(bottom = 60.dp)) {
                    ControlButton(Icons.Default.CallEnd, Color(0xFFE74C3C), "Отклонить") { CallManager.rejectCall() }
                    ControlButton(Icons.Default.Call, Color(0xFF4FAE4E), "Принять") { acceptWithPermissions() }
                }
            } else {
                Row(horizontalArrangement = androidx.compose.foundation.layout.Arrangement.spacedBy(28.dp), modifier = Modifier.padding(bottom = 60.dp)) {
                    ControlButton(
                        if (CallManager.isMuted) Icons.Default.MicOff else Icons.Default.Mic,
                        Color(0xFF2A2F3A),
                        "Микрофон"
                    ) { CallManager.toggleMute() }
                    if (isVideo) {
                        ControlButton(
                            if (CallManager.isVideoEnabled) Icons.Default.Videocam else Icons.Default.VideocamOff,
                            Color(0xFF2A2F3A),
                            "Камера"
                        ) { CallManager.toggleVideo() }
                    }
                    ControlButton(Icons.Default.CallEnd, Color(0xFFE74C3C), "Завершить") { CallManager.endCall() }
                }
            }
        }
    }
}
