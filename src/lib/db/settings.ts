/** Admin-settings table helpers. */

import type { SupabaseClient } from '@supabase/supabase-js';
import { getSupabaseServer } from '@/lib/supabase/server';
import { HttpError } from '@/lib/api/handler';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function db(): SupabaseClient<any, any, any> {
  return getSupabaseServer() as unknown as SupabaseClient<any, any, any>;
}

export type SettingsShape = {
  default_activation_window_hours: number;
  maintenance_mode: boolean;
  admin_password_hash: string | null;
};

const DEFAULTS: SettingsShape = {
  default_activation_window_hours: 21,
  maintenance_mode: false,
  admin_password_hash: null,
};

export async function readSettings(): Promise<SettingsShape> {
  const { data, error } = await db().from('settings').select('key,value');
  if (error) throw new HttpError(500, 'DB_ERROR', error.message);
  const result: SettingsShape = { ...DEFAULTS };
  for (const row of (data ?? []) as Array<{ key: string; value: unknown }>) {
    if (row.key === 'default_activation_window_hours' && typeof row.value === 'number') {
      result.default_activation_window_hours = row.value;
    } else if (row.key === 'maintenance_mode' && typeof row.value === 'boolean') {
      result.maintenance_mode = row.value;
    } else if (row.key === 'admin_password_hash' && typeof row.value === 'string') {
      result.admin_password_hash = row.value;
    }
  }
  return result;
}

export async function writeSetting(key: keyof SettingsShape, value: unknown): Promise<void> {
  const { error } = await db()
    .from('settings')
    .upsert({ key, value, updated_at: new Date().toISOString() });
  if (error) throw new HttpError(500, 'DB_ERROR', error.message);
}
