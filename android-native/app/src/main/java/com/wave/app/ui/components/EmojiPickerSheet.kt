package com.wave.app.ui.components

import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.lazy.grid.GridCells
import androidx.compose.foundation.lazy.grid.LazyVerticalGrid
import androidx.compose.foundation.lazy.grid.items
import androidx.compose.material3.ExperimentalMaterial3Api
import androidx.compose.material3.ModalBottomSheet
import androidx.compose.material3.Tab
import androidx.compose.material3.TabRow
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Modifier
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.wave.app.data.EMOJI_LIST
import com.wave.app.data.STICKER_LIST
import com.wave.app.ui.theme.WavePanel

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun EmojiPickerSheet(onSelectEmoji: (String) -> Unit, onSelectSticker: (String) -> Unit, onDismiss: () -> Unit) {
    var tab by remember { mutableStateOf(0) }

    ModalBottomSheet(onDismissRequest = onDismiss, containerColor = WavePanel) {
        TabRow(selectedTabIndex = tab) {
            Tab(selected = tab == 0, onClick = { tab = 0 }, text = { Text("Эмодзи") })
            Tab(selected = tab == 1, onClick = { tab = 1 }, text = { Text("Стикеры") })
        }
        val items = if (tab == 0) EMOJI_LIST else STICKER_LIST
        LazyVerticalGrid(
            columns = GridCells.Fixed(6),
            modifier = Modifier.fillMaxWidth().padding(12.dp),
            horizontalArrangement = Arrangement.SpaceEvenly,
            verticalArrangement = Arrangement.spacedBy(8.dp)
        ) {
            items(items) { emoji ->
                Text(
                    text = emoji,
                    fontSize = 28.sp,
                    modifier = Modifier
                        .padding(4.dp)
                        .clickable {
                            if (tab == 0) onSelectEmoji(emoji) else onSelectSticker(emoji)
                        }
                )
            }
        }
    }
}
