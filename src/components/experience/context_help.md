# `src/components/experience/`

The recipient-facing experience mounted at `/c/[shortCode]` after the lifecycle gate allows access.

## Files

- **`RecipientExperience.tsx`** — passcode entry + birthday/expression content renderers + audio player + expression reply flow with download-as-image AND send-to-creator options.

## Rendering strategy

The page at `/app/c/[shortCode]/page.tsx` is a **Server Component**. It:
1. Fetches the row server-side.
2. Runs `gate()` from `@/lib/lifecycle`.
3. Returns a static gate screen for `pending`, `pre_activation`, `ended`, or `not_found`.
4. Only for `active` does it mount this Client component.

That means pending/ended celebrations never download the experience bundle. Their gate screens are tiny static pages.

## Passcode entry

- 4 input boxes, `inputMode="numeric"`, `autoComplete="one-time-code"`.
- Auto-focuses the next box on digit entry, backspaces focus the previous.
- On the 4th digit, auto-submits the passcode to `/api/celebrations/:sc/unlock`.
- 401 → reset inputs, focus first, show friendly message. 429 → "Too many attempts." 200 → fetch the content payload.

## Reply canvas

`ChapterReply` renders `renderReplyImage()` from `@/lib/canvas/replyImage` using `browserCanvasAdapter`. Users can:
- **Download as image** — runs locally, creates a Blob URL, triggers a browser download. No server round-trip.
- **Send to creator** — POSTs to `/api/celebrations/:sc/reply`. On success, shows the "reply saved" state.

Both options respect the 200-character limit (shown as a counter).

## Follow-up: cinematic chapters

The current renderer is a clean functional layout. The full cinematic birthday/expression chapters (GSAP SplitText, ScrollTrigger parallax, canvas-confetti finale, Ken Burns photos, typewriter effects) are staged for a follow-up commit. The payload shape this component consumes is identical to what the cinematic chapters need, so that work is a UI swap — no backend changes.
