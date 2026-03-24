const MAX_DIMENSION = 1024;
const JPEG_QUALITY = 0.80;
const MAX_FILE_SIZE = 500_000;

export async function preprocessImage(file: File | Blob): Promise<Blob> {
  const bitmap = await createImageBitmap(file);

  let { width, height } = bitmap;
  if (width > MAX_DIMENSION || height > MAX_DIMENSION) {
    const scale = MAX_DIMENSION / Math.max(width, height);
    width = Math.round(width * scale);
    height = Math.round(height * scale);
  }

  const canvas = new OffscreenCanvas(width, height);
  const ctx = canvas.getContext("2d")!;
  ctx.drawImage(bitmap, 0, 0, width, height);
  bitmap.close();

  const blob = await canvas.convertToBlob({
    type: "image/jpeg",
    quality: JPEG_QUALITY,
  });

  if (blob.size > MAX_FILE_SIZE) {
    return canvas.convertToBlob({
      type: "image/jpeg",
      quality: 0.60,
    });
  }

  return blob;
}
