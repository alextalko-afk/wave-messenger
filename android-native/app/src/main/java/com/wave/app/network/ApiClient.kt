package com.wave.app.network

import com.wave.app.data.SessionStore
import okhttp3.Interceptor
import okhttp3.OkHttpClient
import okhttp3.logging.HttpLoggingInterceptor
import retrofit2.Retrofit
import retrofit2.converter.gson.GsonConverterFactory
import java.util.concurrent.TimeUnit

/**
 * Same backend the web client and desktop app talk to.
 */
const val BASE_URL = "https://wave-messenger-3r2p.onrender.com/"

object ApiClient {
    private lateinit var session: SessionStore

    fun init(session: SessionStore) {
        this.session = session
    }

    private val authInterceptor = Interceptor { chain ->
        val token = session.token
        val request = chain.request().newBuilder().apply {
            if (!token.isNullOrEmpty()) addHeader("Authorization", "Bearer $token")
        }.build()
        chain.proceed(request)
    }

    private val logging = HttpLoggingInterceptor().apply {
        level = HttpLoggingInterceptor.Level.BASIC
    }

    private val okHttpClient: OkHttpClient by lazy {
        OkHttpClient.Builder()
            .addInterceptor(authInterceptor)
            .addInterceptor(logging)
            .connectTimeout(20, TimeUnit.SECONDS)
            .readTimeout(30, TimeUnit.SECONDS)
            .writeTimeout(30, TimeUnit.SECONDS)
            .build()
    }

    private val retrofit: Retrofit by lazy {
        Retrofit.Builder()
            .baseUrl(BASE_URL)
            .client(okHttpClient)
            .addConverterFactory(GsonConverterFactory.create())
            .build()
    }

    val auth: AuthApi by lazy { retrofit.create(AuthApi::class.java) }
    val conversations: ConversationsApi by lazy { retrofit.create(ConversationsApi::class.java) }
    val users: UsersApi by lazy { retrofit.create(UsersApi::class.java) }
    val upload: UploadApi by lazy { retrofit.create(UploadApi::class.java) }
}

/** Resolves a relative /uploads/... URL from the server against the API host. */
fun resolveMediaUrl(url: String?): String? {
    if (url.isNullOrEmpty()) return null
    return if (url.startsWith("http")) url else BASE_URL.trimEnd('/') + url
}
