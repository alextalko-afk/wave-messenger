package com.wave.app.ui.screens

import androidx.compose.foundation.background
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
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
import androidx.compose.ui.text.input.PasswordVisualTransformation
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.wave.app.ui.AuthViewModel
import com.wave.app.ui.theme.WaveBg

@Composable
fun RegisterScreen(viewModel: AuthViewModel, onRegistered: () -> Unit, onGoLogin: () -> Unit) {
    var displayName by remember { mutableStateOf("") }
    var username by remember { mutableStateOf("") }
    var password by remember { mutableStateOf("") }
    val busy by viewModel.busy.collectAsState()
    val error by viewModel.error.collectAsState()

    Box(modifier = Modifier.fillMaxSize().background(WaveBg), contentAlignment = Alignment.Center) {
        Column(
            modifier = Modifier.fillMaxWidth().padding(32.dp),
            horizontalAlignment = Alignment.CenterHorizontally
        ) {
            Text("Создать аккаунт", fontSize = 22.sp, fontWeight = FontWeight.SemiBold)
            Text("Это займёт пару секунд", style = MaterialTheme.typography.bodyMedium)
            Spacer(modifier = Modifier.padding(top = 20.dp))

            if (error != null) {
                Text(error ?: "", color = androidx.compose.ui.graphics.Color(0xFFFF6B6B), modifier = Modifier.padding(bottom = 8.dp))
            }

            OutlinedTextField(
                value = displayName,
                onValueChange = { displayName = it },
                label = { Text("Как вас зовут") },
                singleLine = true,
                modifier = Modifier.fillMaxWidth()
            )
            Spacer(modifier = Modifier.padding(top = 8.dp))
            OutlinedTextField(
                value = username,
                onValueChange = { username = it },
                label = { Text("Логин") },
                singleLine = true,
                modifier = Modifier.fillMaxWidth()
            )
            Spacer(modifier = Modifier.padding(top = 8.dp))
            OutlinedTextField(
                value = password,
                onValueChange = { password = it },
                label = { Text("Пароль (минимум 4 символа)") },
                singleLine = true,
                visualTransformation = PasswordVisualTransformation(),
                modifier = Modifier.fillMaxWidth()
            )

            Spacer(modifier = Modifier.padding(top = 20.dp))

            Button(
                onClick = { viewModel.register(username, password, displayName, onRegistered) },
                enabled = !busy && username.length >= 3 && password.length >= 4,
                modifier = Modifier.fillMaxWidth()
            ) {
                if (busy) CircularProgressIndicator(modifier = Modifier.size(18.dp)) else Text("Создать аккаунт")
            }

            TextButton(onClick = onGoLogin, modifier = Modifier.padding(top = 8.dp)) {
                Text("Уже есть аккаунт? Войти")
            }
        }
    }
}
