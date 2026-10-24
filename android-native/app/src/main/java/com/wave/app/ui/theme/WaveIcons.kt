package com.wave.app.ui.theme

import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.PathFillType
import androidx.compose.ui.graphics.SolidColor
import androidx.compose.ui.graphics.StrokeCap
import androidx.compose.ui.graphics.StrokeJoin
import androidx.compose.ui.graphics.vector.ImageVector
import androidx.compose.ui.graphics.vector.addPathNodes
import androidx.compose.ui.unit.dp

// Wave's own icon set (solid glyphs, rounded strokes for simple marks). Names
// follow the Material icon names the screens used before, so a call site only
// swaps `Icons.Default.` for `WaveIcons.`; every vector is drawn black and
// recoloured by the Icon's tint.
object WaveIcons {
    private fun vec(name: String, block: ImageVector.Builder.() -> Unit): ImageVector =
        ImageVector.Builder(name = name, defaultWidth = 24.dp, defaultHeight = 24.dp, viewportWidth = 24f, viewportHeight = 24f)
            .apply(block)
            .build()

    private fun ImageVector.Builder.fill(d: String, alpha: Float = 1f, evenOdd: Boolean = false): ImageVector.Builder =
        addPath(
            pathData = addPathNodes(d),
            pathFillType = if (evenOdd) PathFillType.EvenOdd else PathFillType.NonZero,
            fill = SolidColor(Color.Black),
            fillAlpha = alpha
        )

    private fun ImageVector.Builder.line(d: String, width: Float = 2.4f, alpha: Float = 1f): ImageVector.Builder =
        addPath(
            pathData = addPathNodes(d),
            stroke = SolidColor(Color.Black),
            strokeAlpha = alpha,
            strokeLineWidth = width,
            strokeLineCap = StrokeCap.Round,
            strokeLineJoin = StrokeJoin.Round
        )

    private fun circle(cx: Float, cy: Float, r: Float) = "M${cx - r},$cy a$r,$r 0 1,0 ${2 * r},0 a$r,$r 0 1,0 ${-2 * r},0z"

    private fun rrect(x: Float, y: Float, w: Float, h: Float, r: Float) =
        "M${x + r},$y h${w - 2 * r} a$r,$r 0 0 1 $r,$r v${h - 2 * r} a$r,$r 0 0 1 ${-r},$r " +
            "h${-(w - 2 * r)} a$r,$r 0 0 1 ${-r},${-r} v${-(h - 2 * r)} a$r,$r 0 0 1 $r,${-r}z"

    private const val HANDSET =
        "M6.2 2.8c.6-.5 1.5-.4 2 .2l2 2.5c.4.5.4 1.2 0 1.7l-1.2 1.4c-.2.2-.2.5 0 .8 1 1.9 2.7 3.6 4.7 4.7.3.1.6.1.8-.1" +
            "l1.4-1.2c.5-.4 1.2-.4 1.7 0l2.5 2c.6.5.7 1.4.2 2l-1.4 1.8c-.9 1.1-2.4 1.6-3.8 1.2C10.3 18.5 5.5 13.7 3.5 7.4" +
            "c-.4-1.4.1-2.9 1.2-3.8z"

    private const val BUBBLE =
        "M12 2.8c-5.2 0-9.2 3.6-9.2 8.3 0 2.4 1 4.5 2.8 6-.2 1.5-.8 2.7-1.8 3.7a.6.6 0 00.5 1c2.1-.1 3.9-.8 5.3-1.9" +
            ".8.2 1.6.3 2.4.3 5.2 0 9.2-3.6 9.2-8.3S17.2 2.8 12 2.8z"

    private const val BELL =
        "M12 2.5a1.5 1.5 0 011.5 1.5v.6A6.5 6.5 0 0118.5 11v4.2l1.6 2.1c.5.6 0 1.7-.8 1.7H4.7c-.8 0-1.3-1.1-.8-1.7" +
            "l1.6-2.1V11a6.5 6.5 0 015-6.4V4A1.5 1.5 0 0112 2.5z"

    private const val BELL_CLAPPER = "M9.7 20.3h4.6a2.3 2.3 0 01-4.6 0z"
    private const val VIDEO_LENS = "M17.5 10.6l3.3-2.2c.6-.4 1.2 0 1.2.7v6.1c0 .7-.6 1.1-1.2.7l-3.3-2.2z"
    private const val SLASH = "M4 4l16 16"

