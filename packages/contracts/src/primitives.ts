import { z } from 'zod';

/**
 * Scalars several concepts share. They live together because a second spelling
 * of "an ISO-8601 UTC timestamp" is exactly the drift `contracts` exists to
 * prevent (AD-3).
 */

/**
 * All persisted timestamps are ISO-8601 **UTC** strings (Consistency
 * Conventions, *Dates & time*). An offset form is rejected: two writers using
 * two offsets produce two spellings of one instant, and a byte-wise diff of a
 * data file then shows noise rather than changed data.
 */
export const IsoTimestampSchema = z.iso
  .datetime()
  .describe('An ISO-8601 UTC instant, e.g. 2026-09-20T12:00:00Z. Never an offset form.');

export type IsoTimestamp = z.infer<typeof IsoTimestampSchema>;

/**
 * A league id as the trade API spells it. Live ids carry spaces ("Forbidden
 * Rites"), which is why AD-24 percent-encodes the segment at the URL and never
 * here.
 */
export const LeagueIdSchema = z
  .string()
  .min(1)
  .describe("The active league id, verbatim as the trade API's leagues endpoint spells it.");

export type LeagueId = z.infer<typeof LeagueIdSchema>;

/**
 * A quantity denominated in divine — the one unit that crosses a package
 * boundary (AD-20). `sync` rounds to 4 decimal places once, at the point of
 * normalisation; `core` never re-rounds (Consistency Conventions, *Numeric
 * precision*). The schema does not enforce the rounding, because a value
 * arriving unrounded is a `sync` defect to fix rather than a file to refuse.
 */
export const DivineAmountSchema = z
  .number()
  .positive()
  .describe(
    'A value in divine (AD-20), rounded to 4 decimal places once, in `sync`. Strictly positive: a hand-typed `0` in currencies.json would zero every normalised price and collapse AD-17’s craftCost term, and a negative rate would invert them — neither is detectable downstream, because every artifact stays schema-valid under both.',
  );

export type DivineAmount = z.infer<typeof DivineAmountSchema>;

/**
 * A game item level. Declared, never inferred or adjusted (AD-5).
 */
export const ItemLevelSchema = z
  .int()
  .min(1)
  .describe('A declared item level floor. No component derives or adjusts it (AD-5).');

export type ItemLevel = z.infer<typeof ItemLevelSchema>;
