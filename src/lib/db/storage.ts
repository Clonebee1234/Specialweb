/** Supabase Storage helpers for the `celebrations` bucket. */

import type { SupabaseClient } from '@supabase/supabase-js';
import { getSupabaseServer } from '@/lib/supabase/server';
import { HttpError } from '@/lib/api/handler';

/** Bucket name for celebration media in Supabase Storage. */
import { STORAGE_BUCKET } from '@/lib/constants';
export const BUCKET = STORAGE_BUCKET;

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function client(): SupabaseClient<any, any, any> {
  return getSupabaseServer() as unknown as SupabaseClient<any, any, any>;
}

/**
 * Issues a short-TTL signed upload URL for a specific path. The caller PUTs
 * the bytes directly to that URL, which keeps the serverless function small
 * and avoids Vercel's 4.5MB body cap on uploads.
 */
export async function createSignedUploadUrl(
  path: string,
): Promise<{ uploadUrl: string; publicUrl: string; path: string; token: string }> {
  const supabase = client();
  const signed = await supabase.storage.from(BUCKET).createSignedUploadUrl(path);
  if (signed.error || !signed.data) {
    throw new HttpError(500, 'STORAGE_ERROR', signed.error?.message ?? 'No signed URL returned');
  }
  const publicUrl = supabase.storage.from(BUCKET).getPublicUrl(path).data.publicUrl;
  return {
    uploadUrl: signed.data.signedUrl,
    token: signed.data.token,
    path,
    publicUrl,
  };
}

/**
 * Moves every file from one prefix to another, preserving relative filenames.
 * Used after a creator submits their form — we rename the `tmp_{draftId}/`
 * upload prefix to `{shortCode}/` so the persisted row points to its final
 * public URL.
 *
 * If any move fails, we best-effort revert the ones that succeeded.
 */
export async function movePrefix(
  fromPrefix: string,
  toPrefix: string,
): Promise<void> {
  const supabase = client();
  const { data: list, error: listErr } = await supabase.storage.from(BUCKET).list(fromPrefix);
  if (listErr) throw new HttpError(502, 'STORAGE_ERROR', listErr.message);
  const files = list ?? [];
  const moved: Array<{ from: string; to: string }> = [];
  for (const file of files) {
    const from = `${fromPrefix}/${file.name}`;
    const to = `${toPrefix}/${file.name}`;
    const { error } = await supabase.storage.from(BUCKET).move(from, to);
    if (error) {
      // Revert
      for (const m of moved) {
        await supabase.storage.from(BUCKET).move(m.to, m.from).catch(() => undefined);
      }
      throw new HttpError(502, 'PHOTO_UPLOAD_FAILED', error.message);
    }
    moved.push({ from, to });
  }
}

export async function deletePrefix(prefix: string): Promise<void> {
  const supabase = client();
  const { data: list, error: listErr } = await supabase.storage.from(BUCKET).list(prefix);
  if (listErr) throw new HttpError(502, 'STORAGE_DELETE_FAILED', listErr.message);
  const paths = (list ?? []).map((f) => `${prefix}/${f.name}`);
  if (paths.length === 0) return;
  const { error } = await supabase.storage.from(BUCKET).remove(paths);
  if (error) throw new HttpError(502, 'STORAGE_DELETE_FAILED', error.message);
}

export async function deleteObject(path: string): Promise<void> {
  const supabase = client();
  const { error } = await supabase.storage.from(BUCKET).remove([path]);
  if (error) throw new HttpError(502, 'STORAGE_DELETE_FAILED', error.message);
}

export function publicUrlFor(path: string): string {
  return client().storage.from(BUCKET).getPublicUrl(path).data.publicUrl;
}
