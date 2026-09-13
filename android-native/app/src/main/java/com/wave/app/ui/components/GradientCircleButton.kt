package com.wave.app.ui.components

import androidx.compose.animation.core.animateFloatAsState
import androidx.compose.animation.core.tween
import androidx.compose.foundation.background
import androidx.compose.foundation.interaction.MutableInteractionSource
import androidx.compose.foundation.interaction.collectIsPressedAsState
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.material3.Icon
import androidx.compose.material3.Surface
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.remember
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.scale
import androidx.compose.ui.draw.shadow
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.vector.ImageVector
import androidx.compose.ui.unit.dp
import com.wave.app.ui.theme.WaveText

/** Small circular action button (send/mic/fab-style) - solid white, black glyph, press feedback. */
@Composable
fun GradientCircleButton(
    icon: ImageVector,
    contentDescription: String?,
    onClick: () -> Unit,
    size: androidx.compose.ui.unit.Dp = 42.dp,
    enabled: Boolean = true
) {
    val interactionSource = remember { MutableInteractionSource() }
    val isPressed by interactionSource.collectIsPressedAsState()
    val scale by animateFloatAsState(if (isPressed) 0.9f else 1f, animationSpec = tween(120), label = "circleBtnScale")

    Surface(
        onClick = onClick,
        enabled = enabled,
        interactionSource = interactionSource,
        shape = CircleShape,
        color = Color.Transparent,
        modifier = Modifier
            .size(size)
            .scale(scale)
            .shadow(elevation = 6.dp, shape = CircleShape, ambientColor = Color.Black, spotColor = Color.Black)
    ) {
        Box(
            modifier = Modifier
                .fillMaxSize()
                .background(WaveText),
            contentAlignment = Alignment.Center
        ) {
            Icon(icon, contentDescription = contentDescription, tint = Color.Black, modifier = Modifier.size(size * 0.45f))
        }
    }
}
