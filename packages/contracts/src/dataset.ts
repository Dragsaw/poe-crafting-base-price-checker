import { z } from 'zod';

import { PriceObservationSchema } from './price-observation.ts';
import { IsoTimestampSchema, LeagueIdSchema } from './primitives.ts';

/** The reasons a `not-yet-synced` state carries (FR-9; AD-9, AD-19, AD-20). */
export const NotYetSyncedReasonSchema = z
  .enum(['never-synced', 'league-mismatch', 'no-exchange-rate'])
  .describe(
    '`never-synced` (AD-9), `league-mismatch` (AD-19, FR-31) or `no-exchange-rate` (AD-20, FR-23). Displayed, not merely stored (FR-9).',
  );

export type NotYetSyncedReason = z.infer<typeof NotYetSyncedReasonSchema>;

/** Four-state price; the observation lives inside the `priced` arm so absence is structural (AD-9). */
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

/** The latest observation per tracked entry (AD-19). A failed request stamps only `lastAttemptedAt`, and a never-synced entry has no placeholder (AD-9). */
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
