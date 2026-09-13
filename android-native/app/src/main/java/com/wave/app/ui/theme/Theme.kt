package com.wave.app.ui.theme

import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.darkColorScheme
import androidx.compose.runtime.Composable
import androidx.compose.ui.graphics.Color

// Mirrors client/src/index.css's dark palette so the native app matches
// the web/desktop clients.
val WaveBg = Color(0xFF0E1621)
val WavePanel = Color(0xFF17212B)
val WavePanel2 = Color(0xFF1C2733)
val WaveBorder = Color(0xFF101921)
val WaveAccent = Color(0xFF2AABEE)
val WaveAccent2 = Color(0xFF229ED9)
val WaveText = Color(0xFFF5F5F5)
val WaveMuted = Color(0xFF6C7883)
val WaveBubbleOut = Color(0xFF2B5278)
val WaveBubbleIn = Color(0xFF182533)
val WaveCheck = Color(0xFF6CC96A)

private val WaveColorScheme = darkColorScheme(
    primary = WaveAccent,
    secondary = WaveAccent2,
    background = WaveBg,
    surface = WavePanel,
    surfaceVariant = WavePanel2,
    onBackground = WaveText,
    onSurface = WaveText,
    outline = WaveBorder,
)

@Composable
fun WaveTheme(content: @Composable () -> Unit) {
    MaterialTheme(
        colorScheme = WaveColorScheme,
        typography = MaterialTheme.typography,
        content = content
    )
}
