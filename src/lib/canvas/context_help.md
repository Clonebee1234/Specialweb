# `src/lib/canvas/`

Pure functions for rendering the expression-reply image as a PNG.

## Files

- **`replyImage.ts`** — `renderReplyImage({ replyText, recipientFirstName, dateIso, theme }, adapter) -> Uint8Array`. Deterministic: same inputs → byte-identical PNG. Size is fixed at 1080×1350 (4:5 Instagram-friendly).
- **`adapter.browser.ts`** — `browserCanvasAdapter` using `HTMLCanvasElement` + `toBlob('image/png')`.
- **`adapter.node.ts`** — `nodeCanvasAdapter` using `@napi-rs/canvas` + `canvas.encode('png')`. Used by admin-side regeneration and by property tests.

## Determinism guarantees

- No `Date.now()`, no `Math.random()`.
- No locale-dependent APIs (`Intl.DateTimeFormat` is avoided; we format the date with a fixed month array).
- Canvas size, padding, font sizes, and line heights are all module constants.
- PNG encoding is handled by the platform's native PNG encoder; both browsers and `@napi-rs/canvas` produce identical chunk orderings given identical pixel buffers.

Property 15 (byte-identical PNG across invocations) is the correctness target. The starter test `tests/properties/passcode.pbt.ts` covers the scrypt verify round-trip; a future `reply-image.pbt.ts` will assert SHA-256 equality across repeated renders.
