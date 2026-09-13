package com.wave.app.ui.screens

import androidx.compose.foundation.background
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.ArrowBack
import androidx.compose.material.icons.filled.Logout
import androidx.compose.material3.ExperimentalMaterial3Api
import androidx.compose.material3.HorizontalDivider
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
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import com.wave.app.data.SessionStore
import com.wave.app.network.ApiClient
import com.wave.app.network.UpdateMeBody
import com.wave.app.ui.components.Avatar
import com.wave.app.ui.components.WaveButton
import com.wave.app.ui.components.WaveTextField
import com.wave.app.ui.theme.WaveBg
import com.wave.app.ui.theme.WaveMuted
import com.wave.app.ui.theme.WavePanel

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun SettingsScreen(session: SessionStore, onBack: () -> Unit, onLogout: () -> Unit) {
    val user = session.user
    var displayName by remember { mutableStateOf(user?.displayName ?: "") }
    var bio by remember { mutableStateOf(user?.bio ?: "") }
    var saving by remember { mutableStateOf(false) }
    var saved by remember { mutableStateOf(false) }
    var error by remember { mutableStateOf<String?>(null) }

    LaunchedEffect(saved) {
        if (saved) {
            kotlinx.coroutines.delay(1600)
            saved = false
        }
    }

    fun save() {
        if (saving) return
        saving = true
        error = null
    }

    LaunchedEffect(saving) {
        if (!saving) return@LaunchedEffect
        runCatching {
            ApiClient.auth.updateMe(UpdateMeBody(displayName = displayName.trim(), bio = bio.trim()))
        }.onSuccess { res ->
            session.user = res.user
            saved = true
        }.onFailure {
            error = "Не удалось сохранить"
        }
        saving = false
    }

    Scaffold(
        containerColor = WaveBg,
        topBar = {
            TopAppBar(
                title = { Text("Настройки") },
                navigationIcon = {
                    IconButton(onClick = onBack) {
                        Icon(Icons.Default.ArrowBack, contentDescription = "Назад")
                    }
                },
                colors = TopAppBarDefaults.topAppBarColors(containerColor = WavePanel)
            )
        }
    ) { padding ->
        Column(
            modifier = Modifier
                .fillMaxSize()
                .padding(padding)
                .padding(20.dp)
        ) {
            Column(modifier = Modifier.fillMaxWidth(), horizontalAlignment = Alignment.CenterHorizontally) {
                Avatar(name = user?.displayName ?: "?", colorHex = user?.avatarColor, size = 88)
                Spacer(modifier = Modifier.padding(top = 8.dp))
                Text("@${user?.username ?: ""}", color = WaveMuted, style = MaterialTheme.typography.bodyMedium)
            }

            Spacer(modifier = Modifier.padding(top = 28.dp))

            Column(
                modifier = Modifier
                    .fillMaxWidth()
                    .background(WavePanel, shape = RoundedCornerShape(18.dp))
                    .padding(18.dp)
            ) {
                Text("Профиль", style = MaterialTheme.typography.titleMedium, fontWeight = FontWeight.SemiBold)
                Spacer(modifier = Modifier.padding(top = 14.dp))

                if (error != null) {
                    Text(error ?: "", color = Color(0xFFFF6B6B), style = MaterialTheme.typography.bodySmall, modifier = Modifier.padding(bottom = 8.dp))
                }
                if (saved) {
                    Text("Сохранено", color = WaveMuted, style = MaterialTheme.typography.bodySmall, modifier = Modifier.padding(bottom = 8.dp))
                }

                WaveTextField(value = displayName, onValueChange = { displayName = it }, placeholder = "Имя")
                Spacer(modifier = Modifier.padding(top = 10.dp))
                WaveTextField(value = bio, onValueChange = { bio = it }, placeholder = "О себе")
                Spacer(modifier = Modifier.padding(top = 16.dp))
                WaveButton(text = "Сохранить", onClick = { save() }, loading = saving, enabled = displayName.isNotBlank())
            }

            Spacer(modifier = Modifier.padding(top = 24.dp))
            HorizontalDivider()
            Spacer(modifier = Modifier.padding(top = 8.dp))

            Row(
                modifier = Modifier
                    .fillMaxWidth()
                    .padding(vertical = 8.dp),
                verticalAlignment = Alignment.CenterVertically
            ) {
                IconButton(onClick = onLogout) {
                    Icon(Icons.Default.Logout, contentDescription = null, tint = Color(0xFFFF6B6B))
                }
                Text(
                    "Выйти из аккаунта",
                    color = Color(0xFFFF6B6B),
                    style = MaterialTheme.typography.bodyLarge,
                    modifier = Modifier.padding(start = 4.dp)
                )
            }

            Spacer(modifier = Modifier.weight(1f))
            Box(modifier = Modifier.fillMaxWidth(), contentAlignment = Alignment.Center) {
                Text("Wave · версия 1.0", color = WaveMuted, style = MaterialTheme.typography.labelSmall)
            }
        }
    }
}
