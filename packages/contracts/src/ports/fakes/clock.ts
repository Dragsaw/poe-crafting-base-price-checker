import type { ClockPort } from '../clock.ts';

/**
 * A pure in-memory `ClockPort`. Time is a passed-in value everywhere in this
 * system (AD-1, NFR-3), so the fake simply holds the instant it was told.
 */

export interface FakeClockPort extends ClockPort {
  /** Moves the clock to a new ISO-8601 UTC instant. */
  set(instant: string): void;
}

export function createFakeClockPort(instant: string): FakeClockPort {
  let current = instant;

  return {
    set(next) {
      current = next;
    },
    now() {
      return current;
    },
  };
}
