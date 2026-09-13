package com.wave.app.ui.components

import androidx.compose.animation.animateColorAsState
import androidx.compose.animation.core.animateFloatAsState
import androidx.compose.animation.core.tween
import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.interaction.MutableInteractionSource
import androidx.compose.foundation.interaction.collectIsFocusedAsState
import androidx.compose.foundation.interaction.collectIsPressedAsState
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Text
import androidx.compose.material3.TextField
import androidx.compose.material3.TextFieldDefaults
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.remember
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.scale
import androidx.compose.ui.draw.shadow
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.input.KeyboardType
import androidx.compose.ui.text.input.PasswordVisualTransformation
import androidx.compose.ui.text.input.VisualTransformation
import androidx.compose.ui.unit.dp
import com.wave.app.ui.theme.Inter
import com.wave.app.ui.theme.WaveAccent
import com.wave.app.ui.theme.WaveAccent2
import com.wave.app.ui.theme.WaveAccentDeep
import com.wave.app.ui.theme.WaveMuted
import com.wave.app.ui.theme.WavePanel2
import com.wave.app.ui.theme.WaveText

/** Flat, borderless field with a subtle glow that appears on focus - reads as considered, not default Material. */
@Composable
fun WaveTextField(
    value: String,
    onValueChange: (String) -> Unit,
    placeholder: String,
    modifier: Modifier = Modifier,
    isPassword: Boolean = false,
    keyboardType: KeyboardType = KeyboardType.Text,
    singleLine: Boolean = true,
    enabled: Boolean = true
) {
    val interactionSource = remember { MutableInteractionSource() }
    val isFocused by interactionSource.collectIsFocusedAsState()
    val borderColor by animateColorAsState(
        targetValue = if (isFocused) WaveAccent.copy(alpha = 0.55f) else Color.Transparent,
        animationSpec = tween(200),
        label = "fieldBorder"
    )

    TextField(
        value = value,
        onValueChange = onValueChange,
        placeholder = { Text(placeholder, color = WaveMuted, fontFamily = Inter) },
        singleLine = singleLine,
        enabled = enabled,
        interactionSource = interactionSource,
        visualTransformation = if (isPassword) PasswordVisualTransformation() else VisualTransformation.None,
        keyboardOptions = androidx.compose.foundation.text.KeyboardOptions(keyboardType = keyboardType),
        shape = RoundedCornerShape(14.dp),
        textStyle = MaterialTheme.typography.bodyLarge.copy(color = WaveText, fontFamily = Inter),
        colors = TextFieldDefaults.colors(
            focusedContainerColor = WavePanel2,
            unfocusedContainerColor = WavePanel2,
            disabledContainerColor = WavePanel2,
            focusedIndicatorColor = Color.Transparent,
            unfocusedIndicatorColor = Color.Transparent,
            disabledIndicatorColor = Color.Transparent,
            cursorColor = WaveAccent
        ),
        modifier = modifier
            .fillMaxWidth()
            .border(1.dp, borderColor, RoundedCornerShape(14.dp))
    )
}

/** Pill-shaped gradient button with a soft colored glow and a tactile press animation. */
@Composable
fun WaveButton(
    text: String,
    onClick: () -> Unit,
    modifier: Modifier = Modifier,
    enabled: Boolean = true,
    loading: Boolean = false
) {
    val interactionSource = remember { MutableInteractionSource() }
    val isPressed by interactionSource.collectIsPressedAsState()
    val scale by animateFloatAsState(if (isPressed) 0.97f else 1f, animationSpec = tween(120), label = "btnScale")
    val gradient = Brush.horizontalGradient(listOf(WaveAccent, WaveAccent2, WaveAccentDeep))

    androidx.compose.material3.Surface(
        onClick = onClick,
        enabled = enabled && !loading,
        interactionSource = interactionSource,
        shape = RoundedCornerShape(50),
        color = Color.Transparent,
        modifier = modifier
            .fillMaxWidth()
            .height(52.dp)
            .scale(scale)
            .shadow(
                elevation = if (enabled) 14.dp else 0.dp,
                shape = RoundedCornerShape(50),
                ambientColor = WaveAccent,
                spotColor = WaveAccent
            )
    ) {
        Box(
            modifier = Modifier
                .fillMaxWidth()
                .background(if (enabled) gradient else Brush.horizontalGradient(listOf(WaveMuted, WaveMuted))),
            contentAlignment = Alignment.Center
        ) {
            if (loading) {
                CircularProgressIndicator(modifier = Modifier.height(20.dp), color = Color.White, strokeWidth = 2.dp)
            } else {
                Text(text, color = Color.White, fontFamily = Inter, fontWeight = FontWeight.SemiBold, style = MaterialTheme.typography.titleMedium)
            }
        }
    }
}
