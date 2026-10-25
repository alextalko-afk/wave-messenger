package com.wave.app.ui.screens

import android.content.Intent
import android.net.Uri
import androidx.compose.foundation.background
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.rememberCoroutineScope
import androidx.compose.runtime.setValue
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.platform.LocalClipboardManager
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.text.AnnotatedString
import androidx.compose.ui.text.font.FontFamily
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.input.KeyboardType
import androidx.compose.ui.unit.dp
import com.wave.app.data.SessionStore
import com.wave.app.network.ApiClient
import com.wave.app.network.SocketManager
import com.wave.app.network.TwoFactorCodeBody
import com.wave.app.network.TwoFactorSetupResponse
import com.wave.app.ui.components.WaveButton
import com.wave.app.ui.components.WaveTextField
import com.wave.app.ui.friendlyError
import com.wave.app.ui.theme.WaveAccent
import com.wave.app.ui.theme.WaveMuted
import com.wave.app.ui.theme.WavePanel
import com.wave.app.ui.theme.WaveText
import kotlinx.coroutines.launch

private val ErrorColor = Color(0xFFFF6B6B)

@Composable
private fun SecurityCard(title: String, content: @Composable androidx.compose.foundation.layout.ColumnScope.() -> Unit) {
    Column(
        modifier = Modifier
            .fillMaxWidth()
            .background(WavePanel, shape = RoundedCornerShape(18.dp))
            .padding(18.dp)
    ) {
        Text(title, style = MaterialTheme.typography.titleMedium, fontWeight = FontWeight.SemiBold)
        Spacer(modifier = Modifier.height(14.dp))
        content()
    }
}

private enum class TwoFactorMode { Idle, Scan, Codes, Disable, Regenerate }

