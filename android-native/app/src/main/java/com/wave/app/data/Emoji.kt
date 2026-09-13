package com.wave.app.data

val EMOJI_LIST = listOf(
    "😀", "😁", "😂", "🤣", "😊", "😇", "🙂", "😉", "😍", "😘",
    "😜", "🤪", "😎", "🤩", "🥳", "😢", "😭", "😡", "🤯", "🥺",
    "😴", "🤔", "🙄", "😬", "🤗", "🤫", "🤭", "🥰", "😏", "😌",
    "👍", "👎", "👏", "🙏", "💪", "🤝", "👋", "✌️", "🤞", "🔥",
    "❤️", "🧡", "💛", "💚", "💙", "💜", "🖤", "💔", "💯", "✨"
)

val STICKER_LIST = listOf(
    "😀", "😂", "🥰", "😎", "🥳", "😭", "😡", "🤯", "🥺", "😴",
    "👍", "👏", "🙏", "🔥", "❤️", "🎉", "🎂", "🍕", "☕", "🐱",
    "🐶", "🌸", "⭐", "🌈", "☀️", "🌙", "⚡", "💧", "🎈", "🎁",
    "🚀", "⚽"
)

/**
 * Mirrors client/src/lib/emoji.js's isStickerContent: a message with no
 * text besides 1-3 emoji is rendered large, like a sticker.
 */
fun isStickerContent(text: String): Boolean {
    val trimmed = text.trim()
    if (trimmed.isEmpty()) return false
    val codePoints = trimmed.codePoints().toArray()
    if (codePoints.isEmpty() || codePoints.size > 6) return false
    // Reject anything containing ordinary letters/digits - a sticker is emoji-only.
    for (cp in codePoints) {
        if (Character.isLetterOrDigit(cp)) return false
    }
    val visibleCount = codePoints.count { it != 0xFE0F && it != 0x200D }
    return visibleCount in 1..3
}
