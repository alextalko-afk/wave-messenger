package com.wave.app.ui.theme

import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Surface
import androidx.compose.material3.darkColorScheme
import androidx.compose.runtime.Composable
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color

// A layered, near-black palette (Discord/Linear-style depth) rather than
// one flat dark gray - each surface tone reads as a distinct plane.
val WaveBg = Color(0xFF0A0E14)
val WavePanel = Color(0xFF121822)
val WavePanel2 = Color(0xFF1A2230)
val WaveElevated = Color(0xFF202A38)
val WaveBorder = Color(0xFF232C3A)

val WaveAccent = Color(0xFF2AABEE)
val WaveAccent2 = Color(0xFF3E7BFA)
val WaveAccentDeep = Color(0xFF6C5CE7)

val WaveText = Color(0xFFF3F6FA)
val WaveMuted = Color(0xFF8A93A6)
val WaveMutedFaint = Color(0xFF5B6373)

val WaveBubbleOut = Color(0xFF285D8C)
val WaveBubbleIn = Color(0xFF161F2B)
val WaveCheck = Color(0xFF5FD3A0)

val WaveShadow = Color(0xFF000000)

private val WaveColorScheme = darkColorScheme(
    primary = WaveAccent,
    secondary = WaveAccentDeep,
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
        typography = WaveTypography,
    ) {
        // A safety-net Surface: without it, any screen that isn't built on
        // Scaffold (which sets its own contentColor) falls back to
        // Compose's hardcoded black default text color on our dark background.
        Surface(color = WaveBg, contentColor = WaveText, modifier = Modifier.fillMaxSize()) {
            content()
        }
    }
}
