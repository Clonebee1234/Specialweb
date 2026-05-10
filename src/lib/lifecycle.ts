/**
 * Pure lifecycle-gate function.
 *
 * Maps `(status, now, activate_at, expires_at)` to one of five user-facing
 * lifecycle states. This is the *only* function allowed to decide what a
 * recipient sees; every API route and the /c/[shortCode] page call into it.
 *
 * It must be a total function — it never throws — because the recipient path
 * is safety-critical: any exception here would leak content by falling back
 * to a more permissive branch. Instead, we enumerate every combination
 * explicitly and treat "unexpected" states as `not_found`.
 *
 * Validates Requirement 20 (Lifecycle gate totality) and Requirements 10.1–10.7.
 */

import type { CelebrationStatus } from '@/lib/supabase/types';

export type LifecycleState = 'pending' | 'pre_activation' | 'active' | 'ended' | 'not_found';

export type LifecycleGateInput = {
  status: CelebrationStatus | null;
  now: Date;
  activate_at: Date | null;
  expires_at: Date | null;
};

export type LifecycleGateResult = {
  state: LifecycleState;
  /**
   * Populated only when `state === 'pre_activation'` so the gate screen can
   * render the localized countdown. NEVER set for any other state to avoid
   * leaking a celebration's timing before it's allowed to be visible.
   */
  activate_at?: Date;
};

export function gate(input: LifecycleGateInput): LifecycleGateResult {
  const { status, now, activate_at, expires_at } = input;

  if (!status || status === 'deleted') return { state: 'not_found' };

  if (status === 'pending') return { state: 'pending' };

  if (status === 'inactive') return { state: 'ended' };

  // status === 'active' from here on. Both timestamps are required.
  if (!activate_at || !expires_at) return { state: 'not_found' };

  if (now.getTime() < activate_at.getTime()) {
    return { state: 'pre_activation', activate_at };
  }
  if (now.getTime() >= expires_at.getTime()) {
    return { state: 'ended' };
  }
  return { state: 'active' };
}
