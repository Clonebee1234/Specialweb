#!/usr/bin/env bash
# =============================================================================
# CelebrateThem — one-shot setup script for macOS / Linux / Git Bash on Windows.
#
# Usage:
#   bash scripts/setup.sh
#
# What it does:
#   1. Verifies Node 18.17+ is installed.
#   2. Runs `npm install` to bring down dependencies from package.json.
#   3. Installs Playwright browsers (needed for e2e tests).
#   4. Creates .env.local from .env.example if it does not exist.
#   5. Generates fresh COOKIE_SIGNING_SECRET and CRON_SECRET values.
#   6. Prints next-step instructions.
# =============================================================================

set -e  # exit on first error

BOLD='\033[1m'
CYAN='\033[36m'
GREEN='\033[32m'
YELLOW='\033[33m'
RED='\033[31m'
RESET='\033[0m'

echo -e "${BOLD}${CYAN}CelebrateThem — local setup${RESET}"
echo ""

# ---------------------------------------------------------------------------
# 1. Node version check
# ---------------------------------------------------------------------------
if ! command -v node >/dev/null 2>&1; then
  echo -e "${RED}✗ Node.js is not installed.${RESET}"
  echo "  Install from https://nodejs.org (LTS 20 recommended)."
  exit 1
fi

NODE_VERSION=$(node -v | sed 's/v//')
NODE_MAJOR=$(echo "$NODE_VERSION" | cut -d. -f1)
if [ "$NODE_MAJOR" -lt 18 ]; then
  echo -e "${RED}✗ Node $NODE_VERSION is too old. Need 18.17 or newer.${RESET}"
  exit 1
fi
echo -e "${GREEN}✓${RESET} Node $NODE_VERSION"

# ---------------------------------------------------------------------------
# 2. npm install
# ---------------------------------------------------------------------------
echo -e "${CYAN}• Installing dependencies (this takes 1–3 minutes)…${RESET}"
npm install

# ---------------------------------------------------------------------------
# 3. Playwright browsers (optional — only needed for e2e)
# ---------------------------------------------------------------------------
if [ "${SKIP_PLAYWRIGHT:-}" != "1" ]; then
  echo -e "${CYAN}• Installing Playwright browsers (optional, for e2e tests)…${RESET}"
  echo "  Skip this step next time with: SKIP_PLAYWRIGHT=1 bash scripts/setup.sh"
  npx playwright install --with-deps chromium || true
fi

# ---------------------------------------------------------------------------
# 4. .env.local
# ---------------------------------------------------------------------------
if [ -f .env.local ]; then
  echo -e "${YELLOW}• .env.local already exists — leaving it alone.${RESET}"
else
  echo -e "${CYAN}• Creating .env.local from .env.example…${RESET}"
  cp .env.example .env.local

  # Generate random secrets.
  COOKIE_SECRET=$(node -e "console.log(require('crypto').randomBytes(48).toString('base64url'))")
  CRON_SECRET=$(node -e "console.log(require('crypto').randomBytes(24).toString('base64url'))")

  # Portable sed replacement (works on macOS and Linux).
  node -e "
    const fs = require('fs');
    let s = fs.readFileSync('.env.local', 'utf8');
    s = s.replace(/COOKIE_SIGNING_SECRET=.*/g, 'COOKIE_SIGNING_SECRET=' + '${COOKIE_SECRET}');
    s = s.replace(/CRON_SECRET=.*/g, 'CRON_SECRET=' + '${CRON_SECRET}');
    fs.writeFileSync('.env.local', s);
  "
  echo -e "${GREEN}✓${RESET} Generated fresh COOKIE_SIGNING_SECRET and CRON_SECRET"
fi

# ---------------------------------------------------------------------------
# 5. Typecheck + tests (smoke)
# ---------------------------------------------------------------------------
echo -e "${CYAN}• Running typecheck…${RESET}"
npm run typecheck

echo -e "${CYAN}• Running property-based tests…${RESET}"
npm test -- --run

echo ""
echo -e "${BOLD}${GREEN}✓ Setup complete.${RESET}"
echo ""
echo -e "${BOLD}Next steps:${RESET}"
echo "  1. Fill in real Supabase creds in .env.local (or leave placeholders to preview UI only)."
echo "  2. Start the dev server:  ${CYAN}npm run dev${RESET}"
echo "  3. Preview the templates: ${CYAN}http://localhost:3000/preview/birthday${RESET}"
echo "                            ${CYAN}http://localhost:3000/preview/expression${RESET}"
echo "  4. Full setup guide:      ${CYAN}README.md${RESET}"
