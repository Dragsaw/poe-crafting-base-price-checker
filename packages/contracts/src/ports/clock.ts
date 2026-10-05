/** The clock effect (AD-1): the caller passes time in, so runs order alike (AD-7, NFR-3). */

export interface ClockPort {
  /** The current instant as an ISO-8601 UTC string (Consistency Conventions). */
  now(): string;
}
