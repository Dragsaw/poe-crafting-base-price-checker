import { z } from 'zod';

import { PriceObservationSchema } from './price-observation';
import { IsoTimestampSchema, LeagueIdSchema } from './primitives';

/**
 * The dataset entry. It is declared here and not left to Story 1.8, because
 * AD-9 pins `lastSearchId`, `lastSearchLeague`, `lastAttemptedAt` and the four
 * Price States to this shape, and none of the named entity schemas is it —
 * `contracts` would otherwise land with `PriceObservation` beside a hole.
 */

/**
 * The three reasons a `not-yet-synced` state carries. The enum is the PRD's
 * (FR-9); AD-9, AD-19 and AD-20 supply the three causes.
 */
export const NotYetSyncedReasonSchema = z
  .enum(['never-synced', 'league-mismatch', 'no-exchange-rate'])
  .describe(
    '`never-synced` (AD-9), `league-mismatch` (AD-19, FR-31) or `no-exchange-rate` (AD-20, FR-23). Displayed, not merely stored (FR-9).',
  );

export type NotYetSyncedReason = z.infer<typeof NotYetSyncedReasonSchema>;

/**
 * **Price is four-state, and absence is never zero, null or a missing key**
 * (AD-9). The observation lives inside the `priced` arm, so its absence is
 * structural rather than a convention a reader must remember.
 */
export const PriceStateSchema = z.discriminatedUnion('state', [
  z.strictObject({
    state: z.literal('priced'),
    observation: PriceObservationSchema,
  }),
  z.strictObject({
    state: z.literal('no-listings'),
  }),
  z.strictObject({
    state: z.literal('not-yet-synced'),
    reason: NotYetSyncedReasonSchema,
  }),
  z.strictObject({
    state: z.literal('unresolvable'),
  }),
]);

export type PriceState = z.infer<typeof PriceStateSchema>;

/**
 * One entry of `dataset.json`: the latest observation per tracked entry, and
 * nothing historical (AD-19).
 *
 * `lastSearchId` and `lastSearchLeague` sit **beside** `lastAttemptedAt`, on
 * the entry (AD-9). An attempt that issues a request but receives no answer —
 * a 429, a 5xx, a timeout — stamps `lastAttemptedAt` alone and leaves the other
 * two exactly as they were, so `lastSearchId` may legitimately be older than
 * `lastAttemptedAt`. A never-synced entry carries none of the three, and **no
 * component may give it a placeholder**.
 */
export const DatasetEntrySchema = z
  .strictObject({
    entryKey: z
      .string()
      .min(1)
      .describe('The tracked entry’s canonical key (IMPLEMENTATION-NOTES.md §4.1).'),
    price: PriceStateSchema,
    lastAttemptedAt: IsoTimestampSchema.optional().describe(
      'Present wherever `sync` issued a request. Offline work never stamps it, and a never-synced entry carries no placeholder (AD-9).',
    ),
    lastSearchId: z
      .string()
      .min(1)
      .optional()
      .describe(
        "The trade site's own search identifier — the search response's top-level `id`, stored verbatim and never parsed (AD-9, AD-16).",
      ),
    lastSearchLeague: LeagueIdSchema.optional().describe(
      'The league the stored search was issued in. AD-24 renders the outbound link only where this equals the active league.',
    ),
  })
  .describe('One tracked entry’s published state. `core` never reads the search fields (AD-9).');

export type DatasetEntry = z.infer<typeof DatasetEntrySchema>;
