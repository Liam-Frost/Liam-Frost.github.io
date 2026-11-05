/** Raster pixels only reach the preview URL, never the selected SVG/file's original markup. */
export async function createIconPreview(file: Blob): Promise<string> {
  const bitmap = await createImageBitmap(file);
  try {
    if (!bitmap.width || !bitmap.height || bitmap.width * bitmap.height > 25_000_000)
      throw new Error("Invalid icon dimensions");
    const scale = Math.min(1, 256 / Math.max(bitmap.width, bitmap.height));
    const canvas = document.createElement("canvas");
    canvas.width = Math.max(1, Math.round(bitmap.width * scale));
    canvas.height = Math.max(1, Math.round(bitmap.height * scale));
    const context = canvas.getContext("2d");
    if (!context) throw new Error("Image preview unavailable");
    context.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
    const png = await new Promise<Blob>((resolve, reject) => {
      canvas.toBlob(
        (blob) => (blob ? resolve(blob) : reject(new Error("Image preview unavailable"))),
        "image/png"
      );
    });
    return URL.createObjectURL(png);
  } finally {
    bitmap.close();
  }
}
