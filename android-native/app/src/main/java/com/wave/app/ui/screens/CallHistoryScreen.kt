package com.wave.app.ui.screens

import androidx.compose.foundation.layout.Arrangement
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
import androidx.compose.material.icons.filled.ArrowDownward
import androidx.compose.material.icons.filled.ArrowUpward
import androidx.compose.material.icons.filled.Call
import androidx.compose.material.icons.filled.Phone
import androidx.compose.material.icons.filled.Videocam
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
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.rememberCoroutineScope
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.unit.dp
import com.wave.app.call.CallKind
import com.wave.app.call.CallManager
import com.wave.app.model.CallLogEntry
import com.wave.app.model.Conversation
import com.wave.app.network.ApiClient
import com.wave.app.network.DirectBody
import com.wave.app.ui.components.Avatar
import com.wave.app.ui.components.formatTime
import com.wave.app.ui.theme.WaveAccent
import com.wave.app.ui.theme.WaveBg
import com.wave.app.ui.theme.WaveMuted
import com.wave.app.ui.theme.WaveMutedFaint
import com.wave.app.ui.theme.WavePanel
import kotlinx.coroutines.launch

private fun statusText(entry: CallLogEntry): Pair<String, Boolean> {
    return when (entry.status) {
        "answered" -> {
            val m = entry.durationSeconds / 60
            val s = entry.durationSeconds % 60
            val duration = "%d:%02d".format(m, s)
            (if (entry.isOutgoing) "Исходящий, $duration" else "Входящий, $duration") to false
        }
        "missed" -> (if (entry.isOutgoing) "Отменён" else "Пропущенный") to !entry.isOutgoing
        "declined" -> (if (entry.isOutgoing) "Отклонён" else "Отклонён вами") to entry.isOutgoing
        else -> (if (entry.isOutgoing) "Исходящий" else "Входящий") to false
    }
}

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun CallHistoryScreen(onBack: () -> Unit) {
    var calls by remember { mutableStateOf<List<CallLogEntry>>(emptyList()) }
    var loading by remember { mutableStateOf(true) }
    val scope = rememberCoroutineScope()

    LaunchedEffect(Unit) {
        runCatching { ApiClient.calls.list() }.onSuccess { calls = it.calls }
        loading = false
    }

    fun callBack(otherUserId: String, kind: CallKind) {
        scope.launch {
            runCatching { ApiClient.conversations.openDirect(DirectBody(otherUserId)) }
                .onSuccess { res -> CallManager.startCall(res.conversation, kind) }
        }
    }

    Scaffold(
        containerColor = WaveBg,
        topBar = {
            TopAppBar(
                title = { Text("Звонки", style = MaterialTheme.typography.headlineSmall) },
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
            if (loading) {
                CircularProgressIndicator(modifier = Modifier.align(Alignment.Center))
            } else if (calls.isEmpty()) {
                Column(
                    modifier = Modifier.align(Alignment.Center).padding(horizontal = 32.dp),
                    horizontalAlignment = Alignment.CenterHorizontally
                ) {
                    Icon(Icons.Default.Call, contentDescription = null, tint = WaveMutedFaint, modifier = Modifier)
                    Text("История звонков пуста", color = WaveMuted, modifier = Modifier.padding(top = 8.dp))
                    Text(
                        "Чтобы позвонить, откройте диалог и нажмите на значок трубки или камеры",
                        color = WaveMutedFaint,
                        style = MaterialTheme.typography.bodySmall,
                        modifier = Modifier.padding(top = 4.dp)
                    )
                }
            } else {
                LazyColumn(modifier = Modifier.fillMaxSize()) {
                    items(calls, key = { it.id }) { entry ->
                        val (text, isMissed) = statusText(entry)
                        Row(
                            modifier = Modifier.fillMaxWidth().padding(horizontal = 16.dp, vertical = 10.dp),
                            verticalAlignment = Alignment.CenterVertically
                        ) {
                            Avatar(
                                name = entry.otherUser.displayName,
                                colorHex = entry.otherUser.avatarColor,
                                size = 46,
                                avatarUrl = entry.otherUser.avatarUrl
                            )
                            Column(modifier = Modifier.padding(start = 12.dp).weight(1f)) {
                                Text(entry.otherUser.displayName, style = MaterialTheme.typography.bodyLarge)
                                Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(4.dp)) {
                                    Icon(
                                        if (entry.isOutgoing) Icons.Default.ArrowUpward else Icons.Default.ArrowDownward,
                                        contentDescription = null,
                                        tint = if (isMissed) androidx.compose.ui.graphics.Color(0xFFE74C3C) else WaveMuted,
                                        modifier = Modifier.padding(0.dp)
                                    )
                                    Text(
                                        text,
                                        color = if (isMissed) androidx.compose.ui.graphics.Color(0xFFE74C3C) else WaveMuted,
                                        style = MaterialTheme.typography.bodySmall
                                    )
                                }
                            }
                            Text(formatTime(entry.startedAt), color = WaveMutedFaint, style = MaterialTheme.typography.labelSmall)
                            IconButton(onClick = { callBack(entry.otherUser.id, if (entry.kind == "video") CallKind.VIDEO else CallKind.AUDIO) }) {
                                Icon(
                                    if (entry.kind == "video") Icons.Default.Videocam else Icons.Default.Phone,
                                    contentDescription = "Перезвонить",
                                    tint = WaveAccent
                                )
                            }
                        }
                    }
                }
            }
        }
    }
}
