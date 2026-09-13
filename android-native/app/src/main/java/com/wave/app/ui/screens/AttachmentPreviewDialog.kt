package com.wave.app.ui.screens

import androidx.compose.foundation.background
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.InsertDriveFile
import androidx.compose.material.icons.filled.Send
import androidx.compose.material.icons.filled.PlayArrow
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.layout.ContentScale
import androidx.compose.ui.unit.dp
import androidx.compose.ui.window.Dialog
import coil.compose.AsyncImage
import com.wave.app.ui.components.WaveTextField
import com.wave.app.ui.theme.WaveAccent
import com.wave.app.ui.theme.WaveMuted
import com.wave.app.ui.theme.WavePanel
import com.wave.app.ui.theme.WavePanel2

@Composable
fun AttachmentPreviewDialog(
    attachment: PendingAttachment,
    uploading: Boolean,
    onCancel: () -> Unit,
    onConfirm: (caption: String) -> Unit
) {
    var caption by remember { mutableStateOf("") }
    val isImage = attachment.mimeType.startsWith("image/")
    val isVideo = attachment.mimeType.startsWith("video/")

    Dialog(onDismissRequest = { if (!uploading) onCancel() }) {
        Column(
            modifier = Modifier
                .fillMaxWidth()
                .clip(RoundedCornerShape(16.dp))
                .background(WavePanel)
                .padding(16.dp)
        ) {
            Text(
                text = if (isImage) "Отправить фото" else if (isVideo) "Отправить видео" else "Отправить файл",
                style = androidx.compose.material3.MaterialTheme.typography.titleMedium
            )
            androidx.compose.foundation.layout.Spacer(modifier = Modifier.padding(top = 10.dp))

            when {
                isImage -> AsyncImage(
                    model = attachment.uri,
                    contentDescription = null,
                    contentScale = ContentScale.Fit,
                    modifier = Modifier.fillMaxWidth().height(240.dp).clip(RoundedCornerShape(10.dp))
                )
                isVideo -> Box(
                    modifier = Modifier
                        .fillMaxWidth()
                        .height(200.dp)
                        .clip(RoundedCornerShape(10.dp))
                        .background(WavePanel2),
                    contentAlignment = Alignment.Center
                ) {
                    AsyncImage(
                        model = attachment.uri,
                        contentDescription = null,
                        contentScale = ContentScale.Crop,
                        modifier = Modifier.fillMaxWidth().height(200.dp)
                    )
                    Box(
                        modifier = Modifier
                            .size(48.dp)
                            .clip(CircleShape)
                            .background(androidx.compose.ui.graphics.Color.Black.copy(alpha = 0.45f)),
                        contentAlignment = Alignment.Center
                    ) {
                        Icon(Icons.Default.PlayArrow, contentDescription = null, tint = androidx.compose.ui.graphics.Color.White)
                    }
                }
                else -> Row(
                    modifier = Modifier
                        .fillMaxWidth()
                        .background(WavePanel2, shape = RoundedCornerShape(10.dp))
                        .padding(12.dp),
                    verticalAlignment = Alignment.CenterVertically
                ) {
                    Icon(Icons.Default.InsertDriveFile, contentDescription = null, tint = WaveMuted)
                    Text(
                        attachment.uri.lastPathSegment ?: "Файл",
                        modifier = Modifier.padding(start = 8.dp)
                    )
                }
            }

            androidx.compose.foundation.layout.Spacer(modifier = Modifier.padding(top = 10.dp))

            Row(verticalAlignment = Alignment.CenterVertically) {
                WaveTextField(
                    value = caption,
                    onValueChange = { caption = it },
                    placeholder = "Добавьте подпись…",
                    modifier = Modifier.weight(1f),
                    enabled = !uploading
                )
                if (uploading) {
                    CircularProgressIndicator(modifier = Modifier.padding(start = 8.dp).height(24.dp))
                } else {
                    IconButton(onClick = { onConfirm(caption) }) {
                        Icon(Icons.Default.Send, contentDescription = "Отправить", tint = WaveAccent)
                    }
                }
            }
        }
    }
}
