/**
 * GET /api/admin/settings   — read current settings.
 * PATCH /api/admin/settings — update settings (default window hours, maintenance, password).
 */

import { NextResponse, type NextRequest } from 'next/server';
import { apiHandler, HttpError } from '@/lib/api/handler';
import { SettingsPatchSchema } from '@/lib/validation/admin';
import { readSettings, writeSetting } from '@/lib/db/settings';
import { hashPasscode, verifyPasscode } from '@/lib/passcode';
import { env } from '@/lib/env';

export const GET = apiHandler(async () => {
  const settings = await readSettings();
  return NextResponse.json({
    default_activation_window_hours: settings.default_activation_window_hours,
    maintenance_mode: settings.maintenance_mode,
    has_admin_password_hash: !!settings.admin_password_hash,
  });
});

export const PATCH = apiHandler(async (req: NextRequest) => {
  const body = await req.json().catch(() => null);
  const parsed = SettingsPatchSchema.safeParse(body);
  if (!parsed.success) {
    throw new HttpError(400, 'VALIDATION_FAILED', 'Invalid settings patch', parsed.error.issues);
  }
  const input = parsed.data;

  if (input.default_activation_window_hours !== undefined) {
    await writeSetting('default_activation_window_hours', input.default_activation_window_hours);
  }
  if (input.maintenance_mode !== undefined) {
    await writeSetting('maintenance_mode', input.maintenance_mode);
  }
  if (input.admin_password_new) {
    // Require current password to change it.
    const current = await readSettings();
    const reference = current.admin_password_hash ?? env.ADMIN_PASSWORD_HASH;
    let currentOk = false;
    if (reference) {
      currentOk = await verifyPasscode(input.admin_password_current ?? '', reference);
    } else if (env.ADMIN_PASSWORD) {
      currentOk = (input.admin_password_current ?? '') === env.ADMIN_PASSWORD;
    }
    if (!currentOk) {
      throw new HttpError(401, 'INVALID_CREDENTIALS', 'Current password does not match.');
    }
    const hash = await hashPasscode(input.admin_password_new);
    await writeSetting('admin_password_hash', hash);
  }
  return NextResponse.json({ ok: true });
});
