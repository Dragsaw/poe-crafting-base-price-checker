/** The clock effect (AD-1): no `core` module reads the clock, the caller passes time in, so dry and real runs order identically (AD-7, NFR-3). */

export interface ClockPort {
  /** The current instant as an ISO-8601 UTC string (Consistency Conventions). */
  now(): string;
}
