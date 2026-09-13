package com.wave.app.ui.screens

import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
import androidx.compose.foundation.border
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.runtime.Composable
import androidx.compose.runtime.collectAsState
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.rememberCoroutineScope
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.draw.shadow
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import com.wave.app.data.GoogleSignInResult
import com.wave.app.data.requestGoogleIdToken
import com.wave.app.ui.AuthViewModel
import com.wave.app.ui.theme.WaveAccent
import com.wave.app.ui.theme.WaveBg
import com.wave.app.ui.theme.WaveMuted
import com.wave.app.ui.theme.WavePanel
import com.wave.app.ui.theme.WaveText
import kotlinx.coroutines.launch

@Composable
fun RegisterScreen(viewModel: AuthViewModel, onRegistered: () -> Unit, onGoLogin: () -> Unit) {
    val busy by viewModel.busy.collectAsState()
    val error by viewModel.error.collectAsState()
    val context = LocalContext.current
    val scope = rememberCoroutineScope()
    var googleBusy by remember { mutableStateOf(false) }

    fun signInWithGoogle() {
        if (googleBusy || busy) return
        googleBusy = true
        scope.launch {
            val result = requestGoogleIdToken(context, filterByAuthorizedAccounts = false)
            when (result) {
                is GoogleSignInResult.Success -> viewModel.loginWithGoogle(result.idToken, onRegistered)
                is GoogleSignInResult.Failure -> viewModel.setErrorMessage(result.message)
                GoogleSignInResult.Cancelled -> {}
            }
            googleBusy = false
        }
    }

    androidx.compose.material3.Surface(color = WaveBg, contentColor = WaveText, modifier = Modifier.fillMaxSize()) {
    Box(modifier = Modifier.fillMaxSize(), contentAlignment = Alignment.Center) {
        Column(
            modifier = Modifier.fillMaxWidth().padding(28.dp),
            horizontalAlignment = Alignment.CenterHorizontally
        ) {
            Text("Создать аккаунт", style = MaterialTheme.typography.displaySmall)
            Spacer(modifier = Modifier.height(2.dp))
            Text("Новые аккаунты создаются через Google", color = WaveMuted, style = MaterialTheme.typography.bodyMedium)
            Spacer(modifier = Modifier.height(28.dp))

            Column(
                modifier = Modifier
                    .fillMaxWidth()
                    .shadow(elevation = 12.dp, shape = RoundedCornerShape(22.dp), ambientColor = Color.Black.copy(alpha = 0.5f), spotColor = Color.Black.copy(alpha = 0.6f))
                    .background(WavePanel, shape = RoundedCornerShape(22.dp))
                    .padding(22.dp)
            ) {
                if (error != null) {
                    Text(
                        error ?: "",
                        color = Color(0xFFFF6B6B),
                        style = MaterialTheme.typography.bodySmall,
                        modifier = Modifier.padding(bottom = 10.dp)
                    )
                }

                Row(
                    modifier = Modifier
                        .fillMaxWidth()
                        .clip(RoundedCornerShape(50))
                        .border(1.dp, WaveMuted.copy(alpha = 0.35f), RoundedCornerShape(50))
                        .background(WaveBg)
                        .clickable(enabled = !googleBusy && !busy) { signInWithGoogle() }
                        .padding(vertical = 14.dp),
                    horizontalArrangement = androidx.compose.foundation.layout.Arrangement.Center,
                    verticalAlignment = Alignment.CenterVertically
                ) {
                    if (googleBusy) {
                        CircularProgressIndicator(modifier = Modifier.size(18.dp), color = WaveText, strokeWidth = 2.dp)
                    } else {
                        Text("Продолжить с Google", color = WaveText, style = MaterialTheme.typography.bodyLarge, fontWeight = FontWeight.Medium)
                    }
                }
            }

            TextButton(onClick = onGoLogin, modifier = Modifier.padding(top = 14.dp)) {
                Text("Уже есть аккаунт? Войти", color = WaveAccent)
            }
        }
    }
    }
}
