package com.wave.app.ui

import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.wave.app.data.SessionStore
import com.wave.app.network.ApiClient
import com.wave.app.network.GoogleAuthBody
import com.wave.app.network.LinkGoogleBody
import com.wave.app.network.LoginBody
import com.wave.app.network.SocketManager
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.launch

class AuthViewModel(private val session: SessionStore) : ViewModel() {
    private val _busy = MutableStateFlow(false)
    val busy: StateFlow<Boolean> = _busy

    private val _error = MutableStateFlow<String?>(null)
    val error: StateFlow<String?> = _error

    fun login(username: String, password: String, onSuccess: () -> Unit) {
        _error.value = null
        _busy.value = true
        viewModelScope.launch {
            try {
                val res = ApiClient.auth.login(LoginBody(username.trim(), password))
                session.token = res.token
                session.user = res.user
                SocketManager.connect(res.token)
                onSuccess()
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
                session.token = res.token
                session.user = res.user
                SocketManager.connect(res.token)
                onSuccess()
            } catch (e: Exception) {
                _error.value = friendlyError(e)
            } finally {
                _busy.value = false
            }
        }
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
