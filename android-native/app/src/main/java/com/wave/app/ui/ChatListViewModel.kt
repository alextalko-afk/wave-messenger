package com.wave.app.ui

import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.wave.app.data.SessionStore
import com.wave.app.model.Conversation
import com.wave.app.network.ApiClient
import com.wave.app.network.SocketManager
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.launch

class ChatListViewModel(private val session: SessionStore) : ViewModel() {
    private val _conversations = MutableStateFlow<List<Conversation>>(emptyList())
    val conversations: StateFlow<List<Conversation>> = _conversations

    private val _loading = MutableStateFlow(true)
    val loading: StateFlow<Boolean> = _loading

    private val _error = MutableStateFlow<String?>(null)
    val error: StateFlow<String?> = _error

    init {
        session.token?.let { SocketManager.connect(it) }
        SocketManager.onConversationNew = { conv ->
            upsert(conv)
        }
        SocketManager.onPresenceUpdate = { userId, online, lastSeen ->
            _conversations.value = _conversations.value.map { c ->
                if (c.otherUser?.id == userId) {
                    c.copy(otherUser = c.otherUser.copy(online = online, lastSeen = lastSeen ?: c.otherUser.lastSeen))
                } else c
            }
        }
        refresh()
    }

    fun refresh() {
        viewModelScope.launch {
            _loading.value = true
            try {
                val res = ApiClient.conversations.list()
                _conversations.value = res.conversations
                _error.value = null
            } catch (e: Exception) {
                _error.value = friendlyError(e)
            } finally {
                _loading.value = false
            }
        }
    }

    private fun upsert(conv: Conversation) {
        val current = _conversations.value.toMutableList()
        val idx = current.indexOfFirst { it.id == conv.id }
        if (idx >= 0) current[idx] = conv else current.add(0, conv)
        _conversations.value = current.sortedWith(
            compareByDescending<Conversation> { it.pinned }
                .thenByDescending { it.lastMessage?.createdAt ?: it.createdAt }
        )
    }

    fun markReadLocally(conversationId: String) {
        _conversations.value = _conversations.value.map {
            if (it.id == conversationId) it.copy(unreadCount = 0) else it
        }
    }
}
