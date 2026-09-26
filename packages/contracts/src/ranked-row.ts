import { z } from 'zod';

import { BaseTypeIdSchema } from './base-type.ts';
import { PriceObservationSchema } from './price-observation.ts';
import { DivineAmountSchema, IsoTimestampSchema, ItemLevelSchema } from './primitives.ts';
import { CurationStatusSchema } from './tracked-entry.ts';

/**
 * One row of the ranking `core` derives in the browser on every input change
 * (AD-4, AD-17). No artifact persists it: it is a read-time value, and `web`
 * renders it without computing any term of it.
 *
 * A discriminated union on `kind`, one arm per AD-5 arm. Epic 3 adds the
 * `crafted` arm; this story ships the `raw` arm only.
 *
 * The `raw` arm: a Raw Base's EV **is** its observed price, unchanged — `sync`
 * rounded it to 4 decimal places once and nothing rounds it again — and its
 * Craft Cost is zero (FR-3, AD-17). A `pruned` entry never becomes a row, and a
 * row always carries the `priced` observation it was valued from. No rank
 * numeral and no display string lives here: display precision is the view's.
 */
export const RawRankedRowSchema = z
  .strictObject({
    kind: z.literal('raw'),
    entryKey: z
      .string()
      .min(1)
      .describe('The tracked entry’s canonical key (IMPLEMENTATION-NOTES.md §4.1).'),
    baseTypeId: BaseTypeIdSchema,
    itemLevelMin: ItemLevelSchema,
    status: CurationStatusSchema.exclude(['pruned']).describe(
      'A pruned entry is excluded from every ranking group, so a row is never pruned (AD-12).',
    ),
    ev: DivineAmountSchema.describe(
      'The observed price, verbatim: `observation.priceDivine`, with no rounding and no arithmetic (FR-3, AD-17).',
    ),
    craftCost: z.literal(0).describe('A Raw Base has no Craft Cost (FR-3, AD-17).'),
    observation: PriceObservationSchema.describe(
      'The active-league observation the row was valued from (AD-19).',
    ),
    lastAttemptedAt: IsoTimestampSchema.optional().describe(
      'Carried from the dataset entry where present, for the view’s freshness clock (AD-9).',
    ),
  })
  .describe('A ranked Raw Base (AD-17).');

export const RankedRowSchema = z
  .discriminatedUnion('kind', [RawRankedRowSchema])
  .describe('One ranked row, computed at read time by `core` (AD-4, AD-17).');

export type RawRankedRow = z.infer<typeof RawRankedRowSchema>;
export type RankedRow = z.infer<typeof RankedRowSchema>;
