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
var WaveBg by mutableStateOf(Color(0xFF0A1017))
var WavePanel by mutableStateOf(Color(0xFF0F1620))
var WavePanel2 by mutableStateOf(Color(0xFF17212C))
var WaveElevated by mutableStateOf(Color(0xFF223244))
var WaveBorder by mutableStateOf(Color(0xFF1D2937))

var WaveAccent by mutableStateOf(Color(0xFF3B82F6))
var WaveAccent2 by mutableStateOf(Color(0xFF2563EB))
var WaveAccentDeep by mutableStateOf(Color(0xFF2563EB))

// The color to use for text/icons drawn on top of an accent-colored surface
// (buttons, FAB, send/mic circle) - white on the colorful theme's blue
// gradient, black on the mono theme's white/gray one.
var WaveOnAccent by mutableStateOf(Color.White)

var WaveText by mutableStateOf(Color(0xFFEAF0F6))
var WaveMuted by mutableStateOf(Color(0xFF8696A7))
var WaveMutedFaint by mutableStateOf(Color(0xFF7A8A9C))

var WaveBubbleOut by mutableStateOf(Color(0xFF2563EB))
var WaveBubbleIn by mutableStateOf(Color(0xFF17212C))
var WaveCheck by mutableStateOf(Color(0xFF34D399))

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
            WaveBg = Color(0xFF0A1017)
            WavePanel = Color(0xFF0F1620)
            WavePanel2 = Color(0xFF17212C)
            WaveElevated = Color(0xFF223244)
            WaveBorder = Color(0xFF1D2937)
            WaveAccent = Color(0xFF3B82F6)
            WaveAccent2 = Color(0xFF2563EB)
            WaveAccentDeep = Color(0xFF2563EB)
            WaveOnAccent = Color.White
            WaveText = Color(0xFFEAF0F6)
            WaveMuted = Color(0xFF8696A7)
            WaveMutedFaint = Color(0xFF7A8A9C)
            WaveBubbleOut = Color(0xFF2563EB)
            WaveBubbleIn = Color(0xFF17212C)
            WaveCheck = Color(0xFF34D399)
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
            WaveBg = Color(0xFFEEF2F7)
            WavePanel = Color(0xFFFFFFFF)
            WavePanel2 = Color(0xFFF1F5FA)
            WaveElevated = Color(0xFFE3E9F1)
            WaveBorder = Color(0xFFDDE4ED)
            WaveAccent = Color(0xFF1D6FE0)
            WaveAccent2 = Color(0xFF2563EB)
            WaveAccentDeep = Color(0xFF1D4ED8)
            WaveOnAccent = Color.White
            WaveText = Color(0xFF101826)
            WaveMuted = Color(0xFF5B6B7C)
            WaveMutedFaint = Color(0xFF667587)
            WaveBubbleOut = Color(0xFFD6E6FF)
            WaveBubbleIn = Color(0xFFFFFFFF)
            WaveCheck = Color(0xFF0F8F60)
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
