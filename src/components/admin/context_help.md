# `src/components/admin/`

The admin UI lives in a single component. The page files in `src/app/admin/**` are thin shells that mount this.

## Files

- **`AdminPanel.tsx`** — dashboard stats + filterable/sortable list + per-row actions (Copy link, Approve/Reject when pending, Toggle active/inactive, Extend, Reset passcode, Mark reply downloaded, Delete permanently). Reads `ct_csrf` cookie on every mutation.

## Actions cluster

Every row renders these actions conditionally:
- **Copy link** — always visible. Writes `https://host/c/{shortCode}` to clipboard.
- **Approve / Reject** — only when `status === 'pending'`.
- **Activate / Deactivate** — only when `status ∈ {'active', 'inactive'}`. Absent for pending (use Approve) and deleted (admin can't recover).
- **Extend** — always visible on non-deleted rows. Prompts for hours, bumps `expires_at`, may flip inactive → active (with `times_reactivated++`).
- **Reset PC** — admin passcode reset. Confirms, hits the reset endpoint, alerts the new plaintext (returned only once).
- **Reply ✓** — appears when `expression_reply` exists and `expression_reply_downloaded` is false.
- **Delete** — permanent. Requires typing the short_code to confirm.

## Why `alert()` and `prompt()`?

Native `alert`/`prompt` feels primitive, but for an internal admin panel they avoid the complexity of a modal system while being accessible out-of-the-box (screen readers handle them). A proper styled modal system is a reasonable follow-up when we add more complex flows.

## CSRF

Every mutation reads the `ct_csrf` cookie (non-HTTP-only, set at admin login) and echoes it as the `x-csrf-token` header. The middleware rejects mutations without a matching token (`403 CSRF_FAILED`). This is a double-submit token — `SameSite=Lax` already blocks cross-site POSTs, the header check blocks same-site XSS or bookmarklet abuse.
