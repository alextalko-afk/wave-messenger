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

// MONO is kept only so a value saved by an older version can still be read;
// it is no longer offered and always resolves to the colourful palette.
enum class WaveThemeVariant { COLORFUL, MONO }

// SYSTEM follows the phone's light/dark setting.
enum class WaveAppearance { DARK, LIGHT, SYSTEM }

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

// What the palette actually is right now: always DARK or LIGHT.
var currentWaveAppearance by mutableStateOf(WaveAppearance.DARK)
    private set

// What the user picked, which may be SYSTEM.
var waveAppearanceChoice by mutableStateOf(WaveAppearance.DARK)
    private set

private var waveSystemDark by mutableStateOf(true)

fun applyWaveTheme(variant: WaveThemeVariant, appearance: WaveAppearance = waveAppearanceChoice) {
    currentWaveThemeVariant = WaveThemeVariant.COLORFUL
    waveAppearanceChoice = appearance
    val resolved = when (appearance) {
        WaveAppearance.SYSTEM -> if (waveSystemDark) WaveAppearance.DARK else WaveAppearance.LIGHT
        else -> appearance
    }
    currentWaveAppearance = resolved
    if (resolved == WaveAppearance.DARK) {
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
    } else {
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
}

fun setWaveAppearance(context: Context, appearance: WaveAppearance) {
    applyWaveTheme(WaveThemeVariant.COLORFUL, appearance)
    SessionStore(context).appearanceMode = appearance.name
}

fun loadWaveTheme(context: Context) {
    val savedAppearance = SessionStore(context).appearanceMode
        ?.let { runCatching { WaveAppearance.valueOf(it) }.getOrNull() }
        ?: WaveAppearance.DARK
    applyWaveTheme(WaveThemeVariant.COLORFUL, savedAppearance)
}

@Composable
fun WaveTheme(content: @Composable () -> Unit) {
    // Keep the palette in step with the phone's own light/dark switch when the
    // user chose "System".
    val systemDark = androidx.compose.foundation.isSystemInDarkTheme()
    androidx.compose.runtime.SideEffect {
        if (waveSystemDark != systemDark) {
            waveSystemDark = systemDark
            applyWaveTheme(WaveThemeVariant.COLORFUL, waveAppearanceChoice)
        }
    }
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
