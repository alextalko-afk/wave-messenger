package com.wave.app.ui.screens

import androidx.compose.foundation.background
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
import androidx.compose.material.icons.filled.Check
import androidx.compose.material3.Checkbox
import androidx.compose.material3.ExperimentalMaterial3Api
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
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
import com.wave.app.network.GroupBody
import com.wave.app.network.SocketManager
import com.wave.app.ui.components.Avatar
import com.wave.app.ui.components.WaveButton
import com.wave.app.ui.components.WaveTextField
import com.wave.app.ui.theme.WaveAccent
import com.wave.app.ui.theme.WaveBg
import com.wave.app.ui.theme.WaveMuted
import com.wave.app.ui.theme.WavePanel
import kotlinx.coroutines.delay

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun NewGroupScreen(onBack: () -> Unit, onCreated: (Conversation) -> Unit) {
    var step by remember { mutableStateOf(1) } // 1 = pick members, 2 = name it
    var query by remember { mutableStateOf("") }
    var results by remember { mutableStateOf<List<User>>(emptyList()) }
    val selected = remember { mutableStateOf<Set<User>>(emptySet()) }
    var groupName by remember { mutableStateOf("") }
    var creating by remember { mutableStateOf(false) }

    LaunchedEffect(query) {
        if (query.isBlank()) {
            results = emptyList()
            return@LaunchedEffect
        }
        delay(300)
        runCatching { ApiClient.users.search(query) }.onSuccess { results = it.users }
    }

    fun toggle(user: User) {
        selected.value = if (selected.value.any { it.id == user.id }) {
            selected.value.filterNot { it.id == user.id }.toSet()
        } else {
            selected.value + user
        }
    }

    fun create() {
        if (groupName.isBlank() || selected.value.isEmpty() || creating) return
        creating = true
    }

    LaunchedEffect(creating) {
        if (!creating) return@LaunchedEffect
        runCatching {
            ApiClient.conversations.createGroup(GroupBody(groupName.trim(), selected.value.map { it.id }.toList()))
        }.onSuccess { res ->
            SocketManager.notifyConversationCreated(res.conversation.id, res.conversation.members.map { it.id })
            onCreated(res.conversation)
        }
        creating = false
    }

    Scaffold(
        containerColor = WaveBg,
        topBar = {
            TopAppBar(
                title = { Text(if (step == 1) "Добавить участников" else "Новая группа") },
                navigationIcon = {
                    IconButton(onClick = { if (step == 2) step = 1 else onBack() }) {
                        Icon(Icons.Default.ArrowBack, contentDescription = "Назад")
                    }
                },
                actions = {
                    if (step == 1 && selected.value.isNotEmpty()) {
                        IconButton(onClick = { step = 2 }) {
                            Icon(Icons.Default.Check, contentDescription = "Далее", tint = WaveAccent)
                        }
                    }
                },
                colors = TopAppBarDefaults.topAppBarColors(containerColor = WavePanel)
            )
        }
    ) { padding ->
        Box(modifier = Modifier.fillMaxSize().padding(padding)) {
            if (step == 1) {
                Column(Modifier.fillMaxSize()) {
                    WaveTextField(
                        value = query,
                        onValueChange = { query = it },
                        placeholder = "Поиск людей",
                        modifier = Modifier.padding(12.dp)
                    )
                    LazyColumn(modifier = Modifier.fillMaxSize()) {
                        items(results, key = { it.id }) { user ->
                            val isSelected = selected.value.any { it.id == user.id }
                            Row(
                                modifier = Modifier
                                    .fillMaxWidth()
                                    .clickable { toggle(user) }
                                    .padding(horizontal = 16.dp, vertical = 8.dp),
                                verticalAlignment = Alignment.CenterVertically
                            ) {
                                Avatar(name = user.displayName, colorHex = user.avatarColor, size = 44)
                                Column(modifier = Modifier.padding(start = 12.dp).weight(1f)) {
                                    Text(user.displayName)
                                    Text("@${user.username}", color = WaveMuted)
                                }
                                Checkbox(checked = isSelected, onCheckedChange = { toggle(user) })
                            }
                        }
                    }
                }
            } else {
                Column(Modifier.fillMaxSize().padding(20.dp)) {
                    Text("Участников: ${selected.value.size}", color = WaveMuted)
                    androidx.compose.foundation.layout.Spacer(modifier = Modifier.padding(top = 12.dp))
                    WaveTextField(
                        value = groupName,
                        onValueChange = { groupName = it },
                        placeholder = "Название группы"
                    )
                    androidx.compose.foundation.layout.Spacer(modifier = Modifier.padding(top = 16.dp))
                    WaveButton(
                        text = "Создать группу",
                        onClick = { create() },
                        enabled = groupName.isNotBlank(),
                        loading = creating
                    )
                }
            }
        }
    }
}
