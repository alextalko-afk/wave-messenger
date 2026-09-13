package com.wave.app.ui.components

import androidx.compose.foundation.background
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Text
import androidx.compose.material3.TextField
import androidx.compose.material3.TextFieldDefaults
import androidx.compose.runtime.Composable
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.input.KeyboardType
import androidx.compose.ui.text.input.PasswordVisualTransformation
import androidx.compose.ui.text.input.VisualTransformation
import androidx.compose.ui.unit.dp
import com.wave.app.ui.theme.WaveAccent
import com.wave.app.ui.theme.WaveAccent2
import com.wave.app.ui.theme.WaveMuted
import com.wave.app.ui.theme.WavePanel2
import com.wave.app.ui.theme.WaveText

/** Flat, borderless, panel-colored field matching the web client's inputs (no boxy Material outline). */
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
    TextField(
        value = value,
        onValueChange = onValueChange,
        placeholder = { Text(placeholder, color = WaveMuted) },
        singleLine = singleLine,
        enabled = enabled,
        visualTransformation = if (isPassword) PasswordVisualTransformation() else VisualTransformation.None,
        keyboardOptions = androidx.compose.foundation.text.KeyboardOptions(keyboardType = keyboardType),
        shape = RoundedCornerShape(14.dp),
        textStyle = MaterialTheme.typography.bodyLarge.copy(color = WaveText),
        colors = TextFieldDefaults.colors(
            focusedContainerColor = WavePanel2,
            unfocusedContainerColor = WavePanel2,
            disabledContainerColor = WavePanel2,
            focusedIndicatorColor = Color.Transparent,
            unfocusedIndicatorColor = Color.Transparent,
            disabledIndicatorColor = Color.Transparent,
            cursorColor = WaveAccent
        ),
        modifier = modifier.fillMaxWidth()
    )
}

/** Pill-shaped gradient button matching the web client's accent buttons. */
@Composable
fun WaveButton(
    text: String,
    onClick: () -> Unit,
    modifier: Modifier = Modifier,
    enabled: Boolean = true,
    loading: Boolean = false
) {
    val gradient = Brush.horizontalGradient(listOf(WaveAccent, WaveAccent2))
    androidx.compose.material3.Surface(
        onClick = onClick,
        enabled = enabled && !loading,
        shape = RoundedCornerShape(50),
        color = Color.Transparent,
        modifier = modifier
            .fillMaxWidth()
            .height(50.dp)
    ) {
        androidx.compose.foundation.layout.Box(
            modifier = Modifier
                .fillMaxWidth()
                .background(if (enabled) gradient else Brush.horizontalGradient(listOf(WaveMuted, WaveMuted)))
                .then(Modifier),
            contentAlignment = androidx.compose.ui.Alignment.Center
        ) {
            if (loading) {
                CircularProgressIndicator(modifier = Modifier.height(20.dp), color = Color.White, strokeWidth = 2.dp)
            } else {
                Text(text, color = Color.White, style = MaterialTheme.typography.titleMedium)
            }
        }
    }
}
