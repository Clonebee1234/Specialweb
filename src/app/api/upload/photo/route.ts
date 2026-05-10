/**
 * POST /api/upload/photo
 *
 * Issues a short-lived signed upload URL pointing into the Storage bucket.
 * The client PUTs bytes directly to that URL (bypassing the serverless
 * function's body size limit) and then includes `publicUrl` in the create-
 * celebration payload.
 *
 * MIME is enforced at two layers: this route rejects disallowed types before
 * the signed URL is issued (Req 7.5), and the create-celebration schema
 * re-validates the URL list on final submit.
 */

import { NextResponse, type NextRequest } from 'next/server';
import { z } from 'zod';
import { apiHandler, HttpError } from '@/lib/api/handler';
import { createSignedUploadUrl } from '@/lib/db/storage';
import { PHOTO_ALLOWED_MIME, PHOTO_COUNT_RANGES } from '@/lib/constants';

const ALLOWED = new Set<string>(PHOTO_ALLOWED_MIME);
const MAX_INDEX = Math.max(
  PHOTO_COUNT_RANGES.birthday.max,
  PHOTO_COUNT_RANGES.expression.max,
);

const UploadPhotoSchema = z.object({
  shortCodeDraft: z.string().min(3).max(64).regex(/^tmp_[A-Za-z0-9_-]+$/),
  index: z.number().int().min(1).max(MAX_INDEX),
  contentType: z.string(),
});

export const POST = apiHandler(async (req: NextRequest) => {
  const body = await req.json().catch(() => null);
  const parsed = UploadPhotoSchema.safeParse(body);
  if (!parsed.success) {
    throw new HttpError(400, 'VALIDATION_FAILED', 'Invalid upload request', parsed.error.issues);
  }
  if (!ALLOWED.has(parsed.data.contentType)) {
    throw new HttpError(415, 'UNSUPPORTED_PHOTO_TYPE', 'Only JPEG, PNG, or WebP photos are accepted.');
  }
  const ext = parsed.data.contentType === 'image/png' ? 'png' : parsed.data.contentType === 'image/jpeg' ? 'jpg' : 'webp';
  const path = `${parsed.data.shortCodeDraft}/photo_${parsed.data.index}.${ext}`;
  const signed = await createSignedUploadUrl(path);
  return NextResponse.json(signed);
});
