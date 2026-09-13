package com.wave.app.ui

import com.wave.app.model.Conversation

/** Small in-memory handoff so ChatScreen doesn't need to serialize a full Conversation through nav args. */
object SelectedConversation {
    var current: Conversation? = null
}