    private const val FILE =
        "M7 2.5h6l6 6V19a2.5 2.5 0 01-2.5 2.5h-9.5A2.5 2.5 0 015 19V5A2.5 2.5 0 017 2.5zM13 4.4V8a1 1 0 001 1h3.6z"

    val ArrowBack: ImageVector = vec("ArrowBack") { line("M15 5l-7 7 7 7", 2.6f) }
    val ArrowUpward: ImageVector = vec("ArrowUpward") { line("M12 19V5M6 11l6-6 6 6", 2.6f) }
    val ArrowDownward: ImageVector = vec("ArrowDownward") { line("M12 5v14M6 13l6 6 6-6", 2.6f) }
    val Check: ImageVector = vec("Check") { line("M5 12.5l4.5 4.5L19 7.5", 2.8f) }
    val Close: ImageVector = vec("Close") { line("M6 6l12 12M18 6L6 18", 2.6f) }
    val Add: ImageVector = vec("Add") { line("M12 5v14M5 12h14", 2.6f) }
    val DoneAll: ImageVector = vec("DoneAll") { line("M2.5 12.5l4 4 8-9M11 15.5l1.5 1.5 8.5-9.5") }

    val Search: ImageVector = vec("Search") {
        line(circle(10.5f, 10.5f, 6.2f), 2.8f)
        line("M15.4 15.4L20 20", 3f)
    }

    val AttachFile: ImageVector = vec("AttachFile") {
        line("M20 11.5l-8 8a5 5 0 01-7-7l8.5-8.5a3.3 3.3 0 014.7 4.7L9.5 17.3a1.7 1.7 0 01-2.4-2.4L15 7")
    }

    val ChatBubble: ImageVector = vec("ChatBubble") {
        fill(
            BUBBLE + "M8 10a1.25 1.25 0 110 2.5A1.25 1.25 0 018 10zm4 0a1.25 1.25 0 110 2.5A1.25 1.25 0 0112 10z" +
                "m4 0a1.25 1.25 0 110 2.5A1.25 1.25 0 0116 10z",
            evenOdd = true
        )
    }

    val ChatBubbleOutline: ImageVector = vec("ChatBubbleOutline") { line(BUBBLE, 2.2f) }

    val MarkChatUnread: ImageVector = vec("MarkChatUnread") {
        fill(BUBBLE)
        fill(circle(19f, 5f, 3.2f))
    }

    val Call: ImageVector = vec("Call") { fill(HANDSET) }
    val Phone: ImageVector = Call

    val CallEnd: ImageVector = vec("CallEnd") {
        addGroup(rotate = 135f, pivotX = 12f, pivotY = 12f)
        fill(HANDSET)
        clearGroup()
    }

    val Videocam: ImageVector = vec("Videocam") {
        fill(rrect(2.5f, 6f, 13f, 12f, 3.2f))
        fill(VIDEO_LENS)
    }

    val VideocamOff: ImageVector = vec("VideocamOff") {
        fill(rrect(2.5f, 6f, 13f, 12f, 3.2f), alpha = 0.45f)
        fill(VIDEO_LENS, alpha = 0.45f)
        line(SLASH)
    }

    val Mic: ImageVector = vec("Mic") {
        fill(rrect(8.5f, 2.5f, 7f, 12.5f, 3.5f))
        line("M5.5 11.5a6.5 6.5 0 0013 0M12 18v3", 2.2f)
    }

    val MicOff: ImageVector = vec("MicOff") {
        fill(rrect(8.5f, 2.5f, 7f, 12.5f, 3.5f), alpha = 0.45f)
        line("M5.5 11.5a6.5 6.5 0 0013 0M12 18v3", 2.2f, alpha = 0.45f)
        line(SLASH)
    }

    val PlayArrow: ImageVector = vec("PlayArrow") {
        fill("M8 6.2c0-1.1 1.2-1.7 2.1-1.1l9.1 5.8c.8.5.8 1.7 0 2.2l-9.1 5.8c-.9.6-2.1 0-2.1-1.1z")
    }

    val Pause: ImageVector = vec("Pause") {
        fill(rrect(6.5f, 4.5f, 3.8f, 15f, 1.4f))
        fill(rrect(13.7f, 4.5f, 3.8f, 15f, 1.4f))
    }

    val Send: ImageVector = vec("Send") {
        fill("M3.2 11.1L19.8 3.6c.9-.4 1.8.5 1.4 1.4l-7.5 16.6c-.4.9-1.7.8-2-.1l-1.8-6.4-6.4-1.8c-.9-.3-1-1.6-.1-2z")
    }

