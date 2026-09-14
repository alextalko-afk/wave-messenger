package com.wave.app

import android.app.Application
import coil.Coil
import coil.ImageLoader
import coil.decode.VideoFrameDecoder
import com.wave.app.call.CallManager
import com.wave.app.data.SessionStore
import com.wave.app.network.ApiClient

class WaveApplication : Application() {
    lateinit var session: SessionStore
        private set

    override fun onCreate() {
        super.onCreate()
        session = SessionStore(this)
        ApiClient.init(session)
        CallManager.init(this)
        CallManager.registerSignaling()

        // Lets Coil pull a poster frame out of video URLs for message/attachment thumbnails.
        Coil.setImageLoader(
            ImageLoader.Builder(this)
                .components { add(VideoFrameDecoder.Factory()) }
                .build()
        )
    }
}
