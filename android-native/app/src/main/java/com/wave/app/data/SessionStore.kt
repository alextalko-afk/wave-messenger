package com.wave.app.data

import android.content.Context
import android.content.SharedPreferences
import com.wave.app.model.User
import com.google.gson.Gson

/**
 * Holds the JWT and current user across app restarts. Not encrypted -
 * acceptable for a first native build; worth revisiting before this
 * ships beyond personal/testing use.
 */
class SessionStore(context: Context) {
    private val prefs: SharedPreferences =
        context.applicationContext.getSharedPreferences("wave_session", Context.MODE_PRIVATE)
    private val gson = Gson()

    var token: String?
        get() = prefs.getString("token", null)
        set(value) = prefs.edit().putString("token", value).apply()

    var user: User?
        get() = prefs.getString("user", null)?.let { gson.fromJson(it, User::class.java) }
        set(value) = prefs.edit().putString("user", value?.let { gson.toJson(it) }).apply()

    var themeVariant: String?
        get() = prefs.getString("theme_variant", null)
        set(value) = prefs.edit().putString("theme_variant", value).apply()

    fun clear() {
        prefs.edit().clear().apply()
    }

    fun isLoggedIn(): Boolean = !token.isNullOrEmpty()
}
