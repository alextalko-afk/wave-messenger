package com.wave.app.data

import android.content.ComponentName
import android.content.Context
import android.content.pm.PackageManager

enum class AppIconVariant(val alias: String, val label: String) {
    DEFAULT("com.wave.app.LauncherDefault", "Обычная"),
    MONO("com.wave.app.LauncherMono", "Тёмная"),
}

/**
 * Swaps the launcher icon via activity-alias components - MainActivity
 * itself is no longer exported/launchable directly, only through whichever
 * alias is currently enabled. Changing the enabled component makes most
 * launchers pick up the new icon within a few seconds without needing the
 * app to restart.
 */
fun setAppIcon(context: Context, variant: AppIconVariant) {
    val pm = context.packageManager
    for (candidate in AppIconVariant.entries) {
        val state = if (candidate == variant) {
            PackageManager.COMPONENT_ENABLED_STATE_ENABLED
        } else {
            PackageManager.COMPONENT_ENABLED_STATE_DISABLED
        }
        pm.setComponentEnabledSetting(
            ComponentName(context.packageName, candidate.alias),
            state,
            PackageManager.DONT_KILL_APP
        )
    }
}

fun getCurrentAppIcon(context: Context): AppIconVariant {
    val pm = context.packageManager
    for (candidate in AppIconVariant.entries) {
        val state = pm.getComponentEnabledSetting(ComponentName(context.packageName, candidate.alias))
        val enabled = state == PackageManager.COMPONENT_ENABLED_STATE_ENABLED ||
            (state == PackageManager.COMPONENT_ENABLED_STATE_DEFAULT && candidate == AppIconVariant.DEFAULT)
        if (enabled) return candidate
    }
    return AppIconVariant.DEFAULT
}
