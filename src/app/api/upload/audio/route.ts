/**
 * POST /api/upload/audio
 *
 * Same shape as /api/upload/photo but for the optional music upload. The 5 MB
 * size cap from Req 8.1 is enforced client-side; Supabase Storage applies the
 * bucket's file_size_limit as a second layer.
 */

import { NextResponse, type NextRequest } from 'next/server';
import { z } from 'zod';
import { apiHandler, HttpError } from '@/lib/api/handler';
import { createSignedUploadUrl } from '@/lib/db/storage';
import { AUDIO_ALLOWED_MIME } from '@/lib/constants';

const ALLOWED = new Set<string>(AUDIO_ALLOWED_MIME);

const UploadAudioSchema = z.object({
  shortCodeDraft: z.string().min(3).max(64).regex(/^tmp_[A-Za-z0-9_-]+$/),
  contentType: z.string(),
});

export const POST = apiHandler(async (req: NextRequest) => {
  const body = await req.json().catch(() => null);
  const parsed = UploadAudioSchema.safeParse(body);
  if (!parsed.success) {
    throw new HttpError(400, 'VALIDATION_FAILED', 'Invalid upload request', parsed.error.issues);
  }
  if (!ALLOWED.has(parsed.data.contentType)) {
    throw new HttpError(415, 'UNSUPPORTED_AUDIO_TYPE', 'Only MP3 or M4A audio is accepted.');
  }
  const ext = parsed.data.contentType === 'audio/mpeg' ? 'mp3' : 'm4a';
  const path = `${parsed.data.shortCodeDraft}/music.${ext}`;
  const signed = await createSignedUploadUrl(path);
  return NextResponse.json(signed);
});
