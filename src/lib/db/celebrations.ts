/**
 * Domain-layer helpers for the `celebrations` table.
 *
 * API routes call into these functions instead of hand-rolling Supabase
 * queries. This keeps the SQL and error-handling consistent.
 *
 * Note on typing: Supabase's generated-client generics want a very specific
 * Database shape. We keep our hand-written row types in `@/lib/supabase/types`
 * and cast the Supabase client to a permissive form here; every return value
 * is narrowed back to the domain type before leaving this module.
 */

import type { SupabaseClient } from '@supabase/supabase-js';
import { getSupabaseServer } from '@/lib/supabase/server';
import type {
  CelebrationInsert,
  CelebrationRow,
  CelebrationStatus,
  PhotoRow,
} from '@/lib/supabase/types';
import { HttpError } from '@/lib/api/handler';

// Cast helper: we treat the service-role client as untyped because our
// domain types live outside Supabase's inferred schema.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function db(): SupabaseClient<any, any, any> {
  return getSupabaseServer() as unknown as SupabaseClient<any, any, any>;
}

export async function findByShortCode(shortCode: string): Promise<CelebrationRow | null> {
  const { data, error } = await db()
    .from('celebrations')
    .select('*')
    .eq('short_code', shortCode)
    .maybeSingle();
  if (error) throw new HttpError(500, 'DB_ERROR', error.message);
  if (!data) return null;
  const row = data as CelebrationRow;
  if (row.status === 'deleted') return null;
  return row;
}

export async function findByShortCodeIncludingDeleted(
  shortCode: string,
): Promise<CelebrationRow | null> {
  const { data, error } = await db()
    .from('celebrations')
    .select('*')
    .eq('short_code', shortCode)
    .maybeSingle();
  if (error) throw new HttpError(500, 'DB_ERROR', error.message);
  return (data as CelebrationRow | null) ?? null;
}

export async function findById(id: string): Promise<CelebrationRow | null> {
  const { data, error } = await db().from('celebrations').select('*').eq('id', id).maybeSingle();
  if (error) throw new HttpError(500, 'DB_ERROR', error.message);
  return (data as CelebrationRow | null) ?? null;
}

export async function insertCelebration(row: CelebrationInsert): Promise<CelebrationRow> {
  const { data, error } = await db().from('celebrations').insert(row).select('*').single();
  if (error) throw error;
  return data as CelebrationRow;
}

/** True iff `err` looks like a Postgres unique_violation (23505). */
export function isUniqueViolation(err: unknown): boolean {
  if (!err || typeof err !== 'object') return false;
  const code = (err as { code?: string }).code;
  const message = (err as { message?: string }).message ?? '';
  return code === '23505' || message.includes('duplicate key');
}

/**
 * Atomic view-count increment with 30-minute dedupe (Req 20.2).
 * Delegates to the SQL function defined in migration 0005.
 */
export async function tryBumpViewCount(id: string): Promise<number | null> {
  const { data, error } = await db().rpc('increment_view_count', { _id: id });
  if (error) throw new HttpError(500, 'DB_ERROR', error.message);
  if (typeof data === 'number') return data;
  if (Array.isArray(data) && typeof data[0] === 'number') return data[0] as number;
  return null;
}

export async function updateStatus(
  id: string,
  status: CelebrationStatus,
): Promise<CelebrationRow | null> {
  const { data, error } = await db()
    .from('celebrations')
    .update({ status })
    .eq('id', id)
    .select('*')
    .maybeSingle();
  if (error) throw new HttpError(500, 'DB_ERROR', error.message);
  return (data as CelebrationRow | null) ?? null;
}

export async function updatePhotos(
  shortCodeOrRow: string,
  photos: PhotoRow[],
  songUrl?: string | null,
): Promise<void> {
  const patch: Partial<CelebrationRow> = { photos };
  if (songUrl !== undefined) patch.song_url = songUrl;
  // Support both "update by short_code" (used by the create endpoint) and
  // "update by id" (admin per-photo delete). Detect shape by UUID heuristic.
  const isUuid = /^[0-9a-f]{8}-/i.test(shortCodeOrRow);
  const q = db().from('celebrations').update(patch);
  const { error } = await (isUuid
    ? q.eq('id', shortCodeOrRow)
    : q.eq('short_code', shortCodeOrRow));
  if (error) throw new HttpError(500, 'DB_ERROR', error.message);
}

/** Hard-delete a row by short_code. Used for rollback on create-failure. */
export async function hardDeleteByShortCode(shortCode: string): Promise<void> {
  const { error } = await db().from('celebrations').delete().eq('short_code', shortCode);
  if (error) throw new HttpError(500, 'DB_ERROR', error.message);
}

