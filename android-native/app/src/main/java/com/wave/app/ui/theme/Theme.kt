package com.wave.app.ui.theme

import android.content.Context
import com.wave.app.data.SessionStore
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Surface
import androidx.compose.material3.darkColorScheme
import androidx.compose.material3.lightColorScheme
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.setValue
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color

enum class WaveThemeVariant { COLORFUL, MONO }
enum class WaveAppearance { DARK, LIGHT }

// These are top-level `by mutableStateOf(...)` properties rather than a
// CompositionLocal: every screen already reads them as plain top-level vals,
// and Compose's snapshot system tracks reads of a mutableStateOf-backed
// property the same way whether it's declared at the top level or with
// `remember` - so switching the theme just reassigns these and everything
// that read one during composition recomposes, with zero call-site changes
// across the ~15 files that already import them.
var WaveBg by mutableStateOf(Color(0xFF0A0E14))
var WavePanel by mutableStateOf(Color(0xFF121822))
var WavePanel2 by mutableStateOf(Color(0xFF1A2230))
var WaveElevated by mutableStateOf(Color(0xFF202A38))
var WaveBorder by mutableStateOf(Color(0xFF232C3A))

var WaveAccent by mutableStateOf(Color(0xFF2AABEE))
var WaveAccent2 by mutableStateOf(Color(0xFF3E7BFA))
var WaveAccentDeep by mutableStateOf(Color(0xFF6C5CE7))

// The color to use for text/icons drawn on top of an accent-colored surface
// (buttons, FAB, send/mic circle) - white on the colorful theme's blue
// gradient, black on the mono theme's white/gray one.
var WaveOnAccent by mutableStateOf(Color.White)

var WaveText by mutableStateOf(Color(0xFFF3F6FA))
var WaveMuted by mutableStateOf(Color(0xFF8A93A6))
var WaveMutedFaint by mutableStateOf(Color(0xFF5B6373))

var WaveBubbleOut by mutableStateOf(Color(0xFF285D8C))
var WaveBubbleIn by mutableStateOf(Color(0xFF161F2B))
var WaveCheck by mutableStateOf(Color(0xFF5FD3A0))

val WaveShadow = Color(0xFF000000)

var currentWaveThemeVariant by mutableStateOf(WaveThemeVariant.COLORFUL)
    private set
var currentWaveAppearance by mutableStateOf(WaveAppearance.DARK)
    private set

