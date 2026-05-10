/**
 * Time helpers — all math is in UTC, all values are either `Date` or ISO
 * strings. The clock is injectable so tests can freeze or fast-forward.
 */

export type Clock = { now(): Date };

export const systemClock: Clock = {
  now: () => new Date(),
};

let activeClock: Clock = systemClock;

/** @internal Used by tests; never call from app code. */
export function __setClockForTesting(clock: Clock | null): void {
  activeClock = clock ?? systemClock;
}

/** Returns the current instant in UTC (`Date`). */
export function nowUtc(): Date {
  return activeClock.now();
}

/** Returns an ISO 8601 string in UTC (e.g. `2025-11-20T22:00:00.000Z`). */
export function nowUtcIso(): string {
  return nowUtc().toISOString();
}

/** `ts + h hours` as a new `Date`. Works with either `Date` or ISO string input. */
export function plusHours(ts: Date | string, h: number): Date {
  const base = typeof ts === 'string' ? new Date(ts) : new Date(ts.getTime());
  base.setTime(base.getTime() + h * 60 * 60 * 1000);
  return base;
}

/** `ts + m minutes` as a new `Date`. */
export function plusMinutes(ts: Date | string, m: number): Date {
  const base = typeof ts === 'string' ? new Date(ts) : new Date(ts.getTime());
  base.setTime(base.getTime() + m * 60 * 1000);
  return base;
}

/** `now + m minutes` convenience. */
export function minutesFromNow(m: number): Date {
  return plusMinutes(nowUtc(), m);
}

/** `a < b` comparator accepting either `Date` or ISO string. */
export function isBefore(a: Date | string, b: Date | string): boolean {
  const aTime = typeof a === 'string' ? Date.parse(a) : a.getTime();
  const bTime = typeof b === 'string' ? Date.parse(b) : b.getTime();
  return aTime < bTime;
}

/**
 * Validates that an ISO-looking string actually parses to a real UTC instant.
 * Returns the parsed `Date` or null.
 */
export function parseIso(value: string): Date | null {
  const t = Date.parse(value);
  if (Number.isNaN(t)) return null;
  return new Date(t);
}
