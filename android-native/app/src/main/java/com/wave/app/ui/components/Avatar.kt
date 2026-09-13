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
    val base = remember(colorHex) {
        runCatching { Color(android.graphics.Color.parseColor(colorHex ?: "#7c5cff")) }
            .getOrDefault(Color(0xFF7C5CFF))
    }
    val light = remember(base) { lerp(base, Color.White, 0.16f) }
    val deep = remember(base) { lerp(base, Color.Black, 0.28f) }
    val initial = name.trim().firstOrNull()?.uppercaseChar()?.toString() ?: "?"

    Box(
        modifier = Modifier
            .size(size.dp)
            .shadow(elevation = (size / 7).dp, shape = CircleShape, ambientColor = base, spotColor = base)
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
