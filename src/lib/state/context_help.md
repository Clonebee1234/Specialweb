# `src/lib/state/`

Client-side state containers. All Zustand-based.

## Files

- **`useCreatorFormStore.ts`** — the creator form state. 6 slices (occasion/type, basics, theme, content, timing, media) plus submit result. Persisted to `sessionStorage` under key `ct_creator_v1`.

## Why Zustand?

- **Selector-based subscription.** Each step of the wizard subscribes only to its own slice, so typing in step 2 doesn't re-render step 4.
- **Tiny API.** `create()` + the `persist` middleware is two lines of setup.
- **No provider tree.** `useCreatorFormStore()` works anywhere in the tree.

## Why sessionStorage (not localStorage)?

- Scoped to one tab. Two tabs drafting different celebrations don't collide.
- Cleared when the tab closes. Someone borrowing a laptop doesn't leave behind a half-completed "to my partner" surprise.

## What isn't persisted

Raw `File` objects. They're not serializable to JSON. If a user reloads mid-upload, the uploaded public URLs survive; any not-yet-uploaded file needs reselection. That's a deliberate tradeoff for privacy and simplicity.
