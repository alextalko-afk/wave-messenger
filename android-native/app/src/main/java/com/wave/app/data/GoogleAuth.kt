package com.wave.app.data

import android.content.Context
import androidx.credentials.CredentialManager
import androidx.credentials.CustomCredential
import androidx.credentials.GetCredentialRequest
import androidx.credentials.exceptions.GetCredentialException
import com.google.android.libraries.identity.googleid.GetGoogleIdOption
import com.google.android.libraries.identity.googleid.GoogleIdTokenCredential
import com.google.android.libraries.identity.googleid.GoogleIdTokenParsingException
import com.wave.app.R

sealed class GoogleSignInResult {
    data class Success(val idToken: String) : GoogleSignInResult()
    data class Failure(val message: String) : GoogleSignInResult()
    object Cancelled : GoogleSignInResult()
}

/**
 * Requests a Google ID token via Credential Manager. filterByAuthorizedAccounts=true
 * only offers accounts already used with this app; callers should retry with
 * false (show every Google account on the device) if that comes back empty.
 */
suspend fun requestGoogleIdToken(context: Context, filterByAuthorizedAccounts: Boolean): GoogleSignInResult {
    val option = GetGoogleIdOption.Builder()
        .setFilterByAuthorizedAccounts(filterByAuthorizedAccounts)
        .setServerClientId(context.getString(R.string.google_web_client_id))
        .setAutoSelectEnabled(false)
        .build()

    val request = GetCredentialRequest.Builder().addCredentialOption(option).build()

    return try {
        val response = CredentialManager.create(context).getCredential(context, request)
        val credential = response.credential
        if (credential is CustomCredential && credential.type == GoogleIdTokenCredential.TYPE_GOOGLE_ID_TOKEN_CREDENTIAL) {
            val googleIdTokenCredential = GoogleIdTokenCredential.createFrom(credential.data)
            GoogleSignInResult.Success(googleIdTokenCredential.idToken)
        } else {
            GoogleSignInResult.Failure("Неожиданный тип credential")
        }
    } catch (e: GoogleIdTokenParsingException) {
        GoogleSignInResult.Failure("Не удалось разобрать токен Google")
    } catch (e: GetCredentialException) {
        if (e.type == "android.credentials.GetCredentialException.TYPE_USER_CANCELED") {
            GoogleSignInResult.Cancelled
        } else {
            GoogleSignInResult.Failure(e.message ?: "Не удалось войти через Google")
        }
    }
}
