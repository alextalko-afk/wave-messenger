package com.wave.app.data

import android.content.Context
import android.net.Uri
import android.provider.OpenableColumns
import okhttp3.MediaType.Companion.toMediaTypeOrNull
import okhttp3.MultipartBody
import okhttp3.RequestBody.Companion.asRequestBody
import java.io.File

/** Reads a picked content Uri into a temp file and wraps it as a multipart part for the /api/upload endpoint. */
fun uriToMultipart(context: Context, uri: Uri): MultipartBody.Part {
    val contentResolver = context.contentResolver
    val mimeType = contentResolver.getType(uri) ?: "application/octet-stream"

    var fileName = "upload"
    contentResolver.query(uri, null, null, null, null)?.use { cursor ->
        val nameIndex = cursor.getColumnIndex(OpenableColumns.DISPLAY_NAME)
        if (cursor.moveToFirst() && nameIndex >= 0) fileName = cursor.getString(nameIndex)
    }

    val tempFile = File.createTempFile("upload_", "_$fileName", context.cacheDir)
    contentResolver.openInputStream(uri)?.use { input ->
        tempFile.outputStream().use { output -> input.copyTo(output) }
    }

    val requestBody = tempFile.asRequestBody(mimeType.toMediaTypeOrNull())
    return MultipartBody.Part.createFormData("file", fileName, requestBody)
}
