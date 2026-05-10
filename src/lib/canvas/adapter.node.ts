/**
 * Node canvas adapter using `@napi-rs/canvas`. Used in tests to verify the
 * determinism property without a browser.
 *
 * NEVER imported from a Client Component — the native bindings are not
 * browser-safe. Server-side consumers are fine (admin can regenerate reply
 * images from the admin panel via the server API).
 */

import { createCanvas as createNodeCanvas } from '@napi-rs/canvas';
import type { CanvasAdapter } from '@/lib/canvas/replyImage';

export const nodeCanvasAdapter: CanvasAdapter = {
  createCanvas(width, height) {
    const canvas = createNodeCanvas(width, height);
    const ctx = canvas.getContext('2d');
    return {
      ctx: ctx as unknown,
      async toPng() {
        const buffer = await canvas.encode('png');
        return new Uint8Array(buffer);
      },
    };
  },
};
