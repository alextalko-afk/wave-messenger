package com.wave.app.network

import com.wave.app.model.AuthResponse
import com.wave.app.model.Conversation
import com.wave.app.model.Message
import com.wave.app.model.UploadResponse
import com.wave.app.model.User
import okhttp3.MultipartBody
import retrofit2.http.Body
import retrofit2.http.GET
import retrofit2.http.Multipart
import retrofit2.http.POST
import retrofit2.http.Part
import retrofit2.http.Path
import retrofit2.http.Query

data class LoginBody(val username: String, val password: String)
data class RegisterBody(val username: String, val password: String, val displayName: String)
data class DirectBody(val userId: String)
data class ConversationsResponse(val conversations: List<Conversation>)
data class MessagesResponse(val messages: List<Message>)
data class ConversationResponse(val conversation: Conversation)
data class UsersResponse(val users: List<User>)

interface AuthApi {
    @POST("api/auth/login")
    suspend fun login(@Body body: LoginBody): AuthResponse

    @POST("api/auth/register")
    suspend fun register(@Body body: RegisterBody): AuthResponse
}

interface ConversationsApi {
    @GET("api/conversations")
    suspend fun list(): ConversationsResponse

    @GET("api/conversations/{id}/messages")
    suspend fun messages(@Path("id") id: String, @Query("before") before: Long? = null): MessagesResponse

    @POST("api/conversations/{id}/read")
    suspend fun markRead(@Path("id") id: String)

    @POST("api/conversations/direct")
    suspend fun openDirect(@Body body: DirectBody): ConversationResponse
}

interface UsersApi {
    @GET("api/users/search")
    suspend fun search(@Query("q") query: String): UsersResponse
}

interface UploadApi {
    @Multipart
    @POST("api/upload")
    suspend fun upload(@Part file: MultipartBody.Part): UploadResponse
}
