package com.wave.app.ui.components

import androidx.compose.foundation.ExperimentalFoundationApi
import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
import androidx.compose.foundation.combinedClickable
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
import androidx.compose.material.icons.filled.Check
import androidx.compose.material.icons.filled.Delete
import androidx.compose.material.icons.filled.DoneAll
import androidx.compose.material.icons.filled.Edit
import androidx.compose.material.icons.filled.InsertDriveFile
import androidx.compose.material.icons.filled.PlayArrow
import androidx.compose.material3.DropdownMenu
import androidx.compose.material3.DropdownMenuItem
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
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
import androidx.compose.ui.unit.sp
import coil.compose.AsyncImage
import com.wave.app.data.isStickerContent
import com.wave.app.model.Message
import com.wave.app.network.resolveMediaUrl
import com.wave.app.ui.theme.WaveBubbleIn
import com.wave.app.ui.theme.WaveBubbleOut
import com.wave.app.ui.theme.WaveCheck
import com.wave.app.ui.theme.WaveText
import java.text.SimpleDateFormat
import java.util.Date
import java.util.Locale

@OptIn(ExperimentalFoundationApi::class)
@Composable
fun MessageBubbleView(
    message: Message,
    isMine: Boolean,
    showSender: Boolean,
    isRead: Boolean,
    onEdit: (String, String) -> Unit,
    onDelete: (String) -> Unit
) {
    var viewerUrl by remember { mutableStateOf<String?>(null) }
    var viewerIsVideo by remember { mutableStateOf(false) }
    var menuOpen by remember { mutableStateOf(false) }
    var editing by remember { mutableStateOf(false) }
    var draft by remember { mutableStateOf(message.content) }

    val isImage = message.fileType?.startsWith("image/") == true
    val isVideo = message.fileType?.startsWith("video/") == true
    val isAudio = message.fileType?.startsWith("audio/") == true
    val mediaUrl = resolveMediaUrl(message.fileUrl)
    val isSticker = message.fileUrl == null && !editing && isStickerContent(message.content)

    if (message.deleted) {
        Row(modifier = Modifier.fillMaxWidth(), horizontalArrangement = if (isMine) Arrangement.End else Arrangement.Start) {
            Box(
                modifier = Modifier
                    .clip(RoundedCornerShape(50))
                    .background(WaveBubbleIn)
                    .padding(horizontal = 12.dp, vertical = 6.dp)
            ) {
                Text("Сообщение удалено", color = WaveText.copy(alpha = 0.5f), style = MaterialTheme.typography.bodySmall)
            }
        }
        return
    }

    if (isSticker) {
        Row(modifier = Modifier.fillMaxWidth(), horizontalArrangement = if (isMine) Arrangement.End else Arrangement.Start) {
            Column(
                horizontalAlignment = if (isMine) Alignment.End else Alignment.Start,
                modifier = Modifier.combinedClickable(onClick = {}, onLongClick = { if (isMine) menuOpen = true })
            ) {
                Text(text = message.content, fontSize = 64.sp)
                MessageFooter(message, isMine, isRead)
            }
            OwnMessageMenu(menuOpen, { menuOpen = false }, canEdit = false, onEdit = {}, onDelete = { onDelete(message.id) })
        }
        return
    }

    Row(
        modifier = Modifier.fillMaxWidth(),
        horizontalArrangement = if (isMine) Arrangement.End else Arrangement.Start
    ) {
        Box {
            val bubbleShape = RoundedCornerShape(
                topStart = 16.dp,
                topEnd = 16.dp,
                bottomStart = if (isMine) 16.dp else 4.dp,
                bottomEnd = if (isMine) 4.dp else 16.dp
            )
            Column(
                modifier = Modifier
                    .widthIn(max = 280.dp)
                    .clip(bubbleShape)
                    .background(if (isMine) WaveBubbleOut else WaveBubbleIn)
                    .combinedClickable(onClick = {}, onLongClick = { if (isMine) menuOpen = true })
                    .padding(horizontal = 12.dp, vertical = 8.dp)
            ) {
                if (showSender && !isMine && message.senderName != null) {
                    Text(
                        text = message.senderName,
                        color = MaterialTheme.colorScheme.primary,
                        style = MaterialTheme.typography.labelMedium
                    )
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
                        AsyncImage(
                            model = mediaUrl,
                            contentDescription = message.fileName,
                            contentScale = ContentScale.Crop,
                            modifier = Modifier.fillMaxWidth().size(220.dp)
                        )
                        Box(
                            modifier = Modifier
                                .size(48.dp)
                                .clip(CircleShape)
                                .background(Color.Black.copy(alpha = 0.45f)),
                            contentAlignment = Alignment.Center
                        ) {
                            Icon(Icons.Default.PlayArrow, contentDescription = "Воспроизвести", tint = Color.White)
                        }
                    }
                } else if (mediaUrl != null && isAudio) {
                    VoiceMessagePlayer(url = mediaUrl, isMine = isMine)
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

                if (editing) {
                    Column(modifier = Modifier.padding(top = 4.dp)) {
                        WaveTextField(
                            value = draft,
                            onValueChange = { draft = it },
                            placeholder = "Сообщение"
                        )
                        Row(horizontalArrangement = Arrangement.End, modifier = Modifier.fillMaxWidth()) {
                            IconButton(onClick = { editing = false; draft = message.content }) {
                                Text("Отмена", style = MaterialTheme.typography.labelSmall)
                            }
                            IconButton(onClick = {
                                if (draft.isNotBlank() && draft != message.content) onEdit(message.id, draft.trim())
                                editing = false
                            }) {
                                Icon(Icons.Default.Check, contentDescription = "Сохранить")
                            }
                        }
                    }
                } else if (message.content.isNotBlank()) {
                    Text(
                        text = message.content,
                        color = WaveText,
                        modifier = Modifier.padding(top = if (mediaUrl != null) 6.dp else 0.dp),
                        style = MaterialTheme.typography.bodyLarge
                    )
                }

                if (!editing) {
                    MessageFooter(message, isMine, isRead)
                }
            }

            OwnMessageMenu(
                menuOpen,
                { menuOpen = false },
                canEdit = message.fileUrl == null,
                onEdit = { editing = true; menuOpen = false },
                onDelete = { onDelete(message.id); menuOpen = false }
            )
        }
    }

    viewerUrl?.let { url ->
        MediaViewerDialog(url = url, isVideo = viewerIsVideo, onDismiss = { viewerUrl = null })
    }
}

