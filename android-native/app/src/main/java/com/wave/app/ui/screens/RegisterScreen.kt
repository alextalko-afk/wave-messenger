package com.wave.app.ui.screens

import androidx.compose.foundation.background
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.runtime.Composable
import androidx.compose.runtime.collectAsState
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.input.KeyboardType
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.wave.app.ui.AuthViewModel
import com.wave.app.ui.components.WaveButton
import com.wave.app.ui.components.WaveTextField
import com.wave.app.ui.theme.WaveAccent
import com.wave.app.ui.theme.WaveBg
import com.wave.app.ui.theme.WaveMuted
import com.wave.app.ui.theme.WavePanel
import com.wave.app.ui.theme.WaveText

@Composable
fun RegisterScreen(viewModel: AuthViewModel, onRegistered: () -> Unit, onGoLogin: () -> Unit) {
    var displayName by remember { mutableStateOf("") }
    var username by remember { mutableStateOf("") }
    var password by remember { mutableStateOf("") }
    val busy by viewModel.busy.collectAsState()
    val error by viewModel.error.collectAsState()

    androidx.compose.material3.Surface(color = WaveBg, contentColor = WaveText, modifier = Modifier.fillMaxSize()) {
    Box(modifier = Modifier.fillMaxSize(), contentAlignment = Alignment.Center) {
        Column(
            modifier = Modifier.fillMaxWidth().padding(28.dp),
            horizontalAlignment = Alignment.CenterHorizontally
        ) {
            Text("Создать аккаунт", fontSize = 24.sp, fontWeight = FontWeight.SemiBold)
            Text("Это займёт пару секунд", color = WaveMuted, style = MaterialTheme.typography.bodyMedium)
            Spacer(modifier = Modifier.height(24.dp))

            Column(
                modifier = Modifier
                    .fillMaxWidth()
                    .background(WavePanel, shape = RoundedCornerShape(20.dp))
                    .padding(20.dp)
            ) {
                if (error != null) {
                    Text(
                        error ?: "",
                        color = Color(0xFFFF6B6B),
                        style = MaterialTheme.typography.bodySmall,
                        modifier = Modifier.padding(bottom = 10.dp)
                    )
                }

                WaveTextField(value = displayName, onValueChange = { displayName = it }, placeholder = "Как вас зовут")
                Spacer(modifier = Modifier.height(10.dp))
                WaveTextField(value = username, onValueChange = { username = it }, placeholder = "Логин")
                Spacer(modifier = Modifier.height(10.dp))
                WaveTextField(
                    value = password,
                    onValueChange = { password = it },
                    placeholder = "Пароль (минимум 4 символа)",
                    isPassword = true,
                    keyboardType = KeyboardType.Password
                )
                Spacer(modifier = Modifier.height(18.dp))
                WaveButton(
                    text = "Создать аккаунт",
                    onClick = { viewModel.register(username, password, displayName, onRegistered) },
                    enabled = username.length >= 3 && password.length >= 4,
                    loading = busy
                )
            }

            TextButton(onClick = onGoLogin, modifier = Modifier.padding(top = 14.dp)) {
                Text("Уже есть аккаунт? Войти", color = WaveAccent)
            }
        }
    }
    }
}
