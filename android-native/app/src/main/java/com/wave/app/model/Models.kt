package com.wave.app.model

data class User(
    val id: String,
    val username: String,
    val displayName: String,
    val avatarColor: String?,
    val bio: String? = null,
    val online: Boolean = false,
    val lastSeen: Long? = null
)

data class AuthResponse(
    val token: String,
    val user: User
)

data class LastMessage(
    val id: String,
    val content: String,
    val senderId: String,
    val senderName: String?,
    val fileType: String?,
    val createdAt: Long
)

data class Conversation(
    val id: String,
    val isGroup: Boolean,
    val name: String,
    val avatarColor: String?,
    val members: List<User> = emptyList(),
    val otherUser: User?,
    val lastMessage: LastMessage?,
    val unreadCount: Int = 0,
    val pinned: Boolean = false,
    val muted: Boolean = false,
    val createdAt: Long = 0
)

data class Message(
    val id: String,
    val conversationId: String,
    val senderId: String,
    val senderName: String?,
    val senderColor: String?,
    val content: String,
    val fileUrl: String?,
    val fileName: String?,
    val fileType: String?,
    val replyToId: String?,
    val editedAt: Long?,
    val deleted: Boolean = false,
    val createdAt: Long
)

data class UploadResponse(
    val url: String,
    val name: String,
    val type: String
)
