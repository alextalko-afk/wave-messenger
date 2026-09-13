package com.wave.app.ui.screens

import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.material3.Badge
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.ExperimentalMaterial3Api
import androidx.compose.material3.FloatingActionButton
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Scaffold
import androidx.compose.material3.Text
import androidx.compose.material3.TopAppBar
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.Add
import androidx.compose.material.icons.filled.Logout
import androidx.compose.runtime.Composable
import androidx.compose.runtime.collectAsState
import androidx.compose.runtime.getValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import com.wave.app.model.Conversation
import com.wave.app.ui.ChatListViewModel
import com.wave.app.ui.components.Avatar
import com.wave.app.ui.components.formatTime
import com.wave.app.ui.theme.WaveAccent
import com.wave.app.ui.theme.WaveBg
import com.wave.app.ui.theme.WaveMuted
import com.wave.app.ui.theme.WavePanel

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun ChatListScreen(
    viewModel: ChatListViewModel,
    onOpenConversation: (Conversation) -> Unit,
    onNewChat: () -> Unit,
    onLogout: () -> Unit
) {
    val conversations by viewModel.conversations.collectAsState()
    val loading by viewModel.loading.collectAsState()

    Scaffold(
        containerColor = WaveBg,
        topBar = {
            TopAppBar(
                title = { Text("Wave") },
                colors = androidx.compose.material3.TopAppBarDefaults.topAppBarColors(containerColor = WavePanel),
                actions = {
                    IconButton(onClick = onLogout) {
                        Icon(Icons.Default.Logout, contentDescription = "Выйти")
                    }
                }
            )
        },
        floatingActionButton = {
            FloatingActionButton(onClick = onNewChat, containerColor = WaveAccent) {
                Icon(Icons.Default.Add, contentDescription = "Новый чат", tint = androidx.compose.ui.graphics.Color.White)
            }
        }
    ) { padding ->
        Box(modifier = Modifier.fillMaxSize().padding(padding)) {
            if (loading && conversations.isEmpty()) {
                CircularProgressIndicator(modifier = Modifier.align(Alignment.Center))
            } else if (conversations.isEmpty()) {
                Text(
                    "Пока нет чатов",
                    color = WaveMuted,
                    modifier = Modifier.align(Alignment.Center)
                )
            } else {
                LazyColumn(modifier = Modifier.fillMaxSize()) {
                    items(conversations, key = { it.id }) { conv ->
                        ConversationRow(conv, onClick = { onOpenConversation(conv) })
                    }
                }
            }
        }
    }
}

@Composable
private fun ConversationRow(conv: Conversation, onClick: () -> Unit) {
    Row(
        modifier = Modifier
            .fillMaxWidth()
            .clickable(onClick = onClick)
            .padding(horizontal = 16.dp, vertical = 10.dp),
        verticalAlignment = Alignment.CenterVertically
    ) {
        Avatar(name = conv.name, colorHex = conv.avatarColor, size = 48)
        Column(modifier = Modifier.padding(start = 12.dp).weight(1f)) {
            Text(conv.name, fontWeight = FontWeight.SemiBold, maxLines = 1, overflow = TextOverflow.Ellipsis)
            val preview = when {
                conv.lastMessage == null -> "Нет сообщений"
                !conv.lastMessage.content.isNullOrBlank() -> conv.lastMessage.content
                conv.lastMessage.fileType?.startsWith("image/") == true -> "Фото"
                conv.lastMessage.fileType?.startsWith("video/") == true -> "Видео"
                conv.lastMessage.fileType?.startsWith("audio/") == true -> "Голосовое сообщение"
                else -> "Файл"
            }
            Text(preview, color = WaveMuted, maxLines = 1, overflow = TextOverflow.Ellipsis, style = MaterialTheme.typography.bodyMedium)
        }
        Column(horizontalAlignment = Alignment.End) {
            if (conv.lastMessage != null) {
                Text(formatTime(conv.lastMessage.createdAt), color = WaveMuted, style = MaterialTheme.typography.labelSmall)
            }
            if (conv.unreadCount > 0) {
                Badge(containerColor = WaveAccent, modifier = Modifier.padding(top = 4.dp)) {
                    Text(conv.unreadCount.toString())
                }
            }
        }
    }
}
