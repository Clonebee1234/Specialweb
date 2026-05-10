/**
 * DELETE /api/admin/celebrations/[id]/photos/[idx]
 *
 * Removes a single photo: splice it out of the JSONB array and remove the
 * underlying Storage object. If the storage delete fails we leave the JSONB
 * untouched and return 502 (Req 17.5/17.7).
 */

import { NextResponse, type NextRequest } from 'next/server';
import { apiHandler, HttpError } from '@/lib/api/handler';
import { findById, updatePhotos } from '@/lib/db/celebrations';
import { deleteObject } from '@/lib/db/storage';

export const DELETE = apiHandler<{ id: string; idx: string }>(
  async (_req: NextRequest, { params }) => {
    const row = await findById(params.id);
    if (!row) throw new HttpError(404, 'NOT_FOUND', 'Celebration not found.');
    const idx = Number(params.idx);
    if (!Number.isInteger(idx) || idx < 0 || idx >= row.photos.length) {
      throw new HttpError(400, 'VALIDATION_FAILED', 'Invalid photo index.');
    }
    const target = row.photos[idx]!;
    const path = extractStoragePath(target.url, row.short_code);
    if (path) await deleteObject(path);
    const remaining = row.photos.filter((_, i) => i !== idx).map((p, i) => ({ ...p, order: i + 1 }));
    await updatePhotos(row.id, remaining);
    return NextResponse.json({ ok: true, photos: remaining });
  },
);

function extractStoragePath(publicUrl: string, shortCode: string): string | null {
  const match = publicUrl.match(new RegExp(`/celebrations/(${shortCode}/[^?#]+)`));
  return match && match[1] ? match[1] : null;
}
