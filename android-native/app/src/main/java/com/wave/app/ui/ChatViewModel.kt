package com.wave.app.ui

import androidx.lifecycle.ViewModel
import androidx.lifecycle.ViewModelProvider
import androidx.lifecycle.viewModelScope
import com.wave.app.data.SessionStore
import com.wave.app.model.Message
import com.wave.app.network.ApiClient
import com.wave.app.network.SocketManager
import kotlinx.coroutines.Job
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.launch

class ChatViewModel(
    private val session: SessionStore,
    private val conversationId: String
) : ViewModel() {
    private val _messages = MutableStateFlow<List<Message>>(emptyList())
    val messages: StateFlow<List<Message>> = _messages

    private val _loading = MutableStateFlow(true)
    val loading: StateFlow<Boolean> = _loading

    private val _sending = MutableStateFlow(false)
    val sending: StateFlow<Boolean> = _sending

    private val _error = MutableStateFlow<String?>(null)
    val error: StateFlow<String?> = _error

    private val _otherReadAt = MutableStateFlow(0L)
    val otherReadAt: StateFlow<Long> = _otherReadAt

    private val _typingName = MutableStateFlow<String?>(null)
    val typingName: StateFlow<String?> = _typingName

    val myUserId: String? get() = session.user?.id

    private var typingStopJob: Job? = null
    private var typingIndicatorJob: Job? = null

    init {
        SocketManager.joinConversation(conversationId)
        SocketManager.markRead(conversationId)
        SocketManager.onNewMessage = { msg ->
            if (msg.conversationId == conversationId) {
                _messages.value = _messages.value + msg
                SocketManager.markRead(conversationId)
            }
        }
        SocketManager.onMessageUpdated = { id, content, editedAt ->
            _messages.value = _messages.value.map {
                if (it.id == id) it.copy(content = content, editedAt = editedAt) else it
            }
        }
        SocketManager.onMessageDeleted = { id ->
            _messages.value = _messages.value.map {
                if (it.id == id) it.copy(deleted = true, content = "", fileUrl = null) else it
            }
        }
        SocketManager.onMessageRead = { convId, userId, readAt ->
            if (convId == conversationId && userId != myUserId) {
                _otherReadAt.value = readAt
            }
        }
        SocketManager.onTyping = { convId, userId, name, typing ->
            if (convId == conversationId && userId != myUserId) {
                typingIndicatorJob?.cancel()
                if (typing) {
                    _typingName.value = name
                    typingIndicatorJob = viewModelScope.launch {
                        kotlinx.coroutines.delay(4000)
                        _typingName.value = null
                    }
                } else {
                    _typingName.value = null
                }
            }
        }
        load()
    }

    private fun load() {
        viewModelScope.launch {
            _loading.value = true
            try {
                val res = ApiClient.conversations.messages(conversationId)
                _messages.value = res.messages
                ApiClient.conversations.markRead(conversationId)
                _error.value = null
            } catch (e: Exception) {
                _error.value = friendlyError(e)
            } finally {
                _loading.value = false
            }
        }
    }

    fun sendText(text: String) {
        val trimmed = text.trim()
        if (trimmed.isEmpty()) return
        SocketManager.typingStop(conversationId)
        SocketManager.sendMessage(conversationId, trimmed) { _, error ->
            if (error != null) _error.value = error
        }
    }

    fun sendSticker(emoji: String) {
        SocketManager.sendMessage(conversationId, emoji) { _, error ->
            if (error != null) _error.value = error
        }
    }

    fun sendMedia(fileUrl: String, fileName: String, fileType: String, caption: String) {
        SocketManager.sendMessage(conversationId, caption.trim(), fileUrl, fileName, fileType) { _, error ->
            if (error != null) _error.value = error
        }
    }

    fun onTextChanged() {
        SocketManager.typingStart(conversationId)
        typingStopJob?.cancel()
        typingStopJob = viewModelScope.launch {
            kotlinx.coroutines.delay(1500)
            SocketManager.typingStop(conversationId)
        }
    }

    fun editMessage(messageId: String, content: String) {
        SocketManager.editMessage(messageId, content) { ok, error ->
            if (!ok && error != null) _error.value = error
        }
    }

    fun deleteMessage(messageId: String) {
        SocketManager.deleteMessage(messageId) { ok, error ->
            if (!ok && error != null) _error.value = error
        }
    }

    fun setUploading(value: Boolean) {
        _sending.value = value
    }

    override fun onCleared() {
        SocketManager.leaveConversation(conversationId)
        SocketManager.typingStop(conversationId)
        SocketManager.onNewMessage = null
        SocketManager.onMessageUpdated = null
        SocketManager.onMessageDeleted = null
        SocketManager.onMessageRead = null
        SocketManager.onTyping = null
    }
}

class ChatViewModelFactory(
    private val session: SessionStore,
    private val conversationId: String
) : ViewModelProvider.Factory {
    @Suppress("UNCHECKED_CAST")
    override fun <T : ViewModel> create(modelClass: Class<T>): T {
        return ChatViewModel(session, conversationId) as T
    }
}
