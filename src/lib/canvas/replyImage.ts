/**
 * Pure PNG renderer for the expression-reply image.
 *
 * Same inputs → identical PNG bytes (Property 15, Req 27.10). To hold that
 * invariant we:
 *   - Size the canvas explicitly (1080 × 1350 = 4:5, Instagram-friendly).
 *   - Use only fixed theme palettes and string constants; never reference
 *     `Date.now()`, `Math.random()`, or any external time source.
 *   - Call the single low-level primitive each platform offers for PNG
 *     encoding (`canvas.toBlob('image/png')` in the browser, `encode('png')`
 *     from `@napi-rs/canvas` in Node).
 *
 * The adapter shim at the top lets us run the same logic in both the browser
 * and Node (for tests) without pulling `@napi-rs/canvas` into the client bundle.
 */

export type ReplyImageTheme = 'midnight-letters' | 'soft-bloom' | 'warm-sunset';

export type ReplyImageInput = {
  replyText: string;
  recipientFirstName: string;
  dateIso: string;
  theme: ReplyImageTheme;
};

const WIDTH = 1080;
const HEIGHT = 1350;
const PADDING = 96;
const MAX_REPLY_CHARS = 200;

type Palette = {
  bgA: string;
  bgB: string;
  accent: string;
  text: string;
  muted: string;
  handwriting: string;
};

const PALETTES: Record<ReplyImageTheme, Palette> = {
  'midnight-letters': {
    bgA: '#0a0a0f',
    bgB: '#141428',
    accent: '#e8c978',
    text: '#f5f2ea',
    muted: 'rgba(245, 242, 234, 0.72)',
    handwriting: '#f5f2ea',
  },
  'soft-bloom': {
    bgA: '#1a0a10',
    bgB: '#3a1a28',
    accent: '#f3b0c3',
    text: '#fdeef0',
    muted: 'rgba(253, 238, 240, 0.78)',
    handwriting: '#fdeef0',
  },
  'warm-sunset': {
    bgA: '#1a0f08',
    bgB: '#3a1f14',
    accent: '#f2a679',
    text: '#fef0dc',
    muted: 'rgba(254, 240, 220, 0.78)',
    handwriting: '#fef0dc',
  },
};

export interface CanvasAdapter {
  createCanvas(width: number, height: number): {
    ctx: CanvasRenderingContext2D | unknown;
    toPng(): Promise<Uint8Array>;
  };
}

/**
 * Platform-independent rendering. The adapter provides the canvas + PNG encoder;
 * this function draws the same shapes the same way every time.
 */
export async function renderReplyImage(
  input: ReplyImageInput,
  adapter: CanvasAdapter,
): Promise<Uint8Array> {
  const palette = PALETTES[input.theme];
  const { ctx, toPng } = adapter.createCanvas(WIDTH, HEIGHT);

  // `ctx` is intentionally typed loosely (`unknown`) to keep this module
  // independent of whether we're in DOM or Node. Every platform exposes the
  // same set of method names we need.
  const g = ctx as CanvasRenderingContext2D;

  // Background gradient
  const gradient = g.createLinearGradient(0, 0, 0, HEIGHT);
  gradient.addColorStop(0, palette.bgA);
  gradient.addColorStop(1, palette.bgB);
  g.fillStyle = gradient;
  g.fillRect(0, 0, WIDTH, HEIGHT);

  // Decorative border
  g.strokeStyle = palette.accent;
  g.lineWidth = 4;
  g.strokeRect(PADDING / 2, PADDING / 2, WIDTH - PADDING, HEIGHT - PADDING);

  // Recipient name header
  g.fillStyle = palette.accent;
  g.font = '500 36px serif';
  g.textAlign = 'center';
  g.textBaseline = 'top';
  g.fillText(`A reply from ${input.recipientFirstName}`, WIDTH / 2, PADDING);

  // Main reply text, wrapped
  g.fillStyle = palette.handwriting;
  g.font = '500 46px serif';
  g.textAlign = 'center';
  g.textBaseline = 'middle';

  const maxTextWidth = WIDTH - PADDING * 2;
  const safeReply = input.replyText.slice(0, MAX_REPLY_CHARS);
  const lines = wrapText(g, safeReply, maxTextWidth);
  const lineHeight = 62;
  const totalHeight = lines.length * lineHeight;
  const startY = HEIGHT / 2 - totalHeight / 2 + lineHeight / 2;
  for (let i = 0; i < lines.length; i++) {
    // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
    g.fillText(lines[i]!, WIDTH / 2, startY + i * lineHeight);
  }

  // Footer: signature + date
  g.fillStyle = palette.muted;
  g.font = '400 28px sans-serif';
  g.textAlign = 'center';
  g.textBaseline = 'bottom';
  const dateStr = formatDate(input.dateIso);
  g.fillText(`${input.recipientFirstName} · ${dateStr}`, WIDTH / 2, HEIGHT - PADDING);

  return toPng();
}

/**
 * Greedy word-wrap. Not unicode-aware; the reply text is capped at 200 chars
 * and we accept potentially-clipped trailing runs rather than re-implementing
 * a full grapheme-aware wrapper.
 */
function wrapText(
  ctx: CanvasRenderingContext2D,
  text: string,
  maxWidth: number,
): string[] {
  const words = text.split(/\s+/).filter((w) => w.length > 0);
  const lines: string[] = [];
  let current = '';
  for (const word of words) {
    const candidate = current ? `${current} ${word}` : word;
    const width = ctx.measureText(candidate).width;
    if (width > maxWidth && current) {
      lines.push(current);
      current = word;
    } else {
      current = candidate;
    }
  }
  if (current) lines.push(current);
  return lines;
}

/**
 * Format the date deterministically. We avoid `Intl.DateTimeFormat` to keep
 * renders byte-identical across runtimes where locale data may differ.
 */
function formatDate(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  const months = [
    'Jan',
    'Feb',
    'Mar',
    'Apr',
    'May',
    'Jun',
    'Jul',
    'Aug',
    'Sep',
    'Oct',
    'Nov',
    'Dec',
  ];
  const day = d.getUTCDate();
  // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
  const month = months[d.getUTCMonth()]!;
  const year = d.getUTCFullYear();
  return `${month} ${day}, ${year}`;
}