@Composable
private fun OwnMessageMenu(
    expanded: Boolean,
    onDismiss: () -> Unit,
    canEdit: Boolean,
    onEdit: () -> Unit,
    onDelete: () -> Unit
) {
    DropdownMenu(expanded = expanded, onDismissRequest = onDismiss) {
        if (canEdit) {
            DropdownMenuItem(
                text = { Text("Редактировать") },
                leadingIcon = { Icon(Icons.Default.Edit, contentDescription = null) },
                onClick = onEdit
            )
        }
        DropdownMenuItem(
            text = { Text("Удалить") },
            leadingIcon = { Icon(Icons.Default.Delete, contentDescription = null) },
            onClick = onDelete
        )
    }
}

@Composable
private fun androidx.compose.foundation.layout.ColumnScope.MessageFooter(message: Message, isMine: Boolean, isRead: Boolean) {
    Row(
        modifier = Modifier.align(Alignment.End).padding(top = 2.dp),
        verticalAlignment = Alignment.CenterVertically
    ) {
        Text(
            text = formatTime(message.createdAt) + if (message.editedAt != null) " · изм." else "",
            color = WaveText.copy(alpha = 0.55f),
            style = MaterialTheme.typography.labelSmall
        )
        if (isMine) {
            Icon(
                if (isRead) Icons.Default.DoneAll else Icons.Default.Check,
                contentDescription = if (isRead) "Прочитано" else "Отправлено",
                tint = if (isRead) WaveCheck else WaveText.copy(alpha = 0.55f),
                modifier = Modifier.padding(start = 4.dp).size(14.dp)
            )
        }
    }
}

fun formatTime(epochSeconds: Long): String {
    val sdf = SimpleDateFormat("HH:mm", Locale.getDefault())
    return sdf.format(Date(epochSeconds * 1000))
}
