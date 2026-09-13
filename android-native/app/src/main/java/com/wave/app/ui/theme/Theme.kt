package com.wave.app.ui.theme

import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Surface
import androidx.compose.material3.darkColorScheme
import androidx.compose.runtime.Composable
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color

// Monochrome, minimal: pure grayscale surfaces, no brand color. Contrast and
// typography carry the hierarchy instead of hue.
val WaveBg = Color(0xFF000000)
val WavePanel = Color(0xFF121212)
val WavePanel2 = Color(0xFF1C1C1E)
val WaveElevated = Color(0xFF242426)
val WaveBorder = Color(0xFF2C2C2E)

// Kept as three names for call-site compatibility (buttons/avatars/FAB used
// to gradient across these) - now three closely-spaced grays so anything
// still using a gradient brush reads as a flat, near-monochrome surface.
val WaveAccent = Color(0xFFFFFFFF)
val WaveAccent2 = Color(0xFFF0F0F0)
val WaveAccentDeep = Color(0xFFD8D8D8)

val WaveText = Color(0xFFF5F5F5)
val WaveMuted = Color(0xFF9A9A9E)
val WaveMutedFaint = Color(0xFF5C5C5E)

val WaveBubbleOut = Color(0xFF3A3A3C)
val WaveBubbleIn = Color(0xFF1C1C1E)
val WaveCheck = Color(0xFFFFFFFF)

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
