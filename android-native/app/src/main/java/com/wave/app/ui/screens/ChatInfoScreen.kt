package com.wave.app.ui.screens

import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.ArrowBack
import androidx.compose.material.icons.filled.Description
import androidx.compose.material.icons.filled.Group
import androidx.compose.material.icons.filled.Image
import androidx.compose.material.icons.filled.Mic
import androidx.compose.material3.ExperimentalMaterial3Api
import androidx.compose.material3.HorizontalDivider
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.ModalBottomSheet
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
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import com.wave.app.model.Conversation
import com.wave.app.model.ConversationStats
import com.wave.app.model.SharedGroup
import com.wave.app.model.User
import com.wave.app.network.ApiClient
import com.wave.app.network.DirectBody
import com.wave.app.network.SocketManager
import com.wave.app.ui.components.Avatar
import com.wave.app.ui.components.WaveButton
import com.wave.app.ui.theme.WaveBg
import com.wave.app.ui.theme.WaveMuted
import com.wave.app.ui.theme.WavePanel

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun ChatInfoScreen(conversation: Conversation, onBack: () -> Unit, onOpenConversation: (Conversation) -> Unit) {
    var stats by remember { mutableStateOf<ConversationStats?>(null) }
    var sharedGroups by remember { mutableStateOf<List<SharedGroup>>(emptyList()) }
    var selectedMember by remember { mutableStateOf<User?>(null) }
    var openingChat by remember { mutableStateOf(false) }

    LaunchedEffect(openingChat) {
        val member = selectedMember
        if (!openingChat || member == null) return@LaunchedEffect
        runCatching { ApiClient.conversations.openDirect(DirectBody(member.id)) }
            .onSuccess { res ->
                SocketManager.notifyConversationCreated(res.conversation.id, res.conversation.members.map { it.id })
                selectedMember = null
                onOpenConversation(res.conversation)
            }
        openingChat = false
    }

    LaunchedEffect(conversation.id) {
        runCatching { ApiClient.conversations.stats(conversation.id) }.onSuccess { stats = it }
        if (!conversation.isGroup) {
            runCatching { ApiClient.conversations.sharedGroups(conversation.id) }.onSuccess { sharedGroups = it.groups }
        }
    }

    Scaffold(
        containerColor = WaveBg,
        topBar = {
            TopAppBar(
                title = { Text(if (conversation.isGroup) "Группа" else "Контакт") },
                navigationIcon = {
                    IconButton(onClick = onBack) {
                        Icon(Icons.Default.ArrowBack, contentDescription = "Назад")
                    }
                },
                colors = TopAppBarDefaults.topAppBarColors(containerColor = WavePanel)
            )
        }
    ) { padding ->
        LazyColumn(modifier = Modifier.fillMaxSize().padding(padding)) {
            item {
                Column(
                    modifier = Modifier.fillMaxWidth().padding(24.dp),
                    horizontalAlignment = Alignment.CenterHorizontally
                ) {
                    Avatar(name = conversation.name, colorHex = conversation.avatarColor, size = 96, avatarUrl = conversation.avatarUrl)
                    androidx.compose.foundation.layout.Spacer(modifier = Modifier.padding(top = 12.dp))
                    Text(conversation.name, style = MaterialTheme.typography.headlineSmall, fontWeight = FontWeight.SemiBold)
                    if (conversation.isGroup) {
                        Text("${conversation.members.size} участников", color = WaveMuted)
                    } else {
                        conversation.otherUser?.let { user ->
                            Text("@${user.username}", color = WaveMuted)
                            if (!user.bio.isNullOrBlank()) {
                                Text(user.bio, color = WaveMuted, modifier = Modifier.padding(top = 8.dp))
                            }
                        }
                    }
                }
                HorizontalDivider()
            }

            stats?.let { s ->
                item {
                    Row(modifier = Modifier.fillMaxWidth().padding(16.dp)) {
                        StatItem(icon = Icons.Default.Image, label = "Фото", value = s.photos)
                        StatItem(icon = Icons.Default.Mic, label = "Голосовые", value = s.voice)
                        StatItem(icon = Icons.Default.Description, label = "Файлы", value = s.files)
                    }
                    HorizontalDivider()
                }
            }

            if (conversation.isGroup) {
                item {
                    Text(
                        "Участники",
                        color = WaveMuted,
                        modifier = Modifier.padding(horizontal = 16.dp, vertical = 8.dp)
                    )
                }
                items(conversation.members, key = { it.id }) { member ->
                    Row(
                        modifier = Modifier
                            .fillMaxWidth()
                            .clickable { selectedMember = member }
                            .padding(horizontal = 16.dp, vertical = 8.dp),
                        verticalAlignment = Alignment.CenterVertically
                    ) {
                        Avatar(name = member.displayName, colorHex = member.avatarColor, size = 40, avatarUrl = member.avatarUrl)
                        Column(modifier = Modifier.padding(start = 12.dp)) {
                            Text(member.displayName)
                            Text("@${member.username}", color = WaveMuted, style = MaterialTheme.typography.labelSmall)
                        }
                    }
                }
            } else if (sharedGroups.isNotEmpty()) {
                item {
                    Text(
                        "Общие группы",
                        color = WaveMuted,
                        modifier = Modifier.padding(horizontal = 16.dp, vertical = 8.dp)
                    )
                }
                items(sharedGroups, key = { it.id }) { group ->
                    Row(
                        modifier = Modifier.fillMaxWidth().padding(horizontal = 16.dp, vertical = 8.dp),
                        verticalAlignment = Alignment.CenterVertically
                    ) {
                        Avatar(name = group.name, colorHex = group.avatarColor, size = 40)
                        Column(modifier = Modifier.padding(start = 12.dp)) {
                            Text(group.name)
                            Text("${group.memberCount} участников", color = WaveMuted, style = MaterialTheme.typography.labelSmall)
                        }
                    }
                }
            }
        }
    }

    selectedMember?.let { member ->
        ModalBottomSheet(onDismissRequest = { selectedMember = null }, containerColor = WavePanel) {
            Column(
                modifier = Modifier.fillMaxWidth().padding(24.dp),
                horizontalAlignment = Alignment.CenterHorizontally
            ) {
                Avatar(name = member.displayName, colorHex = member.avatarColor, size = 88, avatarUrl = member.avatarUrl)
                androidx.compose.foundation.layout.Spacer(modifier = Modifier.padding(top = 12.dp))
                Text(member.displayName, style = MaterialTheme.typography.titleLarge, fontWeight = FontWeight.SemiBold)
                Text("@${member.username}", color = WaveMuted)
                if (!member.bio.isNullOrBlank()) {
                    Text(member.bio, color = WaveMuted, modifier = Modifier.padding(top = 8.dp))
                }
                androidx.compose.foundation.layout.Spacer(modifier = Modifier.padding(top = 20.dp))
                WaveButton(text = "Написать", onClick = { openingChat = true }, loading = openingChat)
            }
        }
    }
}

@Composable
private fun androidx.compose.foundation.layout.RowScope.StatItem(icon: androidx.compose.ui.graphics.vector.ImageVector, label: String, value: Int) {
    Column(
        modifier = Modifier.weight(1f),
        horizontalAlignment = Alignment.CenterHorizontally
    ) {
        Icon(icon, contentDescription = null, tint = WaveMuted)
        Text(value.toString(), fontWeight = FontWeight.SemiBold)
        Text(label, color = WaveMuted, style = MaterialTheme.typography.labelSmall)
    }
}
