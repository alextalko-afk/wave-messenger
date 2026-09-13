package com.wave.app.ui.screens

import androidx.compose.foundation.ExperimentalFoundationApi
import androidx.compose.foundation.background
import androidx.compose.foundation.combinedClickable
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
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.Add
import androidx.compose.material.icons.filled.ArrowBack
import androidx.compose.material.icons.filled.Group
import androidx.compose.material.icons.filled.MarkChatUnread
import androidx.compose.material.icons.filled.Notifications
import androidx.compose.material.icons.filled.NotificationsOff
import androidx.compose.material.icons.filled.Person
import androidx.compose.material.icons.filled.PushPin
import androidx.compose.material.icons.filled.Delete
import androidx.compose.material.icons.filled.DeleteSweep
import androidx.compose.material.icons.filled.ChatBubbleOutline
import androidx.compose.material.icons.filled.Search
import androidx.compose.material.icons.filled.Settings
import androidx.compose.material3.Badge
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.DropdownMenu
import androidx.compose.material3.DropdownMenuItem
import androidx.compose.material3.ExperimentalMaterial3Api
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Scaffold
import androidx.compose.material3.Surface
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
import androidx.compose.ui.draw.shadow
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import com.wave.app.model.Conversation
import com.wave.app.model.User
import com.wave.app.network.ApiClient
import com.wave.app.network.DirectBody
import com.wave.app.network.SocketManager
import com.wave.app.ui.ChatListViewModel
import com.wave.app.ui.components.Avatar
import com.wave.app.ui.components.WaveTextField
import com.wave.app.ui.components.formatTime
import com.wave.app.ui.theme.WaveAccent
import com.wave.app.ui.theme.WaveAccent2
import com.wave.app.ui.theme.WaveAccentDeep
import com.wave.app.ui.theme.WaveBg
import com.wave.app.ui.theme.WaveMuted
import com.wave.app.ui.theme.WaveMutedFaint
import com.wave.app.ui.theme.WaveOnAccent
import com.wave.app.ui.theme.WavePanel
import kotlinx.coroutines.delay

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun ChatListScreen(
    viewModel: ChatListViewModel,
    onOpenConversation: (Conversation) -> Unit,
    onNewChat: () -> Unit,
    onNewGroup: () -> Unit,
    onOpenSettings: () -> Unit
) {
    val conversations by viewModel.conversations.collectAsState()
    val loading by viewModel.loading.collectAsState()
    var fabMenuOpen by remember { mutableStateOf(false) }

    var searchActive by remember { mutableStateOf(false) }
    var query by remember { mutableStateOf("") }
    var userResults by remember { mutableStateOf<List<User>>(emptyList()) }
    var searching by remember { mutableStateOf(false) }
    var openingUserId by remember { mutableStateOf<String?>(null) }

    LaunchedEffect(query) {
        if (query.isBlank()) {
            userResults = emptyList()
            return@LaunchedEffect
        }
        delay(300)
        searching = true
        runCatching { ApiClient.users.search(query) }.onSuccess { userResults = it.users }
        searching = false
    }

    LaunchedEffect(openingUserId) {
        val userId = openingUserId ?: return@LaunchedEffect
        runCatching { ApiClient.conversations.openDirect(DirectBody(userId)) }
            .onSuccess { res ->
                SocketManager.notifyConversationCreated(res.conversation.id, res.conversation.members.map { it.id })
                searchActive = false
                query = ""
                onOpenConversation(res.conversation)
            }
        openingUserId = null
    }

    Scaffold(
        containerColor = WaveBg,
        topBar = {
            TopAppBar(
                title = {
                    if (searchActive) {
                        WaveTextField(
                            value = query,
                            onValueChange = { query = it },
                            placeholder = "Поиск по логину или имени",
                            modifier = Modifier.fillMaxWidth()
                        )
                    } else {
                        Text("Wave", style = MaterialTheme.typography.headlineLarge)
                    }
                },
                navigationIcon = {
                    if (searchActive) {
                        IconButton(onClick = { searchActive = false; query = "" }) {
                            Icon(Icons.Default.ArrowBack, contentDescription = "Закрыть поиск")
                        }
                    }
                },
                colors = TopAppBarDefaults.topAppBarColors(containerColor = WavePanel),
                actions = {
                    if (!searchActive) {
                        IconButton(onClick = { searchActive = true }) {
                            Icon(Icons.Default.Search, contentDescription = "Поиск", tint = WaveMuted)
                        }
                        IconButton(onClick = onOpenSettings) {
                            Icon(Icons.Default.Settings, contentDescription = "Настройки", tint = WaveMuted)
                        }
                    }
                }
            )
        },
        floatingActionButton = {
            if (!searchActive) {
                Box {
                    Surface(
                        onClick = { fabMenuOpen = true },
                        shape = androidx.compose.foundation.shape.CircleShape,
                        color = Color.Transparent,
                        modifier = Modifier
                            .size(58.dp)
                            .shadow(elevation = 16.dp, shape = androidx.compose.foundation.shape.CircleShape, ambientColor = WaveAccent, spotColor = WaveAccent)
                    ) {
                        Box(
                            modifier = Modifier
                                .fillMaxSize()
                                .background(Brush.linearGradient(listOf(WaveAccent, WaveAccent2, WaveAccentDeep))),
                            contentAlignment = Alignment.Center
                        ) {
                            Icon(Icons.Default.Add, contentDescription = "Новый чат", tint = WaveOnAccent)
                        }
                    }
                    DropdownMenu(expanded = fabMenuOpen, onDismissRequest = { fabMenuOpen = false }) {
                        DropdownMenuItem(
                            text = { Text("Новый чат") },
                            leadingIcon = { Icon(Icons.Default.Person, contentDescription = null) },
                            onClick = { fabMenuOpen = false; onNewChat() }
                        )
                        DropdownMenuItem(
                            text = { Text("Новая группа") },
                            leadingIcon = { Icon(Icons.Default.Group, contentDescription = null) },
                            onClick = { fabMenuOpen = false; onNewGroup() }
                        )
                    }
                }
            }
        }
    ) { padding ->
        Box(modifier = Modifier.fillMaxSize().padding(padding)) {
            if (searchActive) {
                if (searching || openingUserId != null) {
                    CircularProgressIndicator(modifier = Modifier.align(Alignment.Center))
                } else if (query.isNotBlank() && userResults.isEmpty()) {
                    Text("Никого не нашлось", color = WaveMuted, modifier = Modifier.align(Alignment.Center))
                } else {
                    LazyColumn(modifier = Modifier.fillMaxSize()) {
                        items(userResults, key = { it.id }) { user ->
                            Row(
                                modifier = Modifier
                                    .fillMaxWidth()
                                    .clickable { openingUserId = user.id }
                                    .padding(horizontal = 16.dp, vertical = 10.dp),
                                verticalAlignment = Alignment.CenterVertically
                            ) {
                                Avatar(name = user.displayName, colorHex = user.avatarColor, size = 46)
                                Column(modifier = Modifier.padding(start = 12.dp)) {
                                    Text(user.displayName, style = MaterialTheme.typography.titleMedium)
                                    Text("@${user.username}", color = WaveMuted, style = MaterialTheme.typography.bodyMedium)
                                }
                            }
                        }
                    }
                }
            } else if (loading && conversations.isEmpty()) {
                CircularProgressIndicator(modifier = Modifier.align(Alignment.Center))
            } else if (conversations.isEmpty()) {
                Column(
                    modifier = Modifier.align(Alignment.Center),
                    horizontalAlignment = Alignment.CenterHorizontally
                ) {
                    Box(
                        modifier = Modifier
                            .size(72.dp)
                            .background(WavePanel, shape = androidx.compose.foundation.shape.CircleShape),
                        contentAlignment = Alignment.Center
                    ) {
                        Icon(Icons.Default.ChatBubbleOutline, contentDescription = null, tint = WaveMutedFaint, modifier = Modifier.size(32.dp))
                    }
                    androidx.compose.foundation.layout.Spacer(modifier = Modifier.padding(top = 16.dp))
                    Text("Пока нет чатов", color = WaveMuted, style = MaterialTheme.typography.bodyLarge)
                    Text("Нажмите + чтобы начать", color = WaveMutedFaint, style = MaterialTheme.typography.bodySmall)
                }
            } else {
                LazyColumn(modifier = Modifier.fillMaxSize()) {
                    items(conversations, key = { it.id }) { conv ->
                        ConversationRow(
                            conv,
                            onClick = { onOpenConversation(conv) },
                            onPin = { viewModel.togglePin(conv) },
                            onMute = { viewModel.toggleMute(conv) },
                            onMarkUnread = { viewModel.markUnread(conv) },
                            onClear = { viewModel.clearHistory(conv) },
                            onDelete = { viewModel.deleteConversation(conv) }
                        )
                    }
                }
            }
        }
    }
}