fun applyWaveTheme(variant: WaveThemeVariant, appearance: WaveAppearance = currentWaveAppearance) {
    currentWaveThemeVariant = variant
    currentWaveAppearance = appearance
    when (variant to appearance) {
        WaveThemeVariant.COLORFUL to WaveAppearance.DARK -> {
            WaveBg = Color(0xFF0A0E14)
            WavePanel = Color(0xFF121822)
            WavePanel2 = Color(0xFF1A2230)
            WaveElevated = Color(0xFF202A38)
            WaveBorder = Color(0xFF232C3A)
            WaveAccent = Color(0xFF2AABEE)
            WaveAccent2 = Color(0xFF3E7BFA)
            WaveAccentDeep = Color(0xFF6C5CE7)
            WaveOnAccent = Color.White
            WaveText = Color(0xFFF3F6FA)
            WaveMuted = Color(0xFF8A93A6)
            WaveMutedFaint = Color(0xFF5B6373)
            WaveBubbleOut = Color(0xFF285D8C)
            WaveBubbleIn = Color(0xFF161F2B)
            WaveCheck = Color(0xFF5FD3A0)
        }
        WaveThemeVariant.MONO to WaveAppearance.DARK -> {
            WaveBg = Color(0xFF000000)
            WavePanel = Color(0xFF121212)
            WavePanel2 = Color(0xFF1C1C1E)
            WaveElevated = Color(0xFF242426)
            WaveBorder = Color(0xFF2C2C2E)
            WaveAccent = Color(0xFFFFFFFF)
            WaveAccent2 = Color(0xFFF0F0F0)
            WaveAccentDeep = Color(0xFFD8D8D8)
            WaveOnAccent = Color.Black
            WaveText = Color(0xFFF5F5F5)
            WaveMuted = Color(0xFF9A9A9E)
            WaveMutedFaint = Color(0xFF5C5C5E)
            WaveBubbleOut = Color(0xFF3A3A3C)
            WaveBubbleIn = Color(0xFF1C1C1E)
            WaveCheck = Color(0xFFFFFFFF)
        }
        WaveThemeVariant.COLORFUL to WaveAppearance.LIGHT -> {
            // Same brand accent hues as the dark colorful palette - only
            // surfaces/text flip, matching the web client's light theme.
            WaveBg = Color(0xFFFFFFFF)
            WavePanel = Color(0xFFFFFFFF)
            WavePanel2 = Color(0xFFF4F4F5)
            WaveElevated = Color(0xFFECEEF0)
            WaveBorder = Color(0xFFE4E6EB)
            WaveAccent = Color(0xFF2AABEE)
            WaveAccent2 = Color(0xFF3E7BFA)
            WaveAccentDeep = Color(0xFF6C5CE7)
            WaveOnAccent = Color.White
            WaveText = Color(0xFF17212B)
            WaveMuted = Color(0xFF8A97A3)
            WaveMutedFaint = Color(0xFFB0B8C1)
            WaveBubbleOut = Color(0xFFDCEEFC)
            WaveBubbleIn = Color(0xFFF1F2F4)
            WaveCheck = Color(0xFF34C759)
        }
        else -> {
            // MONO to LIGHT
            WaveBg = Color(0xFFFFFFFF)
            WavePanel = Color(0xFFF7F7F7)
            WavePanel2 = Color(0xFFEFEFEF)
            WaveElevated = Color(0xFFE5E5E5)
            WaveBorder = Color(0xFFDDDDDD)
            WaveAccent = Color(0xFF1C1C1E)
            WaveAccent2 = Color(0xFF333333)
            WaveAccentDeep = Color(0xFF1A1A1A)
            WaveOnAccent = Color.White
            WaveText = Color(0xFF1A1A1A)
            WaveMuted = Color(0xFF6E6E73)
            WaveMutedFaint = Color(0xFFAEAEB2)
            WaveBubbleOut = Color(0xFFE5E5E5)
            WaveBubbleIn = Color(0xFFF2F2F2)
            WaveCheck = Color(0xFF1A1A1A)
        }
    }
}

fun setWaveTheme(context: Context, variant: WaveThemeVariant) {
    applyWaveTheme(variant, currentWaveAppearance)
    SessionStore(context).themeVariant = variant.name
}

fun setWaveAppearance(context: Context, appearance: WaveAppearance) {
    applyWaveTheme(currentWaveThemeVariant, appearance)
    SessionStore(context).appearanceMode = appearance.name
}

fun loadWaveTheme(context: Context) {
    val savedVariant = SessionStore(context).themeVariant
        ?.let { runCatching { WaveThemeVariant.valueOf(it) }.getOrNull() }
        ?: WaveThemeVariant.COLORFUL
    val savedAppearance = SessionStore(context).appearanceMode
        ?.let { runCatching { WaveAppearance.valueOf(it) }.getOrNull() }
        ?: WaveAppearance.DARK
    applyWaveTheme(savedVariant, savedAppearance)
}

@Composable
fun WaveTheme(content: @Composable () -> Unit) {
    // Read as vars (not through a local val computed once) so this
    // composable - and therefore everything inside it - recomposes
    // whenever applyWaveTheme() reassigns them.
    val colorScheme = if (currentWaveAppearance == WaveAppearance.LIGHT) {
        lightColorScheme(
            primary = WaveAccent,
            secondary = WaveAccentDeep,
            background = WaveBg,
            surface = WavePanel,
            surfaceVariant = WavePanel2,
            onBackground = WaveText,
            onSurface = WaveText,
            outline = WaveBorder,
        )
    } else {
        darkColorScheme(
            primary = WaveAccent,
            secondary = WaveAccentDeep,
            background = WaveBg,
            surface = WavePanel,
            surfaceVariant = WavePanel2,
            onBackground = WaveText,
            onSurface = WaveText,
            outline = WaveBorder,
        )
    }
    MaterialTheme(
        colorScheme = colorScheme,
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
