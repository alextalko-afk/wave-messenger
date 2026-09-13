package com.wave.app.ui.components

import android.media.MediaPlayer
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.width
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.Pause
import androidx.compose.material.icons.filled.PlayArrow
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.LinearProgressIndicator
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.DisposableEffect
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableIntStateOf
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.unit.dp
import com.wave.app.ui.theme.WaveAccent
import com.wave.app.ui.theme.WaveText

@Composable
fun VoiceMessagePlayer(url: String, isMine: Boolean) {
    var player by remember { mutableStateOf<MediaPlayer?>(null) }
    var isPlaying by remember { mutableStateOf(false) }
    var progress by remember { mutableStateOf(0f) }
    var durationMs by remember { mutableIntStateOf(0) }

    DisposableEffect(url) {
        onDispose {
            player?.release()
            player = null
        }
    }

    LaunchedEffect(isPlaying) {
        while (isPlaying) {
            val mp = player ?: break
            if (mp.duration > 0) progress = mp.currentPosition.toFloat() / mp.duration
            kotlinx.coroutines.delay(200)
        }
    }

    fun togglePlay() {
        val existing = player
        if (existing != null) {
            if (existing.isPlaying) {
                existing.pause()
                isPlaying = false
            } else {
                existing.start()
                isPlaying = true
            }
            return
        }
        val mp = MediaPlayer()
        runCatching {
            mp.setDataSource(url)
            mp.setOnPreparedListener {
                durationMs = it.duration
                it.start()
                isPlaying = true
            }
            mp.setOnCompletionListener {
                isPlaying = false
                progress = 0f
                it.seekTo(0)
            }
            mp.prepareAsync()
            player = mp
        }
    }

    val tint = if (isMine) WaveText else WaveAccent
    Row(verticalAlignment = Alignment.CenterVertically) {
        IconButton(onClick = { togglePlay() }) {
            Icon(
                if (isPlaying) Icons.Default.Pause else Icons.Default.PlayArrow,
                contentDescription = if (isPlaying) "Пауза" else "Воспроизвести",
                tint = tint
            )
        }
        LinearProgressIndicator(
            progress = progress,
            modifier = Modifier.width(120.dp),
            color = tint
        )
    }
}