    val PushPin: ImageVector = vec("PushPin") {
        fill("M8 3.5h8l-1.2 6.2 2.7 2.8c.5.5.1 1.5-.6 1.5H7.1c-.7 0-1.1-1-.6-1.5l2.7-2.8z")
        line("M12 14v6.5", 2.2f)
    }

    val Notifications: ImageVector = vec("Notifications") {
        fill(BELL)
        fill(BELL_CLAPPER)
    }

    val NotificationsOff: ImageVector = vec("NotificationsOff") {
        fill(BELL, alpha = 0.45f)
        fill(BELL_CLAPPER, alpha = 0.45f)
        line(SLASH)
    }

    val Settings: ImageVector = vec("Settings") {
        fill(rrect(3f, 5f, 18f, 2.4f, 1.2f))
        fill(rrect(3f, 10.8f, 18f, 2.4f, 1.2f))
        fill(rrect(3f, 16.6f, 18f, 2.4f, 1.2f))
        fill(circle(15.5f, 6.2f, 3.2f))
        fill(circle(8.5f, 12f, 3.2f))
        fill(circle(16f, 17.8f, 3.2f))
    }

    val Person: ImageVector = vec("Person") {
        fill(circle(12f, 8f, 4f))
        fill("M4.5 20c0-3.9 3.4-6.5 7.5-6.5s7.5 2.6 7.5 6.5c0 .6-.4 1-1 1h-13c-.6 0-1-.4-1-1z")
    }

    val Group: ImageVector = vec("Group") {
        fill(circle(9f, 8f, 3.6f))
        fill("M2.5 19.5c0-3.4 2.9-5.7 6.5-5.7s6.5 2.3 6.5 5.7c0 .6-.4 1-1 1H3.5c-.6 0-1-.4-1-1z")
        fill(circle(17.2f, 9f, 2.7f))
        fill("M17.2 14.2c2.5 0 4.4 1.6 4.8 4.1.1.6-.3 1.2-.9 1.2h-3.7c.2-.4.2-.8.2-1.2 0-1.6-.6-3.1-1.7-4.1.4-.1.9-.1 1.3-.1z")
    }

    val EmojiEmotions: ImageVector = vec("EmojiEmotions") {
        fill(
            "M12 2a10 10 0 100 20 10 10 0 000-20zM8.6 8.8a1.4 1.4 0 110 2.8 1.4 1.4 0 010-2.8zm6.8 0a1.4 1.4 0 110 2.8 " +
                "1.4 1.4 0 010-2.8zM7.4 13.6h9.2a4.6 4.6 0 01-9.2 0z",
            evenOdd = true
        )
    }

    val Image: ImageVector = vec("Image") {
        fill(
            "M5.5 3h13A2.5 2.5 0 0121 5.5v13a2.5 2.5 0 01-2.5 2.5h-13A2.5 2.5 0 013 18.5v-13A2.5 2.5 0 015.5 3z" +
                "M8.6 6.9a1.8 1.8 0 110 3.6 1.8 1.8 0 010-3.6zM5 18l4.2-5.3 3 3.6 2.2-2.6L19 18z",
            evenOdd = true
        )
    }

    val InsertDriveFile: ImageVector = vec("InsertDriveFile") { fill(FILE, evenOdd = true) }
    val Description: ImageVector = InsertDriveFile

    val Edit: ImageVector = vec("Edit") {
        fill("M15.2 4.8l4 4-10.9 10.9c-.2.2-.4.3-.7.4L4.3 20.7l.6-3.3c.1-.3.2-.5.4-.7z")
        fill("M16.6 3.4c.8-.8 2-.8 2.8 0l1.2 1.2c.8.8.8 2 0 2.8l-.7.7-4-4z")
    }

    val Delete: ImageVector = vec("Delete") {
        fill("M9 3.5h6l.7 1.5H20a1 1 0 010 2H4a1 1 0 010-2h4.3z")
        fill("M5.5 9h13l-.9 10.2A2 2 0 0115.6 21H8.4a2 2 0 01-2-1.8z")
    }
    val DeleteSweep: ImageVector = Delete

    val Logout: ImageVector = vec("Logout") {
        line("M10 4H6a2 2 0 00-2 2v12a2 2 0 002 2h4", 2.2f)
        line("M15 8l4 4-4 4M19 12H9")
    }
}
