package com.wave.app.network

import android.util.Log
import com.google.gson.Gson
import com.wave.app.model.Conversation
import com.wave.app.model.Message
import io.socket.client.IO
import io.socket.client.Socket
import org.json.JSONObject

/**
 * Thin wrapper around socket.io-client mirroring the events the web
 * client uses (see server/src/index.js): message:send/new/updated/deleted,
 * conversation:join/leave/read, conversation:new, typing:start/stop.
 */
object SocketManager {
    private var socket: Socket? = null
    private val gson = Gson()

    var onNewMessage: ((Message) -> Unit)? = null
    var onMessageUpdated: ((id: String, content: String, editedAt: Long) -> Unit)? = null
    var onMessageDeleted: ((id: String) -> Unit)? = null
    var onConversationNew: ((Conversation) -> Unit)? = null
    var onMessageRead: ((conversationId: String, userId: String, readAt: Long) -> Unit)? = null
    var onPresenceUpdate: ((userId: String, online: Boolean, lastSeen: Long?) -> Unit)? = null
    var onTyping: ((conversationId: String, userId: String, name: String?, typing: Boolean) -> Unit)? = null

    fun connect(token: String) {
        if (socket?.connected() == true) return
        val opts = IO.Options.builder()
            .setAuth(mapOf("token" to token))
            .setReconnection(true)
            .setForceNew(true)
            .build()
        socket = IO.socket(java.net.URI.create(BASE_URL), opts).also { s ->
            s.on(Socket.EVENT_CONNECT_ERROR) { Log.w("SocketManager", "connect_error: ${it.joinToString()}") }
            s.on("message:new") { args ->
                runCatching {
                    val msg = gson.fromJson((args[0] as JSONObject).toString(), Message::class.java)
                    onNewMessage?.invoke(msg)
                }
            }
            s.on("message:updated") { args ->
                runCatching {
                    val obj = args[0] as JSONObject
                    onMessageUpdated?.invoke(obj.getString("id"), obj.optString("content"), obj.optLong("editedAt"))
                }
            }
            s.on("message:deleted") { args ->
                runCatching {
                    val obj = args[0] as JSONObject
                    onMessageDeleted?.invoke(obj.getString("id"))
                }
            }
            s.on("conversation:new") { args ->
                runCatching {
                    val conv = gson.fromJson((args[0] as JSONObject).toString(), Conversation::class.java)
                    onConversationNew?.invoke(conv)
                }
            }
            s.on("message:read") { args ->
                runCatching {
                    val obj = args[0] as JSONObject
                    onMessageRead?.invoke(obj.getString("conversationId"), obj.getString("userId"), obj.optLong("readAt"))
                }
            }
            s.on("presence:update") { args ->
                runCatching {
                    val obj = args[0] as JSONObject
                    val lastSeen = if (obj.isNull("lastSeen")) null else obj.optLong("lastSeen")
                    onPresenceUpdate?.invoke(obj.getString("userId"), obj.getBoolean("online"), lastSeen)
                }
            }
            s.on("typing:update") { args ->
                runCatching {
                    val obj = args[0] as JSONObject
                    onTyping?.invoke(
                        obj.getString("conversationId"),
                        obj.getString("userId"),
                        if (obj.isNull("name")) null else obj.optString("name"),
                        obj.getBoolean("typing")
                    )
                }
            }
            s.connect()
        }
    }

    fun disconnect() {
        socket?.disconnect()
        socket?.off()
        socket = null
    }

    fun joinConversation(conversationId: String) {
        socket?.emit("conversation:join", conversationId)
    }

    fun leaveConversation(conversationId: String) {
        socket?.emit("conversation:leave", conversationId)
    }

    fun markRead(conversationId: String) {
        val payload = JSONObject().put("conversationId", conversationId)
        socket?.emit("conversation:read", payload)
    }

    /** Tells the server to push a realtime conversation:new to the other members after a REST create. */
    fun notifyConversationCreated(conversationId: String, memberIds: List<String>) {
        val payload = JSONObject().apply {
            put("conversationId", conversationId)
            put("memberIds", org.json.JSONArray(memberIds))
        }
        socket?.emit("conversation:created", payload)
    }

    fun typingStart(conversationId: String) {
        socket?.emit("typing:start", JSONObject().put("conversationId", conversationId))
    }

    fun typingStop(conversationId: String) {
        socket?.emit("typing:stop", JSONObject().put("conversationId", conversationId))
    }

    fun editMessage(messageId: String, content: String, onResult: (Boolean, String?) -> Unit) {
        val payload = JSONObject().apply {
            put("messageId", messageId)
            put("content", content)
        }
        socket?.emit("message:edit", payload, io.socket.client.Ack { args ->
            runCatching {
                val res = args[0] as JSONObject
                if (res.has("error")) onResult(false, res.getString("error")) else onResult(true, null)
            }.onFailure { onResult(false, it.message) }
        })
    }

    fun deleteMessage(messageId: String, onResult: (Boolean, String?) -> Unit) {
        val payload = JSONObject().put("messageId", messageId)
        socket?.emit("message:delete", payload, io.socket.client.Ack { args ->
            runCatching {
                val res = args[0] as JSONObject
                if (res.has("error")) onResult(false, res.getString("error")) else onResult(true, null)
            }.onFailure { onResult(false, it.message) }
        })
    }

    fun sendMessage(
        conversationId: String,
        content: String,
        fileUrl: String? = null,
        fileName: String? = null,
        fileType: String? = null,
        onResult: (Message?, String?) -> Unit
    ) {
        val payload = JSONObject().apply {
            put("conversationId", conversationId)
            put("content", content)
            if (fileUrl != null) put("fileUrl", fileUrl)
            if (fileName != null) put("fileName", fileName)
            if (fileType != null) put("fileType", fileType)
        }
        socket?.emit("message:send", payload, io.socket.client.Ack { args ->
            runCatching {
                val res = args[0] as JSONObject
                if (res.has("error")) {
                    onResult(null, res.getString("error"))
                } else {
                    val msg = gson.fromJson(res.getJSONObject("message").toString(), Message::class.java)
                    onResult(msg, null)
                }
            }.onFailure { onResult(null, it.message) }
        })
    }
}
