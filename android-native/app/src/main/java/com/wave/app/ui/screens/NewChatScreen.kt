package com.wave.app.ui.screens

import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.ArrowBack
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.ExperimentalMaterial3Api
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.Scaffold
import androidx.compose.material3.Text
import androidx.compose.material3.TopAppBar
import androidx.compose.material3.TopAppBarDefaults
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.unit.dp
import com.wave.app.model.Conversation
import com.wave.app.model.User
import com.wave.app.network.ApiClient
import com.wave.app.network.DirectBody
import com.wave.app.network.SocketManager
import com.wave.app.ui.components.Avatar
import com.wave.app.ui.theme.WaveBg
import com.wave.app.ui.theme.WaveMuted
import com.wave.app.ui.theme.WavePanel
import kotlinx.coroutines.delay

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun NewChatScreen(onBack: () -> Unit, onOpen: (Conversation) -> Unit) {
    var query by remember { mutableStateOf("") }
    var results by remember { mutableStateOf<List<User>>(emptyList()) }
    var loading by remember { mutableStateOf(false) }
    var openingUserId by remember { mutableStateOf<String?>(null) }

    LaunchedEffect(query) {
        if (query.isBlank()) {
            results = emptyList()
            return@LaunchedEffect
        }
        delay(300)
        loading = true
        runCatching { ApiClient.users.search(query) }.onSuccess { results = it.users }
        loading = false
    }

    LaunchedEffect(openingUserId) {
        val userId = openingUserId ?: return@LaunchedEffect
        runCatching { ApiClient.conversations.openDirect(DirectBody(userId)) }
            .onSuccess { conv ->
                SocketManager.notifyConversationCreated(conv.conversation.id, conv.conversation.members.map { it.id })
                onOpen(conv.conversation)
            }
        openingUserId = null
    }

    Scaffold(
        containerColor = WaveBg,
        topBar = {
            TopAppBar(
                title = {
                    OutlinedTextField(
                        value = query,
                        onValueChange = { query = it },
                        placeholder = { Text("Поиск по логину или имени") },
                        singleLine = true,
                        modifier = Modifier.fillMaxWidth()
                    )
                },
                navigationIcon = {
                    IconButton(onClick = onBack) {
                        Icon(Icons.Default.ArrowBack, contentDescription = "Назад")
                    }
                },
                colors = TopAppBarDefaults.topAppBarColors(containerColor = WavePanel)
            )
        }
    ) { padding ->
        Box(modifier = Modifier.fillMaxSize().padding(padding)) {
            if (loading || openingUserId != null) {
                CircularProgressIndicator(modifier = Modifier.align(Alignment.Center))
            } else if (results.isEmpty() && query.isNotBlank()) {
                Text("Никого не нашлось", color = WaveMuted, modifier = Modifier.align(Alignment.Center))
            } else {
                LazyColumn(modifier = Modifier.fillMaxSize()) {
                    items(results, key = { it.id }) { user ->
                        Row(
                            modifier = Modifier
                                .fillMaxWidth()
                                .clickable { openingUserId = user.id }
                                .padding(horizontal = 16.dp, vertical = 10.dp),
                            verticalAlignment = Alignment.CenterVertically
                        ) {
                            Avatar(name = user.displayName, colorHex = user.avatarColor, size = 44)
                            androidx.compose.foundation.layout.Column(modifier = Modifier.padding(start = 12.dp)) {
                                Text(user.displayName)
                                Text("@${user.username}", color = WaveMuted)
                            }
                        }
                    }
                }
            }
        }
    }
}
