package com.wave.app.ui.screens

import android.Manifest
import android.content.pm.PackageManager
import android.media.MediaRecorder
import android.net.Uri
import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.lazy.rememberLazyListState
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.ArrowBack
import androidx.compose.material.icons.filled.AttachFile
import androidx.compose.material.icons.filled.Check
import androidx.compose.material.icons.filled.Delete
import androidx.compose.material.icons.filled.EmojiEmotions
import androidx.compose.material.icons.filled.Mic
import androidx.compose.material.icons.filled.Send
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.ExperimentalMaterial3Api
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Scaffold
import androidx.compose.material3.Text
import androidx.compose.material3.TopAppBar
import androidx.compose.material3.TopAppBarDefaults
import androidx.compose.runtime.Composable
import androidx.compose.runtime.DisposableEffect
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.collectAsState
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableIntStateOf
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.unit.dp
import androidx.activity.compose.rememberLauncherForActivityResult
import androidx.activity.result.contract.ActivityResultContracts
import com.wave.app.data.SessionStore
import com.wave.app.data.uriToMultipart
import com.wave.app.model.Conversation
import com.wave.app.network.ApiClient
import com.wave.app.ui.ChatViewModel
import com.wave.app.ui.ChatViewModelFactory
import com.wave.app.ui.components.Avatar
import com.wave.app.ui.components.EmojiPickerSheet
import com.wave.app.ui.components.MessageBubbleView
import com.wave.app.ui.theme.WaveAccent
import com.wave.app.ui.theme.WaveBg
import com.wave.app.ui.theme.WaveMuted
import com.wave.app.ui.theme.WavePanel
import kotlinx.coroutines.launch
import okhttp3.MediaType.Companion.toMediaTypeOrNull
import okhttp3.RequestBody.Companion.asRequestBody
import java.io.File

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun ChatScreen(
    session: SessionStore,
    conversation: Conversation,
    onBack: () -> Unit,
    onOpenInfo: () -> Unit
) {
    val viewModel: ChatViewModel = androidx.lifecycle.viewmodel.compose.viewModel(
        factory = ChatViewModelFactory(session, conversation.id)
    )
    val messages by viewModel.messages.collectAsState()
    val loading by viewModel.loading.collectAsState()
    val sending by viewModel.sending.collectAsState()
    val error by viewModel.error.collectAsState()
    val otherReadAt by viewModel.otherReadAt.collectAsState()
    val typingName by viewModel.typingName.collectAsState()

    var text by remember { mutableStateOf("") }
    var emojiSheetOpen by remember { mutableStateOf(false) }
    var pendingAttachment by remember { mutableStateOf<PendingAttachment?>(null) }
    val context = LocalContext.current
    val scope = androidx.compose.runtime.rememberCoroutineScope()
    val listState = rememberLazyListState()

    var isRecording by remember { mutableStateOf(false) }
    var recordSeconds by remember { mutableIntStateOf(0) }
    val recorderHolder = remember { mutableStateOf<MediaRecorder?>(null) }
    val recordFileHolder = remember { mutableStateOf<File?>(null) }

    val requestAudioPermission = rememberLauncherForActivityResult(ActivityResultContracts.RequestPermission()) { granted ->
        if (granted) {
            startRecording(context, recorderHolder, recordFileHolder)
            isRecording = true
            recordSeconds = 0
        }
    }

    val pickFile = rememberLauncherForActivityResult(ActivityResultContracts.GetContent()) { uri: Uri? ->
        if (uri == null) return@rememberLauncherForActivityResult
        val mimeType = context.contentResolver.getType(uri) ?: "application/octet-stream"
        pendingAttachment = PendingAttachment(uri = uri, mimeType = mimeType)
    }

    LaunchedEffect(isRecording) {
        while (isRecording) {
            kotlinx.coroutines.delay(1000)
            recordSeconds += 1
        }
    }

    LaunchedEffect(messages.size) {
        if (messages.isNotEmpty()) listState.animateScrollToItem(messages.size - 1)
    }

    DisposableEffect(Unit) {
        onDispose { runCatching { recorderHolder.value?.release() } }
    }

    fun cancelRecording() {
        runCatching { recorderHolder.value?.stop() }
        runCatching { recorderHolder.value?.release() }
        recorderHolder.value = null
        recordFileHolder.value?.delete()
        recordFileHolder.value = null
        isRecording = false
    }

    fun finishRecording() {
        val recorder = recorderHolder.value ?: return
        val file = recordFileHolder.value
        runCatching { recorder.stop() }
        runCatching { recorder.release() }
        recorderHolder.value = null
        isRecording = false
        if (file == null || !file.exists() || file.length() == 0L) return
        scope.launch {
            viewModel.setUploading(true)
            runCatching {
                val part = okhttp3.MultipartBody.Part.createFormData(
                    "file", file.name,
                    file.asRequestBody("audio/mp4".toMediaTypeOrNull())
                )
                val res = ApiClient.upload.upload(part)
                viewModel.sendMedia(res.url, res.name, res.type, "")
            }
            file.delete()
            viewModel.setUploading(false)
        }
    }

    Scaffold(
        containerColor = WaveBg,
        topBar = {
            TopAppBar(
                title = {
                    Row(
                        verticalAlignment = Alignment.CenterVertically,
                        modifier = Modifier.clickableNoRipple { onOpenInfo() }
                    ) {
                        Avatar(name = conversation.name, colorHex = conversation.avatarColor, size = 36)
                        Column(modifier = Modifier.padding(start = 10.dp)) {
                            Text(conversation.name, style = MaterialTheme.typography.titleMedium)
                            val subtitle = when {
                                typingName != null -> "печатает…"
                                conversation.isGroup -> "${conversation.members.size} участников"
                                conversation.otherUser?.online == true -> "в сети"
                                else -> "не в сети"
                            }
                            Text(
                                subtitle,
                                style = MaterialTheme.typography.labelSmall,
                                color = if (typingName != null) WaveAccent else WaveMuted
                            )
                        }
                    }
                },
                navigationIcon = {
                    IconButton(onClick = onBack) {
                        Icon(Icons.Default.ArrowBack, contentDescription = "Назад")
                    }
                },
                colors = TopAppBarDefaults.topAppBarColors(containerColor = WavePanel)
            )
        },
        bottomBar = {
            Column {
                if (error != null) {
                    Text(
                        error ?: "",
                        color = androidx.compose.ui.graphics.Color(0xFFFF6B6B),
                        modifier = Modifier.fillMaxWidth().padding(horizontal = 16.dp, vertical = 4.dp)
                    )
                }
                if (isRecording) {
                    Row(
                        modifier = Modifier.fillMaxWidth().background(WavePanel).padding(8.dp),
                        verticalAlignment = Alignment.CenterVertically
                    ) {
                        IconButton(onClick = { cancelRecording() }) {
                            Icon(Icons.Default.Delete, contentDescription = "Отменить", tint = androidx.compose.ui.graphics.Color(0xFFFF6B6B))
                        }
                        Box(
                            modifier = Modifier.size(10.dp).background(androidx.compose.ui.graphics.Color.Red, shape = androidx.compose.foundation.shape.CircleShape)
                        )
                        Text(
                            "${recordSeconds / 60}:${(recordSeconds % 60).toString().padStart(2, '0')}",
                            modifier = Modifier.padding(start = 8.dp),
                            color = WaveMuted
                        )
                        Text("Запись голосового…", modifier = Modifier.padding(start = 8.dp).weight(1f), color = WaveMuted)
                        IconButton(onClick = { finishRecording() }) {
                            Icon(Icons.Default.Check, contentDescription = "Отправить", tint = WaveAccent)
                        }
                    }
                } else {
                    Row(
                        modifier = Modifier.fillMaxWidth().background(WavePanel).padding(8.dp),
                        verticalAlignment = Alignment.Bottom
                    ) {
                        IconButton(onClick = { pickFile.launch("*/*") }, enabled = !sending) {
                            Icon(Icons.Default.AttachFile, contentDescription = "Прикрепить", tint = WaveAccent)
                        }
                        IconButton(onClick = { emojiSheetOpen = true }) {
                            Icon(Icons.Default.EmojiEmotions, contentDescription = "Эмодзи", tint = WaveAccent)
                        }
                        com.wave.app.ui.components.WaveTextField(
                            value = text,
                            onValueChange = { text = it; viewModel.onTextChanged() },
                            placeholder = "Написать сообщение…",
                            modifier = Modifier.weight(1f).padding(horizontal = 4.dp)
                        )
                        if (text.isNotBlank()) {
                            IconButton(onClick = { viewModel.sendText(text); text = "" }) {
                                Icon(Icons.Default.Send, contentDescription = "Отправить", tint = WaveAccent)
                            }
                        } else {
                            IconButton(onClick = {
                                val granted = androidx.core.content.ContextCompat.checkSelfPermission(
                                    context, Manifest.permission.RECORD_AUDIO
                                ) == PackageManager.PERMISSION_GRANTED
                                if (granted) {
                                    startRecording(context, recorderHolder, recordFileHolder)
                                    isRecording = true
                                    recordSeconds = 0
                                } else {
                                    requestAudioPermission.launch(Manifest.permission.RECORD_AUDIO)
                                }
                            }) {
                                Icon(Icons.Default.Mic, contentDescription = "Голосовое сообщение", tint = WaveAccent)
                            }
                        }
                    }
                }
                if (sending) {
                    androidx.compose.material3.LinearProgressIndicator(modifier = Modifier.fillMaxWidth())
                }
            }
        }
    ) { padding ->
        Box(modifier = Modifier.fillMaxSize().padding(padding)) {
            if (loading) {
                CircularProgressIndicator(modifier = Modifier.align(Alignment.Center))
            } else {
                LazyColumn(
                    state = listState,
                    modifier = Modifier.fillMaxSize(),
                    contentPadding = androidx.compose.foundation.layout.PaddingValues(12.dp),
                    verticalArrangement = Arrangement.spacedBy(6.dp)
                ) {
                    items(messages, key = { it.id }) { message ->
                        val isMine = message.senderId == viewModel.myUserId
                        val isRead = isMine && message.createdAt <= otherReadAt
                        MessageBubbleView(
                            message = message,
                            isMine = isMine,
                            showSender = conversation.isGroup && !isMine,
                            isRead = isRead,
                            onEdit = { id, content -> viewModel.editMessage(id, content) },
                            onDelete = { id -> viewModel.deleteMessage(id) }
                        )
                    }
                }
            }
        }
    }

    if (emojiSheetOpen) {
        EmojiPickerSheet(
            onSelectEmoji = { emoji -> text += emoji },
            onSelectSticker = { sticker -> viewModel.sendSticker(sticker); emojiSheetOpen = false },
            onDismiss = { emojiSheetOpen = false }
        )
    }

    pendingAttachment?.let { attachment ->
        AttachmentPreviewDialog(
            attachment = attachment,
            uploading = sending,
            onCancel = { pendingAttachment = null },
            onConfirm = { caption ->
                scope.launch {
                    viewModel.setUploading(true)
                    runCatching {
                        val part = uriToMultipart(context, attachment.uri)
                        val res = ApiClient.upload.upload(part)
                        viewModel.sendMedia(res.url, res.name, res.type, caption)
                    }
                    viewModel.setUploading(false)
                    pendingAttachment = null
                }
            }
        )
    }
}

data class PendingAttachment(val uri: Uri, val mimeType: String)

private fun startRecording(
    context: android.content.Context,
    recorderHolder: androidx.compose.runtime.MutableState<MediaRecorder?>,
    fileHolder: androidx.compose.runtime.MutableState<File?>
) {
    val file = File.createTempFile("voice_", ".m4a", context.cacheDir)
    val recorder = MediaRecorder()
    runCatching {
        recorder.setAudioSource(MediaRecorder.AudioSource.MIC)
        recorder.setOutputFormat(MediaRecorder.OutputFormat.MPEG_4)
        recorder.setAudioEncoder(MediaRecorder.AudioEncoder.AAC)
        recorder.setOutputFile(file.absolutePath)
        recorder.prepare()
        recorder.start()
        recorderHolder.value = recorder
        fileHolder.value = file
    }
}

@Composable
private fun Modifier.clickableNoRipple(onClick: () -> Unit): Modifier {
    val interactionSource = remember { androidx.compose.foundation.interaction.MutableInteractionSource() }
    return this.clickable(
        interactionSource = interactionSource,
        indication = null,
        onClick = onClick
    )
}