export async function updateFields(
  id: string,
  patch: Partial<CelebrationRow>,
): Promise<CelebrationRow | null> {
  const { data, error } = await db()
    .from('celebrations')
    .update(patch)
    .eq('id', id)
    .select('*')
    .maybeSingle();
  if (error) throw new HttpError(500, 'DB_ERROR', error.message);
  return (data as CelebrationRow | null) ?? null;
}

export async function hardDeleteRow(id: string): Promise<void> {
  const { error } = await db().from('celebrations').delete().eq('id', id);
  if (error) throw new HttpError(500, 'DB_ERROR', error.message);
}

/**
 * Returns the sole result of a single UPDATE-WHERE clause. Used for the
 * approve endpoint where we want exactly one of {row, no-op, error}.
 */
export async function approveIfPendingAndFresh(
  id: string,
): Promise<{ updated: CelebrationRow | null; currentStatus: CelebrationStatus | null; expires_at: string | null }> {
  // Read current state first so we can distinguish between:
  //   - row missing / deleted (404)
  //   - already active (200 no-op)
  //   - pending & expires_at <= now (409 APPROVAL_WINDOW_ELAPSED)
  //   - pending & fresh (200 with update)
  const current = await findById(id);
  if (!current || current.status === 'deleted') {
    return { updated: null, currentStatus: null, expires_at: null };
  }
  if (current.status !== 'pending') {
    return { updated: current, currentStatus: current.status, expires_at: current.expires_at };
  }
  if (new Date(current.expires_at).getTime() <= Date.now()) {
    return { updated: null, currentStatus: 'pending', expires_at: current.expires_at };
  }
  const { data, error } = await db()
    .from('celebrations')
    .update({
      status: 'active',
      approved_at: new Date().toISOString(),
      approved_by: 'admin',
    })
    .eq('id', id)
    .eq('status', 'pending')
    .select('*')
    .maybeSingle();
  if (error) throw new HttpError(500, 'DB_ERROR', error.message);
  return {
    updated: (data as CelebrationRow | null) ?? null,
    currentStatus: 'active',
    expires_at: current.expires_at,
  };
}

export async function rejectIfPendingOrInactive(
  id: string,
  admin_notes: string | undefined,
): Promise<{ row: CelebrationRow | null; conflict?: 'active' | 'deleted' }> {
  const current = await findById(id);
  if (!current) return { row: null };
  if (current.status === 'deleted') return { row: null, conflict: 'deleted' };
  if (current.status === 'active') return { row: current, conflict: 'active' };

  // Idempotent: covers both 'pending' and already-'inactive'.
  const patch: Partial<CelebrationRow> = { status: 'inactive' };
  if (admin_notes !== undefined) patch.admin_notes = admin_notes;

  const { data, error } = await db()
    .from('celebrations')
    .update(patch)
    .eq('id', id)
    .select('*')
    .maybeSingle();
  if (error) throw new HttpError(500, 'DB_ERROR', error.message);
  return { row: (data as CelebrationRow | null) ?? null };
}

export async function resetPasscode(
  id: string,
  newHash: string,
): Promise<{ passcode_version: number; row: CelebrationRow | null } | null> {
  const current = await findById(id);
  if (!current || current.status === 'deleted') return null;
  const nextVersion = current.passcode_version + 1;
  const { data, error } = await db()
    .from('celebrations')
    .update({ passcode: newHash, passcode_version: nextVersion })
    .eq('id', id)
    .select('*')
    .maybeSingle();
  if (error) throw new HttpError(500, 'DB_ERROR', error.message);
  const row = (data as CelebrationRow | null) ?? null;
  if (!row) return null;
  return { passcode_version: row.passcode_version, row };
}

export async function extendExpiry(
  id: string,
  hours: number,
): Promise<CelebrationRow | null> {
  const current = await findById(id);
  if (!current || current.status === 'deleted') return null;
  const newExpiry = new Date(
    new Date(current.expires_at).getTime() + hours * 60 * 60 * 1000,
  ).toISOString();
  const patch: Partial<CelebrationRow> = { expires_at: newExpiry };
  // If this extension revives an inactive celebration into a future window,
  // flip status to active and bump the reactivation counter.
  const nowMs = Date.now();
  const willBeActive = current.status === 'inactive' && new Date(newExpiry).getTime() > nowMs;
  if (willBeActive) {
    patch.status = 'active';
    patch.times_reactivated = current.times_reactivated + 1;
  }
  const { data, error } = await db()
    .from('celebrations')
    .update(patch)
    .eq('id', id)
    .select('*')
    .maybeSingle();
  if (error) throw new HttpError(500, 'DB_ERROR', error.message);
  return (data as CelebrationRow | null) ?? null;
}
