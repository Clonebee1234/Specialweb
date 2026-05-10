// Feature: celebrate-them, Property 20: Lifecycle gate function totality
// Validates: Requirements 10.1–10.7

import { describe, it, expect } from 'vitest';
import fc from 'fast-check';
import { gate, type LifecycleState } from '@/lib/lifecycle';
import type { CelebrationStatus } from '@/lib/supabase/types';

const statusArb: fc.Arbitrary<CelebrationStatus | null> = fc.constantFrom<
  CelebrationStatus | null
>('pending', 'active', 'inactive', 'deleted', null);

// Random timestamps bounded to ±10 years around epoch — enough variety to
// exercise every branch.
const dateArb = fc.integer({ min: -3.15e11, max: 3.15e11 }).map((ms) => new Date(ms));

describe('Property 20: Lifecycle gate function totality', () => {
  it('always returns a valid state, never throws, and respects the matrix', () => {
    fc.assert(
      fc.property(statusArb, dateArb, dateArb, dateArb, (status, now, activate_at, expires_at) => {
        const out = gate({ status, now, activate_at, expires_at });
        const validStates: LifecycleState[] = [
          'pending',
          'pre_activation',
          'active',
          'ended',
          'not_found',
        ];
        expect(validStates).toContain(out.state);

        // Matrix: deleted/null → not_found
        if (!status || status === 'deleted') expect(out.state).toBe('not_found');

        // pending is always pending
        if (status === 'pending') expect(out.state).toBe('pending');

        // inactive → ended
        if (status === 'inactive') expect(out.state).toBe('ended');

        // active: the pre_activation branch MAY carry activate_at; other
        // branches MUST NOT leak it.
        if (out.state !== 'pre_activation') expect(out.activate_at).toBeUndefined();
      }),
      { numRuns: 500 },
    );
  });
});
