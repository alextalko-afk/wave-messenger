package com.wave.app.ui

import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.wave.app.data.SessionStore
import com.wave.app.network.ApiClient
import com.wave.app.network.GoogleAuthBody
import com.wave.app.network.LinkGoogleBody
import com.wave.app.network.LoginBody
import com.wave.app.network.TwoFactorVerifyBody
import com.wave.app.network.SocketManager
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.launch

class AuthViewModel(private val session: SessionStore) : ViewModel() {
    private val _busy = MutableStateFlow(false)
    val busy: StateFlow<Boolean> = _busy

    private val _error = MutableStateFlow<String?>(null)
    val error: StateFlow<String?> = _error

    // Set while the account has two-step verification and still needs a code.
    private val _challenge = MutableStateFlow<String?>(null)
    val challenge: StateFlow<String?> = _challenge

    private fun startSession(token: String, user: com.wave.app.model.User, onSuccess: () -> Unit) {
        session.token = token
        session.user = user
        SocketManager.connect(token)
        onSuccess()
    }

    fun login(username: String, password: String, onSuccess: () -> Unit) {
        _error.value = null
        _busy.value = true
        viewModelScope.launch {
            try {
                val res = ApiClient.auth.login(LoginBody(username.trim(), password))
                val token = res.token
                val user = res.user
                if (res.twoFactorRequired && res.challengeToken != null) {
                    _challenge.value = res.challengeToken
                } else if (token != null && user != null) {
                    startSession(token, user, onSuccess)
                } else {
                    _error.value = "Не удалось войти"
                }
            } catch (e: Exception) {
                _error.value = friendlyError(e)
            } finally {
                _busy.value = false
            }
        }
    }

    fun setErrorMessage(message: String) {
        _error.value = message
    }

    fun loginWithGoogle(idToken: String, onSuccess: () -> Unit) {
        _error.value = null
        _busy.value = true
        viewModelScope.launch {
            try {
                val res = ApiClient.auth.googleAuth(GoogleAuthBody(idToken))
                val token = res.token
                val user = res.user
                if (res.twoFactorRequired && res.challengeToken != null) {
                    _challenge.value = res.challengeToken
                } else if (token != null && user != null) {
                    startSession(token, user, onSuccess)
                } else {
                    _error.value = "Не удалось войти"
                }
            } catch (e: Exception) {
                _error.value = friendlyError(e)
            } finally {
                _busy.value = false
            }
        }
    }

    fun verifyTwoFactor(code: String, onSuccess: () -> Unit) {
        val challengeToken = _challenge.value ?: return
        _error.value = null
        _busy.value = true
        viewModelScope.launch {
            try {
                val res = ApiClient.auth.twoFactorVerify(TwoFactorVerifyBody(challengeToken, code.trim()))
                _challenge.value = null
                startSession(res.token, res.user, onSuccess)
            } catch (e: Exception) {
                _error.value = friendlyError(e)
            } finally {
                _busy.value = false
            }
        }
    }

    fun cancelTwoFactor() {
        _challenge.value = null
        _error.value = null
    }

    fun linkGoogle(idToken: String, onResult: (String?) -> Unit) {
        viewModelScope.launch {
            try {
                val res = ApiClient.auth.linkGoogle(LinkGoogleBody(idToken))
                session.user = res.user
                onResult(null)
            } catch (e: Exception) {
                onResult(friendlyError(e))
            }
        }
    }

    fun logout() {
        SocketManager.disconnect()
        session.clear()
    }
}

fun friendlyError(e: Exception): String {
    if (e is retrofit2.HttpException) {
        val body = e.response()?.errorBody()?.string()
        val serverMessage = runCatching {
            com.google.gson.JsonParser.parseString(body).asJsonObject.get("error")?.asString
        }.getOrNull()
        if (!serverMessage.isNullOrBlank()) return serverMessage
    }
    val message = e.message ?: return "Ошибка сети. Проверьте подключение."
    return when {
        message.contains("timeout", true) -> "Сервер не отвечает. Попробуйте ещё раз."
        else -> "Ошибка сети. Проверьте подключение."
    }
}
