import { STALE_LOCK_AFTER_MS } from '../lock.ts';

/** The two `notBefore` formulas, capped at `staleLockAfter` (a crashed run's lock). */
export function notBeforeAfter429(now: string, retryAfterMs: number): string {
  return new Date(Date.parse(now) + Math.min(retryAfterMs, STALE_LOCK_AFTER_MS)).toISOString();
}

function notBeforeAfterAbort(now: string): string {
  return new Date(Date.parse(now) + STALE_LOCK_AFTER_MS).toISOString();
}

/** The hold-off a failed run publishes: after an abort, after a latched 429, or none. */
export function failureNotBefore(now: string, isRejected: boolean, latchedMs: number | undefined): string | undefined {
  if (isRejected) {
    return notBeforeAfterAbort(now);
  }
  return latchedMs === undefined ? undefined : notBeforeAfter429(now, latchedMs);
}
