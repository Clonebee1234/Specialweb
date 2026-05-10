# =============================================================================
# CelebrateThem — one-shot setup script for Windows PowerShell.
#
# Usage (from the project root, in PowerShell):
#   .\scripts\setup.ps1
#
# If PowerShell refuses to run the script, unblock it once:
#   Set-ExecutionPolicy -Scope Process -ExecutionPolicy Bypass
# =============================================================================

$ErrorActionPreference = 'Stop'

Write-Host "CelebrateThem - local setup" -ForegroundColor Cyan
Write-Host ""

# ---------------------------------------------------------------------------
# 1. Node version check
# ---------------------------------------------------------------------------
try {
    $nodeVersion = (node -v) -replace '^v', ''
    $major = [int]($nodeVersion -split '\.')[0]
    if ($major -lt 18) {
        Write-Host "[X] Node $nodeVersion is too old. Need 18.17 or newer." -ForegroundColor Red
        exit 1
    }
    Write-Host "[OK] Node $nodeVersion" -ForegroundColor Green
} catch {
    Write-Host "[X] Node.js is not installed." -ForegroundColor Red
    Write-Host "  Install from https://nodejs.org (LTS 20 recommended)."
    exit 1
}

# ---------------------------------------------------------------------------
# 2. npm install
# ---------------------------------------------------------------------------
Write-Host "* Installing dependencies (this takes 1-3 minutes)..." -ForegroundColor Cyan
npm install
if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }

# ---------------------------------------------------------------------------
# 3. Playwright browsers (optional)
# ---------------------------------------------------------------------------
if ($env:SKIP_PLAYWRIGHT -ne "1") {
    Write-Host "* Installing Playwright browsers (optional, for e2e tests)..." -ForegroundColor Cyan
    Write-Host "  Skip next time with: `$env:SKIP_PLAYWRIGHT='1'; .\scripts\setup.ps1"
    npx playwright install --with-deps chromium
}

# ---------------------------------------------------------------------------
# 4. .env.local
# ---------------------------------------------------------------------------
if (Test-Path .env.local) {
    Write-Host "* .env.local already exists - leaving it alone." -ForegroundColor Yellow
} else {
    Write-Host "* Creating .env.local from .env.example..." -ForegroundColor Cyan
    Copy-Item .env.example .env.local

    $cookieSecret = node -e "console.log(require('crypto').randomBytes(48).toString('base64url'))"
    $cronSecret = node -e "console.log(require('crypto').randomBytes(24).toString('base64url'))"

    $content = Get-Content .env.local -Raw
    $content = $content -replace 'COOKIE_SIGNING_SECRET=.*', "COOKIE_SIGNING_SECRET=$cookieSecret"
    $content = $content -replace 'CRON_SECRET=.*', "CRON_SECRET=$cronSecret"
    Set-Content .env.local -Value $content -NoNewline

    Write-Host "[OK] Generated fresh COOKIE_SIGNING_SECRET and CRON_SECRET" -ForegroundColor Green
}

# ---------------------------------------------------------------------------
# 5. Typecheck + tests (smoke)
# ---------------------------------------------------------------------------
Write-Host "* Running typecheck..." -ForegroundColor Cyan
npm run typecheck
if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }

Write-Host "* Running property-based tests..." -ForegroundColor Cyan
npm test -- --run
if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }

Write-Host ""
Write-Host "[OK] Setup complete." -ForegroundColor Green
Write-Host ""
Write-Host "Next steps:"
Write-Host "  1. Fill in real Supabase creds in .env.local (or leave placeholders to preview UI only)."
Write-Host "  2. Start the dev server:  npm run dev" -ForegroundColor Cyan
Write-Host "  3. Preview the templates: http://localhost:3000/preview/birthday" -ForegroundColor Cyan
Write-Host "                            http://localhost:3000/preview/expression" -ForegroundColor Cyan
Write-Host "  4. Full setup guide:      README.md" -ForegroundColor Cyan
