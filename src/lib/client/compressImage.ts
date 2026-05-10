/**
 * Client-side image compression.
 *
 * Targets ≤1 MB WebP output (Req 7.1). We try three quality levels, each time
 * drawing the source onto a canvas and re-encoding. If we still can't get
 * under 1 MB after the third attempt, we surface the "image is too large"
 * error (Req 7.2).
 */

const MAX_BYTES = 1_048_576;
const QUALITY_LEVELS = [0.85, 0.7, 0.55];
const MAX_DIMENSION = 2000;

export class ImageTooLargeError extends Error {
  constructor() {
    super('This image is too large. Please choose a smaller photo.');
    this.name = 'ImageTooLargeError';
  }
}

export async function compressImageToWebp(file: File): Promise<Blob> {
  const bitmap = await createImageBitmap(file);
  try {
    const { width, height } = scale(bitmap.width, bitmap.height);
    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext('2d');
    if (!ctx) throw new Error('2D context unavailable');
    ctx.drawImage(bitmap, 0, 0, width, height);

    for (const q of QUALITY_LEVELS) {
      const blob: Blob | null = await new Promise((resolve) =>
        canvas.toBlob(resolve, 'image/webp', q),
      );
      if (blob && blob.size <= MAX_BYTES) return blob;
    }
    throw new ImageTooLargeError();
  } finally {
    bitmap.close?.();
  }
}

function scale(w: number, h: number): { width: number; height: number } {
  const max = Math.max(w, h);
  if (max <= MAX_DIMENSION) return { width: w, height: h };
  const ratio = MAX_DIMENSION / max;
  return { width: Math.round(w * ratio), height: Math.round(h * ratio) };
}
