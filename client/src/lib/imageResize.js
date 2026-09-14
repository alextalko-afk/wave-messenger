/** Downscales an image file to fit within maxSize and re-encodes it as JPEG, so a
 * multi-megapixel photo doesn't get uploaded at full resolution just to be shown
 * in a small circular avatar. Falls back to the original file if anything fails. */
export async function resizeImageFile(file, maxSize = 512, quality = 0.85) {
  try {
    const bitmap = await createImageBitmap(file);
    const scale = Math.min(1, maxSize / Math.max(bitmap.width, bitmap.height));
    const width = Math.round(bitmap.width * scale);
    const height = Math.round(bitmap.height * scale);

    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext('2d');
    ctx.drawImage(bitmap, 0, 0, width, height);

    const blob = await new Promise((resolve) => canvas.toBlob(resolve, 'image/jpeg', quality));
    if (!blob) return file;
    return new File([blob], 'avatar.jpg', { type: 'image/jpeg' });
  } catch {
    return file;
  }
}
