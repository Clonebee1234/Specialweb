# `src/app/` — Next.js App Router routes

Every folder maps to a URL. Folders with `page.tsx` produce a page route; folders with `route.ts` under `api/` produce an API handler.

## Routes

| Path | Kind | Purpose |
|---|---|---|
| `/` | page (static) | Landing page with two occasion CTAs. |
| `/create` | page (client wizard) | Multi-step creator form. Hydrates Zustand store on mount. |
| `/create/confirmation` | page (client) | Post-submission "Awaiting approval" screen with Instagram contact. |
| `/c/[shortCode]` | page (server → client) | Recipient experience. Server runs the lifecycle gate; only active celebrations mount the client bundle. |
| `/admin/login` | page | Admin password form. |
| `/admin` | page | Dashboard + filter/sort list + per-row actions. |
| `/admin/pending` | page | Dedicated pending-approval queue, sorted by activate_at. |
| `/admin/celebrations/[id]` | page | Detail view with approve/reject/extend/reset/delete, photo gallery, reply canvas. |
| `/admin/settings` | page | Default window hours, maintenance mode, password change. |

## API routes

All under `/api/**`. Every handler wraps its logic in `apiHandler()` from `@/lib/api/handler` which:
- assigns/echoes `x-request-id`,
- runs the body in an AsyncLocalStorage context so the logger auto-tags,
- converts thrown `HttpError` into the standard `{ error: { code, message, details? } }` envelope.

### Public

- `POST /api/celebrations` — create a celebration (validate, hash passcode, generate short code, move media, insert row).
- `GET /api/celebrations/[shortCode]/status` — lifecycle gate for the client shell.
- `POST /api/celebrations/[shortCode]/unlock` — passcode submission with rate limit + cookie issue + atomic view-count bump.
- `GET /api/celebrations/[shortCode]/content` — returns the public payload iff unlock cookie is valid + current version.
- `POST /api/celebrations/[shortCode]/reply` — expression-reply capture. Never logged.
- `POST /api/upload/photo`, `POST /api/upload/audio` — issue Supabase Storage signed upload URLs.

### Admin

- `POST /api/admin/login`, `POST /api/admin/logout` — session cookie lifecycle.
- `GET /api/admin/stats`, `GET /api/admin/celebrations` — dashboard + list.
- `GET|PATCH|DELETE /api/admin/celebrations/[id]` — detail read, edit/toggle/extend, permanent delete.
- `POST /api/admin/celebrations/[id]/approve` — idempotent; 409 if the 21h window already elapsed.
- `POST /api/admin/celebrations/[id]/reject` — idempotent; 409 on active rows.
- `POST /api/admin/celebrations/[id]/reset-passcode` — random 4-digit + bump `passcode_version`.
- `DELETE /api/admin/celebrations/[id]/photos/[idx]` — per-photo Storage+JSONB removal.
- `POST /api/admin/celebrations/[id]/reply/mark-downloaded` — flag the reply.
- `GET|PATCH /api/admin/settings` — settings read/write + password change.

### Cron

- `POST /api/cron/expire` — idempotent `status=active AND expires_at<now → inactive` sweep. Requires `x-cron-secret`.

## Conventions

- **Dynamic params are typed explicitly** via the generic on `apiHandler<{ paramName: string }>(...)`. This survives `noUncheckedIndexedAccess`.
- **Errors are never leaked verbatim.** Unexpected exceptions become `500 INTERNAL_ERROR` with a generic message; stack traces go to the logger only.
- **All mutations admin-side require the CSRF token.** The middleware rejects `POST/PATCH/DELETE /api/admin/**` without a matching `x-csrf-token` header.
