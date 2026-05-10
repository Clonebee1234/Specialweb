# `src/components/form/`

The creator form — a guided wizard that collects content, uploads media, and submits to `/api/celebrations`.

## Files

- **`CreatorWizard.tsx`** — 6-step wizard hosting all step sub-components, photo/audio uploaders, and submission. Single file so the steps can share validation, store access, and upload orchestration without prop-drilling.
- **`ConfirmationScreen.tsx`** — post-submission screen with the "Awaiting approval" banner, shareable link + passcode (copy buttons), Instagram contact button (env-driven), and the pre-filled copyable message template.

## Steps

| # | Step | Validates |
|---|---|---|
| 1 | Occasion (birthday vs expression) | `type` set |
| 2 | Basics (recipient, creator, relationship) | All three non-empty; relationship in enum |
| 3 | Theme | `theme` in per-type allowlist |
| 4 | Content (branches by type) | All character-limit checks and count ranges |
| 5 | Passcode + activation time | Regex, confirm match, ≥ 15 min in future |
| 6 | Preview | Summary; "Generate My Link" submits |

## State

Lives in `@/lib/state/useCreatorFormStore` (Zustand with sessionStorage `persist`). Persistence key: `ct_creator_v1`. Raw `File` objects are NOT persisted — the store keeps only the uploaded public URLs. If the user reloads, their uploaded photos survive; unselected ones need reselection.

## Upload flow

1. User selects a file.
2. Client compresses to WebP ≤ 1 MB (3 quality passes at 0.85/0.7/0.55). Max dimension 2000 px.
3. `POST /api/upload/photo` → server returns a short-lived signed upload URL + public URL.
4. Client `PUT`s bytes directly to Supabase Storage (no Vercel function in the data path).
5. Public URL goes into the Zustand store under `media.photos[i].url` with a `tmp_{draftToken}/photo_{N}.webp` path.
6. On final submit, the server moves every file from `tmp_*` → `{shortCode}` and rewrites URLs to point at the final location.

## Why a monolithic wizard?

Ten-file version:
- Each step owns a slice of the shared store, so every step imports the same 3-4 store hooks.
- Validation helpers are cross-cutting (e.g. photo count range depends on `type`), so they'd live in a shared file anyway.
- Navigation (`goNext`, `goBack`, `submit`) is top-level state.

In this shape, the file is ~600 lines of straightforward UI code with no indirection. Splitting it would trade simplicity for no real gain.
