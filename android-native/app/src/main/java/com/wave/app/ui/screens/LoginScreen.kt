package com.wave.app.ui.screens

import androidx.compose.foundation.background
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.text.KeyboardOptions
import androidx.compose.material3.Button
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.OutlinedTextField
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
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.input.KeyboardType
import androidx.compose.ui.text.input.PasswordVisualTransformation
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.wave.app.ui.AuthViewModel
import com.wave.app.ui.theme.WaveAccent
import com.wave.app.ui.theme.WaveAccent2
import com.wave.app.ui.theme.WaveBg
import androidx.compose.ui.graphics.Brush

@Composable
fun LoginScreen(viewModel: AuthViewModel, onLoggedIn: () -> Unit, onGoRegister: () -> Unit) {
    var username by remember { mutableStateOf("") }
    var password by remember { mutableStateOf("") }
    val busy by viewModel.busy.collectAsState()
    val error by viewModel.error.collectAsState()

    Box(modifier = Modifier.fillMaxSize().background(WaveBg), contentAlignment = Alignment.Center) {
        Column(
            modifier = Modifier.fillMaxWidth().padding(32.dp),
            horizontalAlignment = Alignment.CenterHorizontally
        ) {
            Box(
                modifier = Modifier
                    .size(76.dp)
                    .background(
                        Brush.linearGradient(listOf(WaveAccent, WaveAccent2)),
                        shape = CircleShape
                    ),
                contentAlignment = Alignment.Center
            ) {
                Text("W", color = androidx.compose.ui.graphics.Color.White, fontSize = 32.sp, fontWeight = FontWeight.Bold)
            }

            androidx.compose.foundation.layout.Spacer(modifier = Modifier.padding(top = 12.dp))
            Text("Wave", fontSize = 24.sp, fontWeight = FontWeight.SemiBold)
            Text("Быстрый и удобный мессенджер", style = MaterialTheme.typography.bodyMedium)

            androidx.compose.foundation.layout.Spacer(modifier = Modifier.padding(top = 24.dp))

            if (error != null) {
                Text(error ?: "", color = androidx.compose.ui.graphics.Color(0xFFFF6B6B), modifier = Modifier.padding(bottom = 8.dp))
            }

            OutlinedTextField(
                value = username,
                onValueChange = { username = it },
                label = { Text("Логин") },
                singleLine = true,
                keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.Text),
                modifier = Modifier.fillMaxWidth()
            )
            androidx.compose.foundation.layout.Spacer(modifier = Modifier.padding(top = 8.dp))
            OutlinedTextField(
                value = password,
                onValueChange = { password = it },
                label = { Text("Пароль") },
                singleLine = true,
                visualTransformation = PasswordVisualTransformation(),
                keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.Password),
                modifier = Modifier.fillMaxWidth()
            )

            androidx.compose.foundation.layout.Spacer(modifier = Modifier.padding(top = 20.dp))

            Button(
                onClick = { viewModel.login(username, password, onLoggedIn) },
                enabled = !busy && username.isNotBlank() && password.isNotBlank(),
                modifier = Modifier.fillMaxWidth()
            ) {
                if (busy) CircularProgressIndicator(modifier = Modifier.size(18.dp)) else Text("Войти")
            }

            TextButton(onClick = onGoRegister, modifier = Modifier.padding(top = 8.dp)) {
                Text("Нет аккаунта? Зарегистрироваться")
            }
        }
    }
}
