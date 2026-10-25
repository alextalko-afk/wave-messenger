package com.wave.app.ui.screens

import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Surface
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.runtime.Composable
import androidx.compose.runtime.collectAsState
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.input.KeyboardType
import androidx.compose.ui.unit.dp
import com.wave.app.ui.AuthViewModel
import com.wave.app.ui.components.WaveButton
import com.wave.app.ui.components.WaveTextField
import com.wave.app.ui.theme.WaveAccent
import com.wave.app.ui.theme.WaveBg
import com.wave.app.ui.theme.WaveMuted
import com.wave.app.ui.theme.WaveText

/** Shows the code step instead of [content] while a sign-in is waiting for its second step. */
@Composable
fun TwoFactorGate(viewModel: AuthViewModel, onLoggedIn: () -> Unit, content: @Composable () -> Unit) {
    val challenge by viewModel.challenge.collectAsState()
    if (challenge != null) {
        TwoFactorScreen(viewModel = viewModel, onLoggedIn = onLoggedIn)
    } else {
        content()
    }
}

@Composable
fun TwoFactorScreen(viewModel: AuthViewModel, onLoggedIn: () -> Unit) {
    var useRecovery by remember { mutableStateOf(false) }
    var code by remember { mutableStateOf("") }
    val busy by viewModel.busy.collectAsState()
    val error by viewModel.error.collectAsState()

    Surface(color = WaveBg, contentColor = WaveText, modifier = Modifier.fillMaxSize()) {
        Column(
            modifier = Modifier.fillMaxSize().padding(28.dp),
            verticalArrangement = Arrangement.Center
        ) {
            Text("Подтвердите вход", style = MaterialTheme.typography.headlineSmall, fontWeight = FontWeight.Bold)
            Spacer(modifier = Modifier.height(8.dp))
            Text(
                if (useRecovery) {
                    "Введите один из резервных кодов, которые вы сохранили при включении защиты"
                } else {
                    "Введите 6-значный код из приложения Google Authenticator"
                },
                color = WaveMuted,
                style = MaterialTheme.typography.bodyMedium
            )
            Spacer(modifier = Modifier.height(24.dp))

            if (error != null) {
                Text(
                    error ?: "",
                    color = Color(0xFFFF6B6B),
                    style = MaterialTheme.typography.bodySmall,
                    modifier = Modifier.padding(bottom = 10.dp)
                )
            }

            WaveTextField(
                value = code,
                onValueChange = { code = if (useRecovery) it else it.filter { c -> c.isDigit() }.take(6) },
                placeholder = if (useRecovery) "xxxxx-xxxxx" else "000000",
                keyboardType = if (useRecovery) KeyboardType.Ascii else KeyboardType.Number
            )
            Spacer(modifier = Modifier.height(20.dp))
            WaveButton(
                text = "Подтвердить",
                onClick = { viewModel.verifyTwoFactor(code, onLoggedIn) },
                enabled = code.isNotBlank(),
                loading = busy
            )

            TextButton(
                onClick = {
                    useRecovery = !useRecovery
                    code = ""
                },
                modifier = Modifier.padding(top = 12.dp)
            ) {
                Text(
                    if (useRecovery) "Использовать код из приложения" else "Использовать резервный код",
                    color = WaveAccent
                )
            }
            TextButton(onClick = { viewModel.cancelTwoFactor() }) {
                Text("Назад", color = WaveAccent)
            }
        }
    }
}