/** Two-step verification: enable with an authenticator app, keep recovery codes, switch off. */
@Composable
fun TwoFactorCard(session: SessionStore) {
    val context = LocalContext.current
    val clipboard = LocalClipboardManager.current
    val scope = rememberCoroutineScope()

    var enabled by remember { mutableStateOf(session.user?.twoFactorEnabled ?: false) }
    var mode by remember { mutableStateOf(TwoFactorMode.Idle) }
    var setup by remember { mutableStateOf<TwoFactorSetupResponse?>(null) }
    var code by remember { mutableStateOf("") }
    var recoveryCodes by remember { mutableStateOf<List<String>>(emptyList()) }
    var remaining by remember { mutableStateOf<Int?>(null) }
    var busy by remember { mutableStateOf(false) }
    var error by remember { mutableStateOf<String?>(null) }
    var copied by remember { mutableStateOf(false) }

    LaunchedEffect(enabled, mode) {
        if (enabled && mode == TwoFactorMode.Idle) {
            remaining = runCatching { ApiClient.auth.twoFactorRemaining().remaining }.getOrNull()
        }
    }

    fun reset() {
        mode = TwoFactorMode.Idle
        setup = null
        code = ""
        error = null
        copied = false
    }

    fun run(block: suspend () -> Unit) {
        if (busy) return
        busy = true
        error = null
        scope.launch {
            try {
                block()
            } catch (e: Exception) {
                error = friendlyError(e)
            } finally {
                busy = false
            }
        }
    }

    SecurityCard(title = "Двухэтапная проверка") {
        Text(
            "При входе, кроме пароля или Google, потребуется код из приложения Google Authenticator.",
            color = WaveMuted,
            style = MaterialTheme.typography.bodySmall
        )
        Spacer(modifier = Modifier.height(12.dp))

        if (error != null) {
            Text(error ?: "", color = ErrorColor, style = MaterialTheme.typography.bodySmall, modifier = Modifier.padding(bottom = 8.dp))
        }

        when (mode) {
            TwoFactorMode.Idle -> if (!enabled) {
                WaveButton(
                    text = "Включить",
                    loading = busy,
                    onClick = {
                        run {
                            setup = ApiClient.auth.twoFactorSetup()
                            mode = TwoFactorMode.Scan
                        }
                    }
                )
            } else {
                Text("Включена", color = WaveAccent, fontWeight = FontWeight.SemiBold)
                if (remaining != null) {
                    Text(
                        "Осталось резервных кодов: $remaining",
                        color = if ((remaining ?: 0) <= 2) ErrorColor else WaveMuted,
                        style = MaterialTheme.typography.bodySmall,
                        modifier = Modifier.padding(top = 4.dp)
                    )
                }
                Spacer(modifier = Modifier.height(12.dp))
                WaveButton(text = "Новые резервные коды", onClick = { mode = TwoFactorMode.Regenerate })
                TextButton(onClick = { mode = TwoFactorMode.Disable }) {
                    Text("Отключить", color = ErrorColor)
                }
            }

            TwoFactorMode.Scan -> {
                val current = setup
                if (current != null) {
                    Text(
                        "1. Откройте приложение-аутентификатор.\n2. Добавьте ключ: нажмите кнопку ниже или введите его вручную.\n3. Введите 6-значный код.",
                        color = WaveMuted,
                        style = MaterialTheme.typography.bodySmall
                    )
                    Spacer(modifier = Modifier.height(12.dp))
                    Text(
                        current.secret.chunked(4).joinToString(" "),
                        fontFamily = FontFamily.Monospace,
                        color = WaveText,
                        style = MaterialTheme.typography.bodyLarge
                    )
                    Spacer(modifier = Modifier.height(12.dp))
                    WaveButton(
                        text = "Открыть в приложении",
                        onClick = {
                            val opened = runCatching {
                                context.startActivity(
                                    Intent(Intent.ACTION_VIEW, Uri.parse(current.otpauthUrl)).addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
                                )
                            }.isSuccess
                            if (!opened) error = "Не нашли приложение-аутентификатор. Введите ключ вручную."
                        }
                    )
                    TextButton(onClick = { clipboard.setText(AnnotatedString(current.secret)) }) {
                        Text("Скопировать ключ", color = WaveAccent)
                    }
                    Spacer(modifier = Modifier.height(8.dp))
                    WaveTextField(
                        value = code,
                        onValueChange = { code = it.filter { c -> c.isDigit() }.take(6) },
                        placeholder = "Код из приложения",
                        keyboardType = KeyboardType.Number
                    )
                    Spacer(modifier = Modifier.height(12.dp))
                    WaveButton(
                        text = "Включить защиту",
                        enabled = code.length == 6,
                        loading = busy,
                        onClick = {
                            run {
                                val res = ApiClient.auth.twoFactorEnable(TwoFactorCodeBody(code))
                                session.user = res.user
                                enabled = true
                                recoveryCodes = res.recoveryCodes
                                setup = null
                                code = ""
                                mode = TwoFactorMode.Codes
                            }
                        }
                    )
                    TextButton(onClick = { reset() }) { Text("Отмена", color = WaveMuted) }
                }
            }

            TwoFactorMode.Codes -> {
                Text(
                    "Сохраните эти коды в надёжном месте. Каждый подходит один раз, если не будет доступа к приложению. Больше они показаны не будут.",
                    color = WaveMuted,
                    style = MaterialTheme.typography.bodySmall
                )
                Spacer(modifier = Modifier.height(10.dp))
                Column(
                    modifier = Modifier
                        .fillMaxWidth()
                        .background(com.wave.app.ui.theme.WaveBg, shape = RoundedCornerShape(12.dp))
                        .padding(14.dp)
                ) {
                    recoveryCodes.forEach { item ->
                        Text(item, fontFamily = FontFamily.Monospace, color = WaveText, style = MaterialTheme.typography.bodyLarge)
                    }
                }
                Spacer(modifier = Modifier.height(12.dp))
                Row {
                    TextButton(onClick = {
                        clipboard.setText(AnnotatedString(recoveryCodes.joinToString("\n")))
                        copied = true
                    }) { Text(if (copied) "Скопировано" else "Скопировать", color = WaveAccent) }
                }
                WaveButton(text = "Я сохранил коды", onClick = { reset() })
            }

            TwoFactorMode.Disable, TwoFactorMode.Regenerate -> {
                val disabling = mode == TwoFactorMode.Disable
                Text(
                    "Введите код из приложения или резервный код.",
                    color = WaveMuted,
                    style = MaterialTheme.typography.bodySmall
                )
                Spacer(modifier = Modifier.height(10.dp))
                WaveTextField(value = code, onValueChange = { code = it }, placeholder = "Код")
                Spacer(modifier = Modifier.height(12.dp))
                WaveButton(
                    text = if (disabling) "Отключить защиту" else "Создать новые коды",
                    enabled = code.isNotBlank(),
                    loading = busy,
                    onClick = {
                        run {
                            if (disabling) {
                                val res = ApiClient.auth.twoFactorDisable(TwoFactorCodeBody(code.trim()))
                                session.user = res.user
                                enabled = false
                                reset()
                            } else {
                                val res = ApiClient.auth.twoFactorRecoveryCodes(TwoFactorCodeBody(code.trim()))
                                recoveryCodes = res.recoveryCodes
                                code = ""
                                mode = TwoFactorMode.Codes
                            }
                        }
                    }
                )
                TextButton(onClick = { reset() }) { Text("Отмена", color = WaveMuted) }
            }
        }
    }
}

/** Signs every other device out; this one gets a fresh token and stays signed in. */
@Composable
fun DevicesCard(session: SessionStore) {
    val scope = rememberCoroutineScope()
    var busy by remember { mutableStateOf(false) }
    var message by remember { mutableStateOf<String?>(null) }

    SecurityCard(title = "Устройства") {
        Text(
            "Завершит сеанс везде, кроме этого устройства. Например, если вы потеряли другой телефон.",
            color = WaveMuted,
            style = MaterialTheme.typography.bodySmall
        )
        Spacer(modifier = Modifier.height(12.dp))
        if (message != null) {
            Text(message ?: "", color = WaveMuted, style = MaterialTheme.typography.bodySmall, modifier = Modifier.padding(bottom = 8.dp))
        }
        WaveButton(
            text = "Выйти на других устройствах",
            loading = busy,
            onClick = {
                if (busy) return@WaveButton
                busy = true
                message = null
                scope.launch {
                    try {
                        val res = ApiClient.auth.revokeSessions()
                        session.token = res.token
                        SocketManager.connect(res.token)
                        message = "Вы вышли на всех остальных устройствах"
                    } catch (e: Exception) {
                        message = friendlyError(e)
                    } finally {
                        busy = false
                    }
                }
            }
        )
    }
}
