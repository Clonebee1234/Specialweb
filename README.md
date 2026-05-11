# CelebrateThem

Passcode-protected, cinematic surprise experiences. A creator fills a guided form, pays, an admin approves, and the recipient opens a unique link at the scheduled time to walk through a scroll-driven birthday or soft-expression experience.

This README walks through every step you need — on a new laptop or a fresh deployment — to go from nothing to a live production instance. Each step is short on ceremony and explains **why** briefly, so it doubles as a learning reference.

---

## Table of Contents

1. [What's in the box](#whats-in-the-box)
2. [Prerequisites](#prerequisites)
3. [Clone and install](#clone-and-install)
4. [Supabase setup (database + storage)](#supabase-setup)
5. [Environment variables](#environment-variables)
6. [Run locally](#run-locally)
7. [Project structure](#project-structure)
8. [Common scripts](#common-scripts)
9. [Deploy to Vercel](#deploy-to-vercel)
10. [Post-deploy setup](#post-deploy-setup)
11. [Troubleshooting](#troubleshooting)

---

## What's in the box

- **Next.js 14 App Router** with TypeScript strict mode
- **Supabase** (Postgres + Storage) for data + media
- **Tailwind CSS** with theme-token CSS variables
- **GSAP + ScrollTrigger**, **Framer Motion**, **canvas-confetti** for the recipient experiences
- **Vitest + fast-check** for unit and property-based tests
- **Playwright** for end-to-end tests
- **Upstash Redis** for serverless rate limiting

The full specification lives in `.kiro/specs/celebrate-them/{requirements.md,design.md,tasks.md}` — read those for the exhaustive behavioral contract. This README is just the operator's guide.

---

## Prerequisites

Install these once per laptop. Versions listed are minimums.

| Tool | Version | Why |
|---|---|---|
| Node.js | 18.17+ (LTS 20 recommended) | Runs Next.js dev server, scripts, and tests |
| npm | 10+ | Ships with Node; we use `package-lock.json` |
| Git | any recent | Version control |
| Supabase CLI | 1.180+ | Applies migrations locally and to remote project |
| Docker Desktop | optional | Needed if you want to run Supabase locally via `supabase start` |
| Vercel CLI | optional | Needed only if deploying from your terminal |

Install Supabase CLI:

```bash
# macOS
brew install supabase/tap/supabase
# or cross-platform via npm (works on Windows too)
npm install -g supabase
```

**Why CLI?** Browser-only Supabase setup can't apply SQL migrations in a reproducible way. The CLI reads the files in `supabase/migrations/` and replays them, which is what we need for a repeatable deploy.

### Windows-specific notes

Everything in this project works on Windows, but a few things differ from macOS/Linux:

- **Use Windows Terminal or PowerShell** (not `cmd.exe`) — the npm scripts rely on Unix-ish argument parsing that modern PowerShell handles correctly.
- **Install Node via the official installer** from [nodejs.org](https://nodejs.org/) (pick the LTS; match the version in `package.json` → `engines.node`). Avoid the Windows Store version; it sometimes creates permission issues with `npm install -g`.
- **Git for Windows** ships a bash-compatible shell (Git Bash) that understands the `&&` chains in `package.json` scripts. PowerShell 7+ also handles them. On `cmd.exe`, some compound scripts may fail — just run each command separately.
- **Docker Desktop for Windows** is required if you want to run Supabase locally via `npx supabase start`. Make sure WSL2 integration is enabled in Docker Desktop settings. Without Docker, use the hosted Supabase option (Option A below).
- **Setting env vars on Windows** (PowerShell):
  ```powershell
  $env:COOKIE_SIGNING_SECRET = "..."
  ```
  In `cmd.exe`:
  ```cmd
  set COOKIE_SIGNING_SECRET=...
  ```
  For permanent dev setup, put them in `.env.local` (the Next.js dev server picks them up automatically).
- **Generating secrets on Windows**:
  ```powershell
  # PowerShell
  node -e "console.log(require('crypto').randomBytes(48).toString('base64url'))"
  ```
  The `node -e "..."` command works identically across macOS, Linux, and Windows.
- **Line endings**: the `.editorconfig` forces LF everywhere. If Git for Windows is set to `core.autocrlf=true`, that's fine — CRLF in the working tree, LF on commit. Don't change this per-repo; the global default is correct.

---

## Clone and install

### The one-shot way (recommended)

**macOS / Linux / Git Bash on Windows:**

```bash
git clone <your-repo-url> celebrate-them
cd celebrate-them
npm run setup
```

**Windows PowerShell:**

```powershell
git clone <your-repo-url> celebrate-them
cd celebrate-them
npm run setup:win
```

Either script will:
1. Verify Node 18.17+ is installed
2. Run `npm install` (pulls every package listed in `package.json`)
3. Install Playwright browsers (for the e2e test suite — skip with `SKIP_PLAYWRIGHT=1`)
4. Copy `.env.example` → `.env.local` and fill in freshly-generated `COOKIE_SIGNING_SECRET` value for you
5. Run `typecheck` + the property-based tests to make sure the checkout is healthy

After it finishes, fill in real Supabase credentials in `.env.local` if you want end-to-end flows (otherwise placeholders render the UI but API calls fail).

### The manual way

```bash
git clone <your-repo-url> celebrate-them
cd celebrate-them
npm install
cp .env.example .env.local
# then edit .env.local and fill in values
```

**Why `npm install` before anything else?** Every subsequent script (typecheck, migrate, test) needs the dependency tree.

---

## Supabase setup

You have two options. Pick one.

### Option A — Hosted Supabase (recommended for production)

1. **Create a project** at [supabase.com](https://supabase.com/dashboard). Pick the region closest to your users.
2. **Copy the keys** from Project Settings → API:
   - `Project URL` → becomes `SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_URL`
   - `anon public` → `NEXT_PUBLIC_SUPABASE_ANON_KEY`
   - `service_role` → `SUPABASE_SERVICE_ROLE_KEY` (⚠️ server-only, never commit)
3. **Link the CLI** to your project:

   ```bash
   npx supabase login          # one-time, opens browser
   npx supabase link --project-ref <your-project-ref>
   ```

   The project ref is the subdomain of the Project URL (`https://abcd1234.supabase.co` → `abcd1234`).

4. **Apply the migrations**:

   ```bash
   npm run db:migrate
   # equivalent to: supabase db push
   ```

   This runs every file in `supabase/migrations/` in order:
   - `0001_init.sql` — creates the `celebrations` table with CHECK constraints and indexes
   - `0002_pg_trgm.sql` — enables trigram extension + GIN indexes for case-insensitive substring search
   - `0003_settings.sql` — creates the `settings` key/value table and seeds defaults
   - `0004_window_trigger.sql` — enforces the fixed 21-hour window and immutable `activate_at` at the DB layer

   **Why migrations?** They let the schema evolve with git history. Any developer on any laptop gets an identical database by replaying the same files.

5. **Create the Storage bucket** in Supabase Studio:
   - Storage → Create bucket → name: `celebrations`, public: **on**
   - Policies → leave default (public read is enabled by making the bucket public)

   **Why public?** Recipients need to download photos and audio directly from the Supabase CDN without an auth round-trip. The short-code URL acts as the privacy boundary; no one reaches the bucket path without a valid celebration.

### Option B — Local Supabase (for development)

Requires Docker Desktop running.

```bash
npx supabase start           # brings up Postgres + Storage + Studio on localhost
npm run db:reset             # applies all migrations from scratch
```

`supabase start` prints the local URL and anon/service-role keys; paste them into `.env.local`. Studio is at http://localhost:54323.

---

## Environment variables

Copy the example and fill it in:

```bash
cp .env.example .env.local
```

Generate the required secret:

```bash
# COOKIE_SIGNING_SECRET (48 random bytes, base64url)
node -e "console.log(require('crypto').randomBytes(48).toString('base64url'))"
```

**Why this secret?** The cookie secret signs session tokens (HMAC-SHA256); leaking it means anyone can impersonate the admin.

### Required minimum

- `NEXT_PUBLIC_APP_URL` — `http://localhost:3000` in dev, your domain in prod
- `SUPABASE_URL` + `NEXT_PUBLIC_SUPABASE_URL` — same value
- `NEXT_PUBLIC_SUPABASE_ANON_KEY` — for public storage reads
- `SUPABASE_SERVICE_ROLE_KEY` — server-only, bypasses RLS
- `COOKIE_SIGNING_SECRET` — the generated string
- `ADMIN_PASSWORD` (or `ADMIN_PASSWORD_HASH`) — used to log into `/admin`

### Optional but recommended

- `UPSTASH_REDIS_REST_URL` + `UPSTASH_REDIS_REST_TOKEN` — rate limiting. **Required** in production; the in-memory fallback is per-process and unsafe across serverless instances.
- `NEXT_PUBLIC_ADMIN_INSTAGRAM_URL` + `NEXT_PUBLIC_ADMIN_INSTAGRAM_HANDLE` — shown on the confirmation screen so creators can DM you for approval.

Get Upstash credentials by creating a free Redis database at [upstash.com](https://upstash.com/) and copying the REST URL + token.

---

## Run locally

```bash
npm run dev
```

Opens http://localhost:3000. Edits hot-reload. The typecheck runs in the background when you lint; to run it once:

```bash
npm run typecheck
npm run lint
npm test              # property-based tests (Vitest + fast-check)
```

### On Windows

Same commands. If `npm run dev` fails with a permission error on the first run, it's usually Windows Defender scanning `node_modules/.cache/`. Exclude your project directory from real-time scanning or wait a few seconds and retry.

If port 3000 is in use:

```powershell
# PowerShell
$env:PORT = 3001; npm run dev
```

```bash
# macOS / Linux / Git Bash
PORT=3001 npm run dev
```

### Running the test suite

```bash
npm test                       # all unit + property-based tests
npm run test:watch             # watch mode
npm run test:pbt               # only property-based tests
npm run test:integration       # DB-backed tests (requires local Supabase — see below)
npm run e2e                    # Playwright (requires `npx playwright install` once)
```

The 18 currently passing property tests run in ~1.5 seconds and need no external dependencies.

---

## Project structure

```
src/
  app/                 Next.js App Router pages + API routes (see Phase details in design.md)
  components/          React components, grouped by surface (form, experience, admin)
  lib/                 Pure modules (env, supabase, cookies, passcode, rate-limit, validation, canvas)
  hooks/               Client hooks (useReducedMotion, useUnlock, etc.)
  styles/              Theme CSS variables (7 themes)
  types/               Shared TypeScript types
supabase/
  migrations/          SQL migrations, applied by `supabase db push`
  config.toml          Local dev config
tests/
  properties/          Property-based tests (fast-check)
  unit/                Example-based unit tests
  integration/         DB/storage integration tests
  e2e/                 Playwright tests
.kiro/specs/           Full requirements, design, and task plan (source of truth)
```

---

## Common scripts

```bash
npm run dev             # next dev (hot reload)
npm run build           # production build
npm run start           # run production build locally
npm run typecheck       # tsc --noEmit, strict mode
npm run lint            # eslint
npm run lint:fix        # eslint --fix
npm run format          # prettier --write .
npm test                # vitest run (unit + PBT)
npm run test:watch      # vitest watch
npm run test:pbt        # only property-based tests
npm run test:integration  # DB-backed integration tests
npm run e2e             # Playwright
npm run db:migrate      # apply migrations to linked Supabase project
npm run db:reset        # wipe + replay migrations (local only!)
```

---

## Deploy to Vercel

One-time, from a machine with the Vercel CLI (or via the dashboard; steps mirror each other).

1. **Push to GitHub/GitLab**:

   ```bash
   git init && git add . && git commit -m "initial commit"
   git remote add origin git@github.com:<you>/celebrate-them.git
   git push -u origin main
   ```

2. **Import in Vercel** at [vercel.com/new](https://vercel.com/new):
   - Framework preset: **Next.js** (auto-detected)
   - Root directory: leave as `./`
   - Build command: `npm run build`
   - Output directory: `.next` (default)

3. **Add environment variables** in Project Settings → Environment Variables. Add **every** variable from `.env.example` that is relevant to production. Critical ones:
   - `NEXT_PUBLIC_APP_URL` → your Vercel URL (e.g. `https://celebrate-them.vercel.app`)
   - Supabase URL + keys
   - `COOKIE_SIGNING_SECRET` — use `vercel env pull` locally to confirm it's not leaked into git
   - `ADMIN_PASSWORD` or `ADMIN_PASSWORD_HASH`
   - `UPSTASH_REDIS_REST_URL` + `TOKEN` (production requires these)
   - `NEXT_PUBLIC_ADMIN_INSTAGRAM_URL` + `_HANDLE`

   **Why per-environment?** Mark each variable's environments (Production, Preview, Development). Development vars are pulled via `vercel env pull .env.development.local`.
5. **Custom domain** (optional): Project → Settings → Domains → add your domain and update the DNS records Vercel shows.

---

## Post-deploy setup

Once the first deploy is green:

1. **Smoke-test the admin login** at `https://your-domain/admin` with `ADMIN_PASSWORD`.
2. **Create a test celebration** from `/create`, set the activation time 20 minutes in the future.
3. **Approve it** from the admin panel.
4. **Open the recipient link** in an incognito window, enter the passcode, watch the experience.
5. **Delete the test celebration** permanently when done.

---

## Troubleshooting

**`Error: Invalid environment configuration`**
Read the list of missing/invalid variables in the error message — `src/lib/env.ts` validates every one. Fill in the matching key in `.env.local` (dev) or Vercel project settings (prod).

**`UPSTASH_REDIS_REST_URL and UPSTASH_REDIS_REST_TOKEN are required in production`**
You deployed without Upstash credentials. Either add them in Vercel env vars or temporarily set `NODE_ENV=development` (not recommended in production).

**Supabase migrations failed to apply**
Run `npx supabase db diff` to see the drift. In a dev environment you can always `npm run db:reset` to wipe and replay. In production you'll need to craft a repair migration — never `db:reset` against prod.

**`pg_trgm` extension error**
Run `0002_pg_trgm.sql` manually in Supabase Studio's SQL editor; on free tiers the CLI sometimes lacks permission to enable extensions.

**Images not loading on the recipient page**
Confirm the Storage bucket is public. Check the network tab — 403s mean the bucket policy is wrong; 404s mean the file path is wrong.

---

## Specification

The complete product and technical spec lives in `.kiro/specs/celebrate-them/`:

- `requirements.md` — 31 requirements with EARS-format acceptance criteria
- `design.md` — architecture, data model, APIs, security, correctness properties
- `tasks.md` — the implementation plan (checkbox-based), used to track progress

When in doubt, read the spec first.


---

## What's built vs. what remains

**Fully functional and production-ready (this build):**

- ✅ Creator multi-step form (`/create`) with client-side image compression, audio upload, and draft state persisted to sessionStorage
- ✅ Confirmation screen (`/create/confirmation`) with Instagram contact and pre-filled message template
- ✅ Recipient lifecycle gate (`/c/[shortCode]`) — pending / pre-activation / ended / 404 / active
- ✅ Passcode entry with auto-submit + rate limiting (10 per 15 min per IP)
- ✅ Recipient birthday + expression experiences with photos, reasons, playable quiz, confession, and reply capture
- ✅ Reply canvas: recipient can download their reply as a PNG locally OR send it to the creator (same pure render function admin uses)
- ✅ Audio player with autoplay fallback
- ✅ Admin panel: login, dashboard with stats, filterable/searchable/sortable list, per-row actions
- ✅ Admin detail page (`/admin/celebrations/[id]`) with pending banner, approve/reject, full content view, photo gallery with per-photo delete, reply image generator
- ✅ Dedicated pending-approval queue (`/admin/pending`) sorted by activation time
- ✅ Admin settings page (default window, maintenance mode, password change)
- ✅ All API routes (public + admin)
- ✅ Admin permanent delete functionality for celebrations and photos
- ✅ Middleware: request-id tracing, admin auth gate, CSRF double-submit, security headers (CSP, HSTS, XFO, etc.)
- ✅ Supabase migrations: table + indexes + CHECK constraints + trigger + settings + view-count RPC
- ✅ Passcode hashing (scrypt), constant-time comparison, unlock cookies with passcode_version binding (admin reset invalidates all live sessions)
- ✅ Rate limiting (Upstash in production, in-memory dev fallback)
- ✅ Centralized constants (`src/lib/constants.ts`) — every magic number lives in one place
- ✅ Per-folder `context_help.md` files documenting architecture and decisions
- ✅ 18 property-based tests passing in ~1.5 seconds: short-code format + entropy, scrypt round-trip, constant-time compare, Zod enforcement of theme/count/activation rules, lifecycle gate totality over 500 random inputs, unlock-cookie MAC tamper detection, passcode-version rotation semantics

**Follow-up work (deliberately deferred):**

- Full cinematic birthday chapters (GSAP SplitText, ScrollTrigger parallax, constellation draw-on SVG, unwrap gift boxes, celebration wheel, multi-burst confetti finale) — current recipient experience is a functional fallback layout. The backend payload is already the right shape.
- Full expression chapters (envelope tap-to-open, slow build with 2-second holds, Ken Burns photos, soft-ending particles) — same fallback approach
- Theme-specific CSS variable blocks for all 7 themes — basic tokens are in place; per-theme palettes land with the cinematic chapter rollout
- Remaining property-based tests (Properties 3, 4, 6, 7, 8, 9, 10, 11, 12, 13, 15 — these require the DB integration harness)
- Playwright e2e flows

The core product — creator → admin-approve → recipient-unlock → experience → reply (download OR send) — works end-to-end today.

---

## Git workflow

```bash
git init
git add .
git commit -m "chore: initial commit — CelebrateThem core"
git branch -M main
git remote add origin git@github.com:<you>/celebrate-them.git
git push -u origin main
```

### Windows git setup

```powershell
# One-time: use the long-path support if node_modules complains
git config --global core.longpaths true
# Use SSH or HTTPS — Git Credential Manager handles both
git clone https://github.com/<you>/celebrate-them.git
```

Per-feature branching:

```bash
git checkout -b feat/birthday-chapters
# ... make changes ...
git add .
git commit -m "feat(recipient): add birthday constellation chapter"
git push -u origin feat/birthday-chapters
# open a PR on GitHub → merge to main → Vercel auto-deploys
```

**Why**: keeps `main` clean and every deploy to Vercel traceable to a specific PR.
