import { z } from 'zod';

/** Scalars several concepts share: one spelling each, so `contracts` prevents drift (AD-3). */

/** Offset forms are rejected (Consistency Conventions, *Dates & time*). */
export const IsoTimestampSchema = z.iso
  .datetime()
  .describe('An ISO-8601 UTC instant, e.g. 2026-09-20T12:00:00Z. Never an offset form.');

export type IsoTimestamp = z.infer<typeof IsoTimestampSchema>;

/** Live ids carry spaces, so AD-24 percent-encodes at the URL and never here. */
export const LeagueIdSchema = z
  .string()
  .min(1)
  .describe("The active league id, verbatim as the trade API's leagues endpoint spells it.");

export type LeagueId = z.infer<typeof LeagueIdSchema>;

/** The one unit crossing a package boundary (AD-20). Rounding: Consistency Conventions, *Numeric precision*. */
export const DivineAmountSchema = z
  .number()
  .positive()
  .describe(
    'A value in divine (AD-20), rounded to 4 decimal places once, in `sync`. Strictly positive: a hand-typed `0` in currencies.json would zero every normalised price and collapse AD-17’s craftCost term, and a negative rate would invert them — neither is detectable downstream, because every artifact stays schema-valid under both.',
  );

export type DivineAmount = z.infer<typeof DivineAmountSchema>;

/** A game item level. Declared, never inferred or adjusted (AD-5). */
export const ItemLevelSchema = z
  .int()
  .min(1)
  .describe('A declared item level floor. No component derives or adjusts it (AD-5).');

export type ItemLevel = z.infer<typeof ItemLevelSchema>;
