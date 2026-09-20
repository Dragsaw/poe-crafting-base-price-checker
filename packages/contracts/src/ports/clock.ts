/**
 * The clock effect (AD-1). No module in `core` reads the clock; the caller
 * passes time in as a value, which is what makes a dry run and a real run
 * produce the same order (AD-7, NFR-3).
 */

export interface ClockPort {
  /** The current instant as an ISO-8601 UTC string (Consistency Conventions). */
  now(): string;
}
