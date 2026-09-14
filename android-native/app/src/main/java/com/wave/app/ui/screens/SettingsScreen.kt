package com.wave.app.ui.screens

import androidx.activity.compose.rememberLauncherForActivityResult
import androidx.activity.result.contract.ActivityResultContracts
import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.ArrowBack
import androidx.compose.material.icons.filled.Check
import androidx.compose.material.icons.filled.ChatBubble
import androidx.compose.material.icons.filled.Edit
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
import androidx.compose.runtime.rememberCoroutineScope
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.input.KeyboardType
import androidx.compose.ui.unit.dp
import com.wave.app.data.AppIconVariant
import com.wave.app.data.GoogleSignInResult
import com.wave.app.data.SessionStore
import com.wave.app.data.getCurrentAppIcon
import com.wave.app.data.requestGoogleIdToken
import com.wave.app.data.setAppIcon
import com.wave.app.network.ApiClient
import com.wave.app.network.ChangePasswordBody
import com.wave.app.network.LinkGoogleBody
import com.wave.app.network.UpdateMeBody
import kotlinx.coroutines.launch
import com.wave.app.ui.components.Avatar
import com.wave.app.ui.components.WaveButton
import com.wave.app.ui.components.WaveTextField
import com.wave.app.ui.theme.WaveAccent
import com.wave.app.ui.theme.WaveAccent2
import com.wave.app.ui.theme.WaveAccentDeep
import com.wave.app.ui.theme.WaveBg
import com.wave.app.ui.theme.WaveMuted
import com.wave.app.ui.theme.WaveOnAccent
import com.wave.app.ui.theme.WavePanel
import com.wave.app.ui.theme.WaveText
import com.wave.app.ui.theme.WaveThemeVariant
import com.wave.app.ui.theme.currentWaveAppearance
import com.wave.app.ui.theme.currentWaveThemeVariant
import com.wave.app.ui.theme.setWaveTheme

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun SettingsScreen(session: SessionStore, onBack: () -> Unit, onLogout: () -> Unit) {
    val context = LocalContext.current
    val user = session.user

    var displayName by remember { mutableStateOf(user?.displayName ?: "") }
    var username by remember { mutableStateOf(user?.username ?: "") }
    var bio by remember { mutableStateOf(user?.bio ?: "") }
    var savingProfile by remember { mutableStateOf(false) }
    var profileSaved by remember { mutableStateOf(false) }
    var profileError by remember { mutableStateOf<String?>(null) }

    var currentPassword by remember { mutableStateOf("") }
    var newPassword by remember { mutableStateOf("") }
    var confirmPassword by remember { mutableStateOf("") }
    var savingPassword by remember { mutableStateOf(false) }
    var passwordSaved by remember { mutableStateOf(false) }
    var passwordError by remember { mutableStateOf<String?>(null) }

    var iconVariant by remember { mutableStateOf(getCurrentAppIcon(context)) }
    val scope = rememberCoroutineScope()

    var avatarUrl by remember { mutableStateOf(user?.avatarUrl) }
    var avatarBusy by remember { mutableStateOf(false) }
    var avatarError by remember { mutableStateOf<String?>(null) }
    val pickAvatar = rememberLauncherForActivityResult(ActivityResultContracts.GetContent()) { uri: android.net.Uri? ->
        if (uri == null) return@rememberLauncherForActivityResult
        avatarBusy = true
        avatarError = null
        scope.launch {
            runCatching {
                val part = com.wave.app.data.uriToResizedAvatarMultipart(context, uri)
                ApiClient.upload.uploadAvatar(part)
            }.onSuccess { res ->
                session.user = res.user
                avatarUrl = res.user.avatarUrl
            }.onFailure {
                avatarError = "Не удалось загрузить фото"
            }
            avatarBusy = false
        }
    }

    fun deleteAvatar() {
        avatarBusy = true
        avatarError = null
        scope.launch {
            runCatching { ApiClient.upload.deleteAvatar() }
                .onSuccess { res ->
                    session.user = res.user
                    avatarUrl = res.user.avatarUrl
                }
                .onFailure { avatarError = "Не удалось удалить фото" }
            avatarBusy = false
        }
    }

    var googleLinked by remember { mutableStateOf(user?.hasGoogle ?: false) }
    var googleBusy by remember { mutableStateOf(false) }
    var googleError by remember { mutableStateOf<String?>(null) }

    fun linkGoogleAccount() {
        if (googleBusy || googleLinked) return
        googleBusy = true
        googleError = null
        scope.launch {
            when (val result = requestGoogleIdToken(context, filterByAuthorizedAccounts = false)) {
                is GoogleSignInResult.Success -> {
                    runCatching { ApiClient.auth.linkGoogle(LinkGoogleBody(result.idToken)) }
                        .onSuccess { res ->
                            session.user = res.user
                            googleLinked = true
                        }
                        .onFailure { e ->
                            googleError = (e as? retrofit2.HttpException)?.let {
                                runCatching {
                                    com.google.gson.JsonParser.parseString(it.response()?.errorBody()?.string()).asJsonObject.get("error")?.asString
                                }.getOrNull()
                            } ?: "Не удалось привязать аккаунт"
                        }
                }
                is GoogleSignInResult.Failure -> googleError = result.message
                GoogleSignInResult.Cancelled -> {}
            }
            googleBusy = false
        }
    }

    LaunchedEffect(profileSaved) {
        if (profileSaved) {
            kotlinx.coroutines.delay(1600)
            profileSaved = false
        }
    }
    LaunchedEffect(passwordSaved) {
        if (passwordSaved) {
            kotlinx.coroutines.delay(1600)
            passwordSaved = false
        }
    }

    fun saveProfile() {
        if (savingProfile || username.trim().length < 3) return
        savingProfile = true
        profileError = null
    }

    LaunchedEffect(savingProfile) {
        if (!savingProfile) return@LaunchedEffect
        runCatching {
            ApiClient.auth.updateMe(
                UpdateMeBody(displayName = displayName.trim(), bio = bio.trim(), username = username.trim())
            )
        }.onSuccess { res ->
            session.user = res.user
            profileSaved = true
        }.onFailure { e ->
            profileError = (e as? retrofit2.HttpException)?.let {
                runCatching {
                    com.google.gson.JsonParser.parseString(it.response()?.errorBody()?.string()).asJsonObject.get("error")?.asString
                }.getOrNull()
            } ?: "Не удалось сохранить"
        }
        savingProfile = false
    }

    fun savePassword() {
        if (savingPassword) return
        if (newPassword.length < 4) {
            passwordError = "Новый пароль от 4 символов"
            return
        }
        if (newPassword != confirmPassword) {
            passwordError = "Пароли не совпадают"
            return
        }
        savingPassword = true
        passwordError = null
    }

    LaunchedEffect(savingPassword) {
        if (!savingPassword) return@LaunchedEffect
        runCatching {
            ApiClient.auth.changePassword(ChangePasswordBody(currentPassword, newPassword))
        }.onSuccess {
            passwordSaved = true
            currentPassword = ""
            newPassword = ""
            confirmPassword = ""
        }.onFailure { e ->
            passwordError = (e as? retrofit2.HttpException)?.let {
                runCatching {
                    com.google.gson.JsonParser.parseString(it.response()?.errorBody()?.string()).asJsonObject.get("error")?.asString
                }.getOrNull()
            } ?: "Не удалось сохранить"
        }
        savingPassword = false
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
        LazyColumn(
            modifier = Modifier
                .fillMaxSize()
                .padding(padding)
                .padding(20.dp)
        ) {
            item {
                Column(modifier = Modifier.fillMaxWidth(), horizontalAlignment = Alignment.CenterHorizontally) {
                    Box(
                        modifier = Modifier.clickable(enabled = !avatarBusy) { pickAvatar.launch("image/*") },
                        contentAlignment = Alignment.BottomEnd
                    ) {
                        Avatar(name = user?.displayName ?: "?", colorHex = user?.avatarColor, size = 88, avatarUrl = avatarUrl)
                        Box(
                            modifier = Modifier
                                .size(28.dp)
                                .background(WaveAccent, shape = CircleShape)
                                .border(2.dp, WaveBg, CircleShape),
                            contentAlignment = Alignment.Center
                        ) {
                            Icon(
                                Icons.Default.Edit,
                                contentDescription = "Изменить фото",
                                tint = Color.White,
                                modifier = Modifier.size(14.dp)
                            )
                        }
                    }
                    Spacer(modifier = Modifier.padding(top = 8.dp))
                    Text("@${user?.username ?: ""}", color = WaveMuted, style = MaterialTheme.typography.bodyMedium)
                    if (avatarBusy) {
                        Text("Загружаем…", color = WaveMuted, style = MaterialTheme.typography.labelSmall)
                    }
                    if (avatarError != null) {
                        Text(avatarError ?: "", color = Color(0xFFFF6B6B), style = MaterialTheme.typography.labelSmall)
                    }
                    if (avatarUrl != null && !avatarBusy) {
                        Text(
                            "Удалить фото",
                            color = Color(0xFFFF6B6B),
                            style = MaterialTheme.typography.labelSmall,
                            modifier = Modifier
                                .padding(top = 4.dp)
                                .clickable { deleteAvatar() }
                        )
                    }
                }

                Spacer(modifier = Modifier.padding(top = 28.dp))

                SectionCard(title = "Профиль") {
                    if (profileError != null) {
                        Text(profileError ?: "", color = Color(0xFFFF6B6B), style = MaterialTheme.typography.bodySmall, modifier = Modifier.padding(bottom = 8.dp))
                    }
                    if (profileSaved) {
                        Text("Сохранено", color = WaveMuted, style = MaterialTheme.typography.bodySmall, modifier = Modifier.padding(bottom = 8.dp))
                    }

                    WaveTextField(value = displayName, onValueChange = { displayName = it }, placeholder = "Имя")
                    Spacer(modifier = Modifier.padding(top = 10.dp))
                    WaveTextField(value = username, onValueChange = { username = it.filter { c -> !c.isWhitespace() } }, placeholder = "Логин (@username)")
                    Spacer(modifier = Modifier.padding(top = 10.dp))
                    WaveTextField(value = bio, onValueChange = { bio = it }, placeholder = "О себе")
                    Spacer(modifier = Modifier.padding(top = 16.dp))
                    WaveButton(
                        text = "Сохранить",
                        onClick = { saveProfile() },
                        loading = savingProfile,
                        enabled = displayName.isNotBlank() && username.trim().length >= 3
                    )
                }

                Spacer(modifier = Modifier.padding(top = 20.dp))

                SectionCard(title = "Смена пароля") {
                    if (passwordError != null) {
                        Text(passwordError ?: "", color = Color(0xFFFF6B6B), style = MaterialTheme.typography.bodySmall, modifier = Modifier.padding(bottom = 8.dp))
                    }
                    if (passwordSaved) {
                        Text("Пароль изменён", color = WaveMuted, style = MaterialTheme.typography.bodySmall, modifier = Modifier.padding(bottom = 8.dp))
                    }

                    WaveTextField(
                        value = currentPassword,
                        onValueChange = { currentPassword = it },
                        placeholder = "Текущий пароль",
                        isPassword = true,
                        keyboardType = KeyboardType.Password
                    )
                    Spacer(modifier = Modifier.padding(top = 10.dp))
                    WaveTextField(
                        value = newPassword,
                        onValueChange = { newPassword = it },
                        placeholder = "Новый пароль",
                        isPassword = true,
                        keyboardType = KeyboardType.Password
                    )
                    Spacer(modifier = Modifier.padding(top = 10.dp))
                    WaveTextField(
                        value = confirmPassword,
                        onValueChange = { confirmPassword = it },
                        placeholder = "Повторите новый пароль",
                        isPassword = true,
                        keyboardType = KeyboardType.Password
                    )
                    Spacer(modifier = Modifier.padding(top = 16.dp))
                    WaveButton(
                        text = "Сменить пароль",
                        onClick = { savePassword() },
                        loading = savingPassword,
                        enabled = currentPassword.isNotBlank() && newPassword.isNotBlank() && confirmPassword.isNotBlank()
                    )
                }

                Spacer(modifier = Modifier.padding(top = 20.dp))

                SectionCard(title = "Google-аккаунт") {
                    if (googleError != null) {
                        Text(googleError ?: "", color = Color(0xFFFF6B6B), style = MaterialTheme.typography.bodySmall, modifier = Modifier.padding(bottom = 8.dp))
                    }
                    if (googleLinked) {
                        Text("Google-аккаунт привязан", color = WaveMuted, style = MaterialTheme.typography.bodyMedium)
                    } else {
                        Text(
                            "Привяжите Google, чтобы входить в аккаунт в один клик",
                            color = WaveMuted,
                            style = MaterialTheme.typography.bodySmall,
                            modifier = Modifier.padding(bottom = 12.dp)
                        )
                        WaveButton(
                            text = if (googleBusy) "Открываем Google…" else "Привязать Google",
                            onClick = { linkGoogleAccount() },
                            loading = googleBusy
                        )
                    }
                }

                Spacer(modifier = Modifier.padding(top = 20.dp))

                SectionCard(title = "Иконка приложения") {
                    Row(horizontalArrangement = androidx.compose.foundation.layout.Arrangement.spacedBy(16.dp)) {
                        IconChoice(
                            selected = iconVariant == AppIconVariant.DEFAULT,
                            label = AppIconVariant.DEFAULT.label,
                            onClick = {
                                iconVariant = AppIconVariant.DEFAULT
                                setAppIcon(context, AppIconVariant.DEFAULT)
                            }
                        ) {
                            Box(
                                modifier = Modifier
                                    .fillMaxSize()
                                    .background(Brush.linearGradient(listOf(WaveAccent, WaveAccent2, WaveAccentDeep))),
                                contentAlignment = Alignment.Center
                            ) {
                                Icon(Icons.Default.ChatBubble, contentDescription = null, tint = Color.White)
                            }
                        }
                        IconChoice(
                            selected = iconVariant == AppIconVariant.MONO,
                            label = AppIconVariant.MONO.label,
                            onClick = {
                                iconVariant = AppIconVariant.MONO
                                setAppIcon(context, AppIconVariant.MONO)
                            }
                        ) {
                            Box(
                                modifier = Modifier
                                    .fillMaxSize()
                                    .background(Color.Black),
                                contentAlignment = Alignment.Center
                            ) {
                                Icon(Icons.Default.ChatBubble, contentDescription = null, tint = Color.White)
                            }
                        }
                    }
                }

                Spacer(modifier = Modifier.padding(top = 20.dp))

                SectionCard(title = "Тема") {
                    Row(horizontalArrangement = androidx.compose.foundation.layout.Arrangement.spacedBy(16.dp)) {
                        IconChoice(
                            selected = currentWaveThemeVariant == WaveThemeVariant.COLORFUL,
                            label = "Цветная",
                            onClick = { setWaveTheme(context, WaveThemeVariant.COLORFUL) }
                        ) {
                            Box(
                                modifier = Modifier
                                    .fillMaxSize()
                                    .background(Brush.linearGradient(listOf(WaveAccent, WaveAccent2, WaveAccentDeep))),
                                contentAlignment = Alignment.Center
                            ) {
                                Icon(Icons.Default.ChatBubble, contentDescription = null, tint = WaveOnAccent)
                            }
                        }
                        IconChoice(
                            selected = currentWaveThemeVariant == WaveThemeVariant.MONO,
                            label = "Монохром",
                            onClick = { setWaveTheme(context, WaveThemeVariant.MONO) }
                        ) {
                            Box(
                                modifier = Modifier
                                    .fillMaxSize()
                                    .background(Color.Black),
                                contentAlignment = Alignment.Center
                            ) {
                                Icon(Icons.Default.ChatBubble, contentDescription = null, tint = Color.White)
                            }
                        }
                    }
                }

                Spacer(modifier = Modifier.padding(top = 20.dp))

                SectionCard(title = "Оформление") {
                    Row(
                        modifier = Modifier.fillMaxWidth(),
                        horizontalArrangement = androidx.compose.foundation.layout.Arrangement.SpaceBetween,
                        verticalAlignment = Alignment.CenterVertically
                    ) {
                        Text("Светлая тема", color = WaveText)
                        androidx.compose.material3.Switch(
                            checked = currentWaveAppearance == com.wave.app.ui.theme.WaveAppearance.LIGHT,
                            onCheckedChange = { checked ->
                                com.wave.app.ui.theme.setWaveAppearance(
                                    context,
                                    if (checked) com.wave.app.ui.theme.WaveAppearance.LIGHT else com.wave.app.ui.theme.WaveAppearance.DARK
                                )
                            },
                            colors = androidx.compose.material3.SwitchDefaults.colors(checkedTrackColor = WaveAccent)
                        )
                    }
                }

                Spacer(modifier = Modifier.padding(top = 24.dp))
                HorizontalDivider()
                Spacer(modifier = Modifier.padding(top = 8.dp))

                Row(
                    modifier = Modifier
                        .fillMaxWidth()
                        .clickable(onClick = onLogout)
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

                Spacer(modifier = Modifier.padding(top = 24.dp))
                Box(modifier = Modifier.fillMaxWidth(), contentAlignment = Alignment.Center) {
                    Text("Wave · версия 1.0", color = WaveMuted, style = MaterialTheme.typography.labelSmall)
                }
            }
        }
    }
}

@Composable
private fun SectionCard(title: String, content: @Composable androidx.compose.foundation.layout.ColumnScope.() -> Unit) {
    Column(
        modifier = Modifier
            .fillMaxWidth()
            .background(WavePanel, shape = RoundedCornerShape(18.dp))
            .padding(18.dp)
    ) {
        Text(title, style = MaterialTheme.typography.titleMedium, fontWeight = FontWeight.SemiBold)
        Spacer(modifier = Modifier.padding(top = 14.dp))
        content()
    }
}

@Composable
private fun IconChoice(
    selected: Boolean,
    label: String,
    onClick: () -> Unit,
    preview: @Composable () -> Unit
) {
    Column(horizontalAlignment = Alignment.CenterHorizontally) {
        Box(
            modifier = Modifier
                .size(64.dp)
                .clip(RoundedCornerShape(16.dp))
                .border(
                    width = if (selected) 3.dp else 0.dp,
                    color = if (selected) WaveAccent else Color.Transparent,
                    shape = RoundedCornerShape(16.dp)
                )
                .clickable(onClick = onClick)
        ) {
            preview()
        }
        Spacer(modifier = Modifier.padding(top = 6.dp))
        Text(label, color = if (selected) WaveAccent else WaveMuted, style = MaterialTheme.typography.labelSmall)
    }
}
