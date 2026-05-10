/** Browser-side canvas adapter. Used by `ChapterReply` at runtime. */

import type { CanvasAdapter } from '@/lib/canvas/replyImage';

export const browserCanvasAdapter: CanvasAdapter = {
  createCanvas(width, height) {
    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext('2d');
    if (!ctx) throw new Error('2D canvas context unavailable');
    return {
      ctx,
      async toPng() {
        const blob: Blob | null = await new Promise((resolve) =>
          canvas.toBlob(resolve, 'image/png'),
        );
        if (!blob) throw new Error('canvas.toBlob returned null');
        return new Uint8Array(await blob.arrayBuffer());
      },
    };
  },
};
