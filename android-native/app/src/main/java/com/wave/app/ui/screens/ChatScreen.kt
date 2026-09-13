package com.wave.app.ui.screens

import android.net.Uri
import androidx.compose.foundation.background
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.IntrinsicSize
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.lazy.rememberLazyListState
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.AttachFile
import androidx.compose.material.icons.filled.ArrowBack
import androidx.compose.material.icons.filled.Send
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.ExperimentalMaterial3Api
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.Scaffold
import androidx.compose.material3.Text
import androidx.compose.material3.TopAppBar
import androidx.compose.material3.TopAppBarDefaults
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.collectAsState
import androidx.compose.runtime.getValue
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
import com.wave.app.model.Message
import com.wave.app.network.ApiClient
import com.wave.app.ui.ChatViewModel
import com.wave.app.ui.ChatViewModelFactory
import com.wave.app.ui.components.Avatar
import com.wave.app.ui.components.MessageBubbleView
import com.wave.app.ui.theme.WaveAccent
import com.wave.app.ui.theme.WaveBg
import com.wave.app.ui.theme.WaveMuted
import com.wave.app.ui.theme.WavePanel
import com.wave.app.ui.theme.WavePanel2
import kotlinx.coroutines.launch

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun ChatScreen(
    session: SessionStore,
    conversation: Conversation,
    onBack: () -> Unit
) {
    val viewModel: ChatViewModel = androidx.lifecycle.viewmodel.compose.viewModel(
        factory = ChatViewModelFactory(session, conversation.id)
    )
    val messages by viewModel.messages.collectAsState()
    val loading by viewModel.loading.collectAsState()
    val sending by viewModel.sending.collectAsState()
    val error by viewModel.error.collectAsState()

    var text by remember { mutableStateOf("") }
    val context = LocalContext.current
    val scope = rememberCoroutineScopeCompat()
    val listState = rememberLazyListState()

    val pickMedia = rememberLauncherForActivityResult(ActivityResultContracts.PickVisualMedia()) { uri: Uri? ->
        if (uri == null) return@rememberLauncherForActivityResult
        scope.launch {
            viewModel.setUploading(true)
            runCatching {
                val part = uriToMultipart(context, uri)
                val res = ApiClient.upload.upload(part)
                viewModel.sendMedia(res.url, res.name, res.type, "")
            }
            viewModel.setUploading(false)
        }
    }

    LaunchedEffect(messages.size) {
        if (messages.isNotEmpty()) listState.animateScrollToItem(messages.size - 1)
    }

    Scaffold(
        containerColor = WaveBg,
        topBar = {
            TopAppBar(
                title = {
                    Row(verticalAlignment = Alignment.CenterVertically) {
                        Avatar(name = conversation.name, colorHex = conversation.avatarColor, size = 36)
                        Column(modifier = Modifier.padding(start = 10.dp)) {
                            Text(conversation.name, style = MaterialTheme.typography.titleMedium)
                            val subtitle = if (conversation.isGroup) {
                                "${conversation.members.size} участников"
                            } else if (conversation.otherUser?.online == true) "в сети" else "не в сети"
                            Text(subtitle, style = MaterialTheme.typography.labelSmall, color = WaveMuted)
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
                Row(
                    modifier = Modifier
                        .fillMaxWidth()
                        .background(WavePanel)
                        .padding(8.dp),
                    verticalAlignment = Alignment.Bottom
                ) {
                    IconButton(
                        onClick = { pickMedia.launch(androidx.activity.result.PickVisualMediaRequest(ActivityResultContracts.PickVisualMedia.ImageAndVideo)) },
                        enabled = !sending
                    ) {
                        Icon(Icons.Default.AttachFile, contentDescription = "Прикрепить", tint = WaveAccent)
                    }
                    OutlinedTextField(
                        value = text,
                        onValueChange = { text = it },
                        placeholder = { Text("Написать сообщение…") },
                        modifier = Modifier.weight(1f),
                        shape = RoundedCornerShape(24.dp),
                        colors = androidx.compose.material3.OutlinedTextFieldDefaults.colors(
                            unfocusedContainerColor = WavePanel2,
                            focusedContainerColor = WavePanel2
                        )
                    )
                    IconButton(
                        onClick = {
                            viewModel.sendText(text)
                            text = ""
                        },
                        enabled = text.isNotBlank()
                    ) {
                        Icon(Icons.Default.Send, contentDescription = "Отправить", tint = WaveAccent)
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
                        MessageBubbleView(message = message, isMine = isMine, showSender = conversation.isGroup && !isMine)
                    }
                }
            }
        }
    }
}

@Composable
private fun rememberCoroutineScopeCompat() = androidx.compose.runtime.rememberCoroutineScope()
