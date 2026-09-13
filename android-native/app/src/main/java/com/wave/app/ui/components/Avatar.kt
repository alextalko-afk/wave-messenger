package com.wave.app.ui.components

import androidx.compose.foundation.background
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.remember
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.draw.shadow
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.lerp
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.wave.app.ui.theme.Inter

@Composable
fun Avatar(name: String, colorHex: String?, size: Int = 44) {
    // Desaturate whatever per-user color the server assigned down to a
    // gray - keeps a bit of per-user distinction without any hue.
    val gray = remember(colorHex) {
        val c = runCatching { Color(android.graphics.Color.parseColor(colorHex ?: "#7c5cff")) }
            .getOrDefault(Color(0xFF7C5CFF))
        val luminance = 0.299f * c.red + 0.587f * c.green + 0.114f * c.blue
        val level = 0.32f + luminance * 0.28f
        Color(level, level, level)
    }
    val light = remember(gray) { lerp(gray, Color.White, 0.22f) }
    val deep = remember(gray) { lerp(gray, Color.Black, 0.22f) }
    val initial = name.trim().firstOrNull()?.uppercaseChar()?.toString() ?: "?"

    Box(
        modifier = Modifier
            .size(size.dp)
            .shadow(elevation = (size / 9).dp, shape = CircleShape, ambientColor = Color.Black, spotColor = Color.Black)
            .clip(CircleShape)
            .background(Brush.linearGradient(listOf(light, deep))),
        contentAlignment = Alignment.Center
    ) {
        Text(
            text = initial,
            color = Color.White,
            fontFamily = Inter,
            fontWeight = FontWeight.Bold,
            fontSize = (size / 2.3).sp
        )
    }
}
