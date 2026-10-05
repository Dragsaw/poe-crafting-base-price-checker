import type { ClockPort } from '../clock.ts';

/** A pure in-memory `ClockPort` holding the instant it was told (AD-1, NFR-3). */

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
