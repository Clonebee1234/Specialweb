# `src/components/` — React components grouped by surface

Components are split by the surface they belong to. Cross-surface primitives would live in `ui/` but we've deliberately not created that yet — the three surfaces don't share interactive UI.

## Folders

### `form/` — creator flow

- **`CreatorWizard.tsx`** — single-file wizard (~600 lines). Houses all 6 steps + the photo/audio uploaders + validation. Reads/writes the Zustand store in `@/lib/state/useCreatorFormStore`.
- **`ConfirmationScreen.tsx`** — "Awaiting approval" banner + Instagram contact + pre-filled copy-to-clipboard message template.

**Why one big file?** The steps share tons of state and validation logic. Splitting into ten component files adds import noise without real clarity. Each step is a small local sub-component.

### `experience/` — recipient flow

- **`RecipientExperience.tsx`** — passcode entry + functional content renderers for birthday and expression. The full cinematic chapters (GSAP SplitText, ScrollTrigger parallax, canvas-confetti finale) are a follow-up; the payload shape is already correct so those chapters drop in without changing the backend.

### `admin/` — admin panel

- **`AdminPanel.tsx`** — dashboard + searchable/filterable/sortable list + per-row actions cluster (copy link, approve, reject, toggle, extend, reset passcode, mark reply downloaded, permanent delete).

## Conventions

- **Client components declare `'use client'` at the top.** The recipient experience + admin panel + creator wizard are all Client Components; the page shells that host them are Server Components.
- **CSRF token is read from `ct_csrf` cookie** (set by admin login) and sent on every mutating admin call as `x-csrf-token`.
- **No network calls from Server Components.** All client-driven fetches live inside the Client Component tree so SSR doesn't accidentally block on API round-trips.
