package com.wave.app.ui.components

import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.widthIn
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.InsertDriveFile
import androidx.compose.material.icons.filled.PlayArrow
import androidx.compose.material3.Icon
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.layout.ContentScale
import androidx.compose.ui.text.style.TextDecoration
import androidx.compose.ui.unit.dp
import coil.compose.AsyncImage
import com.wave.app.model.Message
import com.wave.app.network.resolveMediaUrl
import com.wave.app.ui.theme.WaveBubbleIn
import com.wave.app.ui.theme.WaveBubbleOut
import com.wave.app.ui.theme.WaveText
import java.text.SimpleDateFormat
import java.util.Date
import java.util.Locale

@Composable
fun MessageBubbleView(message: Message, isMine: Boolean, showSender: Boolean) {
    var viewerUrl by remember { mutableStateOf<String?>(null) }
    var viewerIsVideo by remember { mutableStateOf(false) }

    val isImage = message.fileType?.startsWith("image/") == true
    val isVideo = message.fileType?.startsWith("video/") == true
    val mediaUrl = resolveMediaUrl(message.fileUrl)

    Row(
        modifier = Modifier.fillMaxWidth(),
        horizontalArrangement = if (isMine) Arrangement.End else Arrangement.Start
    ) {
        Column(
            modifier = Modifier
                .widthIn(max = 280.dp)
                .clip(RoundedCornerShape(16.dp))
                .background(if (isMine) WaveBubbleOut else WaveBubbleIn)
                .padding(10.dp)
        ) {
            if (showSender && !isMine && message.senderName != null) {
                Text(
                    text = message.senderName,
                    color = MaterialTheme.colorScheme.primary,
                    style = MaterialTheme.typography.labelMedium
                )
            }

            if (message.deleted) {
                Text("Сообщение удалено", color = WaveText.copy(alpha = 0.5f), style = MaterialTheme.typography.bodyMedium)
                return@Column
            }

            if (mediaUrl != null && isImage) {
                AsyncImage(
                    model = mediaUrl,
                    contentDescription = message.fileName,
                    contentScale = ContentScale.Crop,
                    modifier = Modifier
                        .fillMaxWidth()
                        .size(220.dp)
                        .clip(RoundedCornerShape(10.dp))
                        .clickable { viewerUrl = mediaUrl; viewerIsVideo = false }
                )
            } else if (mediaUrl != null && isVideo) {
                Box(
                    modifier = Modifier
                        .fillMaxWidth()
                        .size(220.dp)
                        .clip(RoundedCornerShape(10.dp))
                        .background(Color.Black)
                        .clickable { viewerUrl = mediaUrl; viewerIsVideo = true },
                    contentAlignment = Alignment.Center
                ) {
                    Box(
                        modifier = Modifier
                            .size(48.dp)
                            .clip(CircleShape)
                            .background(Color.Black.copy(alpha = 0.5f)),
                        contentAlignment = Alignment.Center
                    ) {
                        Icon(Icons.Default.PlayArrow, contentDescription = "Воспроизвести", tint = Color.White)
                    }
                }
            } else if (mediaUrl != null) {
                Row(
                    modifier = Modifier
                        .fillMaxWidth()
                        .clip(RoundedCornerShape(10.dp))
                        .background(Color.White.copy(alpha = 0.06f))
                        .padding(10.dp),
                    verticalAlignment = Alignment.CenterVertically
                ) {
                    Icon(Icons.Default.InsertDriveFile, contentDescription = null)
                    Text(
                        text = message.fileName ?: "Файл",
                        modifier = Modifier.padding(start = 8.dp),
                        textDecoration = TextDecoration.Underline,
                        style = MaterialTheme.typography.bodyMedium
                    )
                }
            }

            if (message.content.isNotBlank()) {
                Text(
                    text = message.content,
                    color = WaveText,
                    modifier = Modifier.padding(top = if (mediaUrl != null) 6.dp else 0.dp),
                    style = MaterialTheme.typography.bodyLarge
                )
            }

            Text(
                text = formatTime(message.createdAt) + if (message.editedAt != null) " · изм." else "",
                color = WaveText.copy(alpha = 0.55f),
                style = MaterialTheme.typography.labelSmall,
                modifier = Modifier
                    .align(Alignment.End)
                    .padding(top = 2.dp)
            )
        }
    }

    viewerUrl?.let { url ->
        MediaViewerDialog(url = url, isVideo = viewerIsVideo, onDismiss = { viewerUrl = null })
    }
}

fun formatTime(epochSeconds: Long): String {
    val sdf = SimpleDateFormat("HH:mm", Locale.getDefault())
    return sdf.format(Date(epochSeconds * 1000))
}
