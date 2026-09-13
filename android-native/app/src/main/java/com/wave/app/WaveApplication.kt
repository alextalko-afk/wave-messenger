package com.wave.app

import android.app.Application
import com.wave.app.data.SessionStore
import com.wave.app.network.ApiClient

class WaveApplication : Application() {
    lateinit var session: SessionStore
        private set

    override fun onCreate() {
        super.onCreate()
        session = SessionStore(this)
        ApiClient.init(session)
    }
}
