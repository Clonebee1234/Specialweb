/**
 * Single source of truth for every tunable magic number and string used by
 * the app. Route handlers, UI, and tests all import from here so changes
 * ripple through once.
 *
 * Philosophy: named constants beat literal numbers everywhere — the filename
 * itself is documentation.
 */

// -----------------------------------------------------------------------------
// Lifecycle
// -----------------------------------------------------------------------------

/** Fixed duration of every celebration's active window (Req 5.5, 27.14). */
export const ACTIVATION_WINDOW_HOURS = 21;

/** Minimum offset between "now" and the Creator-chosen activate_at (Req 5.3). */
export const MIN_ACTIVATION_OFFSET_MINUTES = 15;

/** 30-minute dedupe window on the atomic view-count increment (Req 20.2). */
export const VIEW_COUNT_DEDUPE_MINUTES = 30;

// -----------------------------------------------------------------------------
// Cookies
// -----------------------------------------------------------------------------

export const ADMIN_COOKIE_NAME = 'ct_admin';
export const CSRF_COOKIE_NAME = 'ct_csrf';
export const ADMIN_SESSION_TTL_SEC = 24 * 60 * 60;
export const UNLOCK_TTL_SEC = 24 * 60 * 60;

// -----------------------------------------------------------------------------
// Rate limiting
// -----------------------------------------------------------------------------

export const RATE_LIMITS = {
  unlock: { limit: 10, windowMs: 15 * 60 * 1000 }, // 10 / 15 min per (shortCode, IP)
  adminLogin: { limit: 5, windowMs: 15 * 60 * 1000 }, // 5 / 15 min per IP
  adminPasscodeReset: { limit: 20, windowMs: 60 * 60 * 1000 }, // 20 / 60 min per admin session
} as const;

/** Fixed delay applied on failed admin logins to mitigate timing attacks. */
export const ADMIN_LOGIN_FAIL_DELAY_MS = 400;

// -----------------------------------------------------------------------------
// Passcode / cryptography
// -----------------------------------------------------------------------------

export const SCRYPT_PARAMS = { N: 16384, r: 8, p: 1, keyLen: 64 } as const;
export const PASSCODE_REGEX = /^[0-9]{4}$/;

// -----------------------------------------------------------------------------
// Short codes
// -----------------------------------------------------------------------------

export const SHORT_CODE_ALPHABET =
  'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
export const SHORT_CODE_MIN_LENGTH = 6;
export const SHORT_CODE_MAX_LENGTH = 8;
export const SHORT_CODE_MAX_RETRIES = 5;

// -----------------------------------------------------------------------------
// Media / storage
// -----------------------------------------------------------------------------

export const STORAGE_BUCKET = 'celebrations';

export const PHOTO_ALLOWED_MIME = ['image/jpeg', 'image/png', 'image/webp'] as const;
export const AUDIO_ALLOWED_MIME = ['audio/mpeg', 'audio/mp4'] as const;
export const PHOTO_MAX_BYTES = 1_048_576; // 1 MB post-compression
export const AUDIO_MAX_BYTES = 5 * 1024 * 1024; // 5 MB
export const PHOTO_COMPRESSION_QUALITIES = [0.85, 0.7, 0.55] as const;
export const PHOTO_MAX_DIMENSION = 2000;

export const PHOTO_COUNT_RANGES = {
  birthday: { min: 3, max: 7 },
  expression: { min: 2, max: 4 },
} as const;

// -----------------------------------------------------------------------------
// Content limits (mirrors the DB CHECK constraints and Zod schemas)
// -----------------------------------------------------------------------------

export const CHAR_LIMITS = {
  recipient_name: 100,
  creator_name: 100,
  relationship: 50,
  caption: 100,
  hero_text: 150,
  reason: 150,
  quiz_prompt: 300,
  quiz_option: 150,
  final_message: 800,
  confession_message: 1500,
  notice_line: 150,
  closing_line: 200,
  reply_text: 200,
  admin_notes: 2000,
} as const;

export const LIST_RANGES = {
  birthday_reasons: { min: 5, max: 10 },
  birthday_quiz: { length: 5 },
  expression_notices: { min: 3, max: 5 },
} as const;

// -----------------------------------------------------------------------------
// Themes
// -----------------------------------------------------------------------------

export const BIRTHDAY_THEMES = [
  'confetti-burst',
  'golden-glow',
  'neon-night',
  'starry-dream',
] as const;

export const EXPRESSION_THEMES = ['midnight-letters', 'soft-bloom', 'warm-sunset'] as const;

export const ALL_THEMES = [...BIRTHDAY_THEMES, ...EXPRESSION_THEMES] as const;

export const RELATIONSHIPS = [
  'Partner',
  'Crush',
  'Best Friend',
  'Sibling',
  'Spouse',
  'Other',
] as const;

export const CLOSING_LINE_PRESETS = [
  'Will you be mine?',
  'I just wanted you to know',
  'What do you think?',
  "I've been meaning to tell you...",
] as const;

// -----------------------------------------------------------------------------
// Messages (centralized so copy changes don't require code changes)
// -----------------------------------------------------------------------------

export const MESSAGES = {
  invalid_passcode: "That's not quite right. Try again 💛",
  rate_limited: 'Too many attempts. Please try again later.',
  pending_gate: 'This surprise is still being prepared. Check back soon 💛',
  ended_gate: 'This celebration has ended. The memories live on 💫. Screen record next time!',
  pre_activation_gate: (localTime: string) =>
    `This celebration will open at ${localTime}. Come back then 💛`,
  activate_at_too_soon: `Activation time must be at least ${MIN_ACTIVATION_OFFSET_MINUTES} minutes from now.`,
  photo_too_large: 'This image is too large. Please choose a smaller photo.',
  audio_too_large: 'Audio must be 5 MB or smaller.',
  reply_save_failed: "We couldn't save your reply. Please try again.",
  reset_passcode_warning:
    'This will invalidate the current passcode and any active unlock sessions.',
} as const;

// -----------------------------------------------------------------------------
// Performance budgets
// -----------------------------------------------------------------------------

export const BUNDLE_BUDGET_BYTES = 250_000;
export const FCP_BUDGET_MS = 2500;
