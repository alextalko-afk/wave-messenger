package com.wave.app.network

import com.wave.app.model.AuthResponse
import com.wave.app.model.Conversation
import com.wave.app.model.ConversationStats
import com.wave.app.model.MediaItem
import com.wave.app.model.Message
import com.wave.app.model.SharedGroup
import com.wave.app.model.UploadResponse
import com.wave.app.model.User
import okhttp3.MultipartBody
import retrofit2.http.Body
import retrofit2.http.DELETE
import retrofit2.http.GET
import retrofit2.http.Multipart
import retrofit2.http.POST
import retrofit2.http.PUT
import retrofit2.http.Part
import retrofit2.http.Path
import retrofit2.http.Query

data class LoginBody(val username: String, val password: String)
data class RegisterBody(val username: String, val password: String, val displayName: String)
data class DirectBody(val userId: String)
data class GroupBody(val name: String, val memberIds: List<String>)
data class PinBody(val pinned: Boolean)
data class MuteBody(val muted: Boolean)
data class MarkUnreadBody(val unread: Boolean)
data class UpdateMeBody(val displayName: String? = null, val bio: String? = null, val username: String? = null)
data class ChangePasswordBody(val currentPassword: String, val newPassword: String)
data class ConversationsResponse(val conversations: List<Conversation>)
data class MessagesResponse(val messages: List<Message>)
data class ConversationResponse(val conversation: Conversation)
data class UsersResponse(val users: List<User>)
data class MediaResponse(val items: List<MediaItem>)
data class SharedGroupsResponse(val groups: List<SharedGroup>)
data class MeResponse(val user: User)
data class OkResponse(val ok: Boolean = true)

interface AuthApi {
    @POST("api/auth/login")
    suspend fun login(@Body body: LoginBody): AuthResponse

    @POST("api/auth/register")
    suspend fun register(@Body body: RegisterBody): AuthResponse

    @GET("api/auth/me")
    suspend fun me(): MeResponse

    @PUT("api/auth/me")
    suspend fun updateMe(@Body body: UpdateMeBody): MeResponse

    @POST("api/auth/change-password")
    suspend fun changePassword(@Body body: ChangePasswordBody): OkResponse
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

    @POST("api/conversations/group")
    suspend fun createGroup(@Body body: GroupBody): ConversationResponse

    @GET("api/conversations/{id}/stats")
    suspend fun stats(@Path("id") id: String): ConversationStats

    @GET("api/conversations/{id}/media")
    suspend fun media(@Path("id") id: String, @Query("type") type: String): MediaResponse

    @GET("api/conversations/{id}/shared-groups")
    suspend fun sharedGroups(@Path("id") id: String): SharedGroupsResponse

    @POST("api/conversations/{id}/pin")
    suspend fun pin(@Path("id") id: String, @Body body: PinBody): OkResponse

    @POST("api/conversations/{id}/mute")
    suspend fun mute(@Path("id") id: String, @Body body: MuteBody): OkResponse

    @POST("api/conversations/{id}/mark-unread")
    suspend fun markUnread(@Path("id") id: String, @Body body: MarkUnreadBody): OkResponse

    @POST("api/conversations/{id}/clear")
    suspend fun clear(@Path("id") id: String): OkResponse

    @DELETE("api/conversations/{id}")
    suspend fun delete(@Path("id") id: String): OkResponse
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
