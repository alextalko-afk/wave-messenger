package com.wave.app.data

import android.content.Context
import android.graphics.Bitmap
import android.graphics.BitmapFactory
import android.net.Uri
import android.provider.OpenableColumns
import okhttp3.MediaType.Companion.toMediaTypeOrNull
import okhttp3.MultipartBody
import okhttp3.RequestBody.Companion.asRequestBody
import java.io.File
import java.io.FileOutputStream

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

/** Downscales a picked image to fit within maxDimension and re-encodes it as JPEG,
 * so a multi-megapixel photo doesn't get uploaded at full resolution just to be
 * shown in a small circular avatar. Falls back to the original file if decoding
 * fails (e.g. the picked file isn't actually a bitmap-decodable image). */
fun uriToResizedAvatarMultipart(context: Context, uri: Uri, maxDimension: Int = 512, quality: Int = 85): MultipartBody.Part {
    val bitmap = context.contentResolver.openInputStream(uri)?.use { BitmapFactory.decodeStream(it) }
        ?: return uriToMultipart(context, uri)

    val scale = minOf(1f, maxDimension.toFloat() / maxOf(bitmap.width, bitmap.height))
    val scaled = if (scale < 1f) {
        Bitmap.createScaledBitmap(bitmap, (bitmap.width * scale).toInt(), (bitmap.height * scale).toInt(), true)
    } else {
        bitmap
    }

    val tempFile = File.createTempFile("avatar_", ".jpg", context.cacheDir)
    FileOutputStream(tempFile).use { out -> scaled.compress(Bitmap.CompressFormat.JPEG, quality, out) }

    val requestBody = tempFile.asRequestBody("image/jpeg".toMediaTypeOrNull())
    return MultipartBody.Part.createFormData("file", "avatar.jpg", requestBody)
}