@OptIn(ExperimentalFoundationApi::class)
@Composable
private fun ConversationRow(
    conv: Conversation,
    onClick: () -> Unit,
    onPin: () -> Unit,
    onMute: () -> Unit,
    onMarkUnread: () -> Unit,
    onClear: () -> Unit,
    onDelete: () -> Unit
) {
    var menuOpen by remember { mutableStateOf(false) }
    Box {
        Row(
            modifier = Modifier
                .fillMaxWidth()
                .combinedClickable(onClick = onClick, onLongClick = { menuOpen = true })
                .padding(horizontal = 16.dp, vertical = 10.dp),
            verticalAlignment = Alignment.CenterVertically
        ) {
            Avatar(name = conv.name, colorHex = conv.avatarColor, size = 52)
            Column(modifier = Modifier.padding(start = 14.dp).weight(1f)) {
                Row(verticalAlignment = Alignment.CenterVertically) {
                    Text(
                        conv.name,
                        style = MaterialTheme.typography.titleMedium,
                        maxLines = 1,
                        overflow = TextOverflow.Ellipsis
                    )
                    if (conv.muted) {
                        Icon(
                            Icons.Default.NotificationsOff,
                            contentDescription = "Без звука",
                            tint = WaveMuted,
                            modifier = Modifier.padding(start = 4.dp).size(14.dp)
                        )
                    }
                }
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
                if (conv.pinned) {
                    Icon(Icons.Default.PushPin, contentDescription = "Закреплён", tint = WaveMuted, modifier = Modifier.size(14.dp))
                }
                if (conv.lastMessage != null) {
                    Text(formatTime(conv.lastMessage.createdAt), color = WaveMuted, style = MaterialTheme.typography.labelSmall)
                }
                if (conv.unreadCount > 0) {
                    Badge(containerColor = WaveAccent, contentColor = WaveOnAccent, modifier = Modifier.padding(top = 4.dp)) {
                        Text(conv.unreadCount.toString())
                    }
                }
            }
        }
        DropdownMenu(expanded = menuOpen, onDismissRequest = { menuOpen = false }) {
            DropdownMenuItem(
                text = { Text(if (conv.pinned) "Открепить" else "Закрепить") },
                leadingIcon = { Icon(Icons.Default.PushPin, contentDescription = null) },
                onClick = { menuOpen = false; onPin() }
            )
            DropdownMenuItem(
                text = { Text(if (conv.muted) "Включить уведомления" else "Отключить уведомления") },
                leadingIcon = { Icon(if (conv.muted) Icons.Default.Notifications else Icons.Default.NotificationsOff, contentDescription = null) },
                onClick = { menuOpen = false; onMute() }
            )
            DropdownMenuItem(
                text = { Text("Отметить непрочитанным") },
                leadingIcon = { Icon(Icons.Default.MarkChatUnread, contentDescription = null) },
                onClick = { menuOpen = false; onMarkUnread() }
            )
            DropdownMenuItem(
                text = { Text("Очистить историю") },
                leadingIcon = { Icon(Icons.Default.DeleteSweep, contentDescription = null) },
                onClick = { menuOpen = false; onClear() }
            )
            DropdownMenuItem(
                text = { Text("Удалить чат") },
                leadingIcon = { Icon(Icons.Default.Delete, contentDescription = null) },
                onClick = { menuOpen = false; onDelete() }
            )
        }
    }
}
