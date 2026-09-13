package com.wave.app.ui.screens

import androidx.compose.foundation.background
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.shape.CircleShape
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
import androidx.compose.ui.draw.blur
import androidx.compose.ui.draw.shadow
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
fun LoginScreen(viewModel: AuthViewModel, onLoggedIn: () -> Unit, onGoRegister: () -> Unit) {
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
            Box(contentAlignment = Alignment.Center) {
                Box(
                    modifier = Modifier
                        .size(64.dp)
                        .blur(36.dp, edgeTreatment = androidx.compose.ui.draw.BlurredEdgeTreatment.Unbounded)
                        .background(WaveAccent.copy(alpha = 0.18f), shape = CircleShape)
                )
                Box(
                    modifier = Modifier
                        .size(84.dp)
                        .shadow(elevation = 16.dp, shape = CircleShape, ambientColor = Color.Black, spotColor = Color.Black)
                        .background(WaveAccent, shape = CircleShape),
                    contentAlignment = Alignment.Center
                ) {
                    Text("W", color = Color.Black, fontSize = 36.sp, fontWeight = FontWeight.ExtraBold)
                }
            }

            Spacer(modifier = Modifier.height(18.dp))
            Text("Wave", style = MaterialTheme.typography.displaySmall)
            Spacer(modifier = Modifier.height(2.dp))
            Text("Быстрый и удобный мессенджер", color = WaveMuted, style = MaterialTheme.typography.bodyMedium)

            Spacer(modifier = Modifier.height(32.dp))

            Column(
                modifier = Modifier
                    .fillMaxWidth()
                    .shadow(elevation = 12.dp, shape = RoundedCornerShape(22.dp), ambientColor = Color.Black.copy(alpha = 0.5f), spotColor = Color.Black.copy(alpha = 0.6f))
                    .background(WavePanel, shape = RoundedCornerShape(22.dp))
                    .padding(22.dp)
            ) {
                Text("Вход в аккаунт", style = MaterialTheme.typography.titleLarge)
                Spacer(modifier = Modifier.height(18.dp))

                if (error != null) {
                    Text(
                        error ?: "",
                        color = Color(0xFFFF6B6B),
                        style = MaterialTheme.typography.bodySmall,
                        modifier = Modifier.padding(bottom = 10.dp)
                    )
                }

                WaveTextField(value = username, onValueChange = { username = it }, placeholder = "Логин")
                Spacer(modifier = Modifier.height(10.dp))
                WaveTextField(
                    value = password,
                    onValueChange = { password = it },
                    placeholder = "Пароль",
                    isPassword = true,
                    keyboardType = KeyboardType.Password
                )
                Spacer(modifier = Modifier.height(20.dp))
                WaveButton(
                    text = "Войти",
                    onClick = { viewModel.login(username, password, onLoggedIn) },
                    enabled = username.isNotBlank() && password.isNotBlank(),
                    loading = busy
                )
            }

            TextButton(onClick = onGoRegister, modifier = Modifier.padding(top = 16.dp)) {
                Text("Нет аккаунта? Зарегистрироваться", color = WaveAccent, style = MaterialTheme.typography.bodyMedium)
            }
        }
    }
    }
}
