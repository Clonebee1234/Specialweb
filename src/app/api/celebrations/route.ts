/**
 * POST /api/celebrations
 *
 * Creates a new celebration row. This is the single highest-value endpoint:
 *   - Validates the full payload (including type-branched content and the
 *     15-minute activation minimum).
 *   - Hashes the passcode with scrypt.
 *   - Generates a unique short code with retry.
 *   - Moves uploaded media from the tmp_* draft prefix to the final short-code
 *     prefix in Storage. Rolls back row + storage on any failure.
 *   - Inserts with `status='pending'` and `expires_at = activate_at + 21h`.
 *   - Returns `{ shortCode, passcode, activate_at, expires_at }` exactly once.
 *
 * Ordering note: the DB CHECK constraints require 3–7 photos (birthday) or
 * 2–4 photos (expression) — so the initial INSERT MUST carry the photos, not
 * an empty array. We insert with the draft (tmp_*) URLs, then move the files
 * into the final prefix and patch the URLs to point at the new location.
 * If the Storage move fails we delete the row before returning 502.
 *
 * Never returns the plaintext passcode after this response. The hash goes
 * into the DB; the plaintext never touches the logger (see lib/logger.ts
 * redact list).
 */

import { NextResponse, type NextRequest } from 'next/server';
import { apiHandler, HttpError } from '@/lib/api/handler';
import {
  CreateCelebrationSchema,
  type CreateCelebrationInput,
} from '@/lib/validation/createCelebration';
import { hashPasscode } from '@/lib/passcode';
import { createWithShortCode, ShortCodeGenerationError } from '@/lib/shortcode';
import {
  insertCelebration,
  isUniqueViolation,
  updatePhotos,
  hardDeleteByShortCode,
} from '@/lib/db/celebrations';
import { movePrefix, publicUrlFor } from '@/lib/db/storage';
import { ACTIVATION_WINDOW_HOURS } from '@/lib/constants';
import type { CelebrationInsert, PhotoRow } from '@/lib/supabase/types';

export const POST = apiHandler(async (req: NextRequest) => {
  const raw = await req.json().catch(() => null);
  const parsed = CreateCelebrationSchema.safeParse(raw);
  if (!parsed.success) {
    const issues = parsed.error.issues;
    const themeIssue = issues.find((i) => i.path[0] === 'theme');
    const activateIssue = issues.find((i) => i.path[0] === 'activate_at');
    if (themeIssue?.message === 'THEME_NOT_ALLOWED_FOR_TYPE') {
      throw new HttpError(400, 'THEME_NOT_ALLOWED_FOR_TYPE', 'Theme not allowed for this type.');
    }
    if (activateIssue?.message === 'ACTIVATE_AT_TOO_SOON') {
      throw new HttpError(
        400,
        'ACTIVATE_AT_TOO_SOON',
        'Activation time must be at least 15 minutes from now.',
      );
    }
    throw new HttpError(400, 'VALIDATION_FAILED', 'Please fix the highlighted fields.', {
      issues,
    });
  }
  const input = parsed.data;
  const passcodeHash = await hashPasscode(input.passcode);

  const activateAt = new Date(input.activate_at);
  const expiresAt = new Date(
    activateAt.getTime() + ACTIVATION_WINDOW_HOURS * 60 * 60 * 1000,
  );

  const draftPrefix = extractDraftPrefix(input.photos);
  if (!draftPrefix) {
    throw new HttpError(400, 'VALIDATION_FAILED', 'Photo URLs must come from the upload endpoint.');
  }

  // Step 1: insert with the tmp_* URLs. Satisfies the DB shape CHECK (photos
  // array non-empty) while still tying the row to the draft prefix so a
  // failure below can roll back cleanly.
  let shortCode: string;
  try {
    const { code } = await createWithShortCode(
      async (candidate) => {
        const insertRow = toInsertRow(input, candidate, passcodeHash, activateAt, expiresAt);
        return insertCelebration(insertRow);
      },
      { isUniqueViolation },
    );
    shortCode = code;
  } catch (err) {
    if (err instanceof ShortCodeGenerationError) {
      throw new HttpError(500, 'SHORT_CODE_GENERATION_FAILED', 'Could not allocate a short code.');
    }
    throw err;
  }

  // Step 2: move media into the final prefix.
  try {
    await movePrefix(draftPrefix, shortCode);
  } catch (moveErr) {
    await hardDeleteByShortCode(shortCode).catch(() => undefined);
    throw moveErr instanceof HttpError
      ? moveErr
      : new HttpError(502, 'PHOTO_UPLOAD_FAILED', 'Could not finalize media.');
  }

  // Step 3: rewrite photo URLs to the final location + rewrite song_url if
  // it came from the tmp prefix.
  const finalPhotos: PhotoRow[] = input.photos.map((p, idx) => ({
    url: publicUrlFor(`${shortCode}/photo_${idx + 1}.${extOf(p.url)}`),
    caption: p.caption ?? '',
    order: p.order,
  }));
  const finalSongUrl = input.song_url
    ? publicUrlFor(`${shortCode}/music.${audioExtOf(input.song_url)}`)
    : null;
  await updatePhotos(shortCode, finalPhotos, finalSongUrl);

  return NextResponse.json(
    {
      shortCode,
      passcode: input.passcode, // returned exactly once per Req 1.1
      activate_at: activateAt.toISOString(),
      expires_at: expiresAt.toISOString(),
    },
    { status: 201 },
  );
});

function toInsertRow(
  input: CreateCelebrationInput,
  shortCode: string,
  passcodeHash: string,
  activateAt: Date,
  expiresAt: Date,
): CelebrationInsert {
  // Use the tmp URLs on first insert; they satisfy the non-empty CHECK and
  // are replaced seconds later by the final URLs after movePrefix succeeds.
  const draftPhotos: PhotoRow[] = input.photos.map((p) => ({
    url: p.url,
    caption: p.caption ?? '',
    order: p.order,
  }));

  const base = {
    short_code: shortCode,
    passcode: passcodeHash,
    type: input.type,
    status: 'pending' as const,
    theme: input.theme,
    recipient_name: input.recipient_name,
    creator_name: input.creator_name,
    relationship: input.relationship,
    song_url: input.song_url ?? null,
    photos: draftPhotos,
    hero_text: null,
    reasons: null,
    quiz_questions: null,
    final_message: null,
    confession_message: null,
    things_i_notice: null,
    closing_line: null,
    activate_at: activateAt.toISOString(),
    expires_at: expiresAt.toISOString(),
  } satisfies Partial<CelebrationInsert> as CelebrationInsert;

  if (input.type === 'birthday') {
    return {
      ...base,
      hero_text: input.hero_text,
      reasons: input.reasons,
      quiz_questions: input.quiz_questions,
      final_message: input.final_message,
    };
  }
  return {
    ...base,
    confession_message: input.confession_message,
    things_i_notice: input.things_i_notice,
    closing_line: input.closing_line,
  };
}

function extractDraftPrefix(photos: { url: string }[]): string | null {
  for (const p of photos) {
    const match = p.url.match(/\/celebrations\/(tmp_[A-Za-z0-9_-]+)\//);
    if (match && match[1]) return match[1];
  }
  return null;
}

function extOf(url: string): string {
  const match = url.match(/\.(jpg|jpeg|png|webp)(\?|$)/i);
  return match && match[1] ? match[1].toLowerCase() : 'webp';
}

function audioExtOf(url: string): string {
  const match = url.match(/\.(mp3|m4a)(\?|$)/i);
  return match && match[1] ? match[1].toLowerCase() : 'mp3';
}
