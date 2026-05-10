# `src/lib/validation/` — Zod schemas

Every API request body is validated against a schema in this folder before any DB write. Every schema pulls its limits, enums, and regexes from `@/lib/constants` so constraint changes ripple through once.

## Files

| File | Schemas | Consumed by |
|---|---|---|
| `shared.ts` | `PhotoSchema`, `QuizQuestionSchema`, `ThemeSchema`, `RelationshipSchema`, `PasscodeSchema` | All other schemas. |
| `createCelebration.ts` | `CreateCelebrationSchema` (discriminated union on `type`, superRefined for theme-by-type and 15-min-minimum) | `POST /api/celebrations`. |
| `unlock.ts` | `UnlockSchema`, `ReplySchema` | `POST /.../unlock`, `POST /.../reply`. |
| `adminQuery.ts` | `AdminListQuerySchema` (filters + search + sort + pagination) | `GET /api/admin/celebrations`. |
| `admin.ts` | `ApproveSchema`, `RejectSchema`, `ResetPasscodeSchema`, `PatchCelebrationSchema`, `PermanentDeleteSchema`, `LoginSchema`, `SettingsPatchSchema` | All admin mutating routes. |

## Why discriminated unions

`CreateCelebrationSchema` uses `z.discriminatedUnion('type', [...])` so the type-narrowing is exhaustive: if `type='birthday'`, the compiler requires `hero_text`, `reasons`, `quiz_questions`, `final_message`. If `type='expression'`, it requires the expression set. This makes the API impossible to misuse from a typed client.

## Why superRefine

Cross-field rules like "theme must be in the allowed set for type" and "activate_at must be at least 15 min in the future" aren't expressible with per-field constraints. `superRefine` lets us add issues with custom codes (`THEME_NOT_ALLOWED_FOR_TYPE`, `ACTIVATE_AT_TOO_SOON`) that the route handler translates into meaningful HTTP status codes.

## Mirroring in the UI

The creator wizard does lightweight per-step validation (`CreatorWizard.tsx` → `validateStep()`) and the server re-validates every payload with these schemas on submit. The client-side validation is UX polish; the server-side is the source of truth.
