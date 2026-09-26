import { z } from 'zod';

import { LeagueIdSchema } from './primitives.ts';

/**
 * `/api/trade2/data/leagues` — the leagues the trade API carries, the authority
 * the run-start league gate checks `config.league` against (AD-19, FR-32).
 *
 * Loose for the same reason as the catalogue payloads beside it: a captured
 * third-party response carries fields this product does not consume (`realm`,
 * `text`), and a strict parse would refuse a live response over a field GGG
 * added. Only `id` is read, and it is compared byte for byte.
 */
export const LeagueEntrySchema = z.looseObject({
  id: LeagueIdSchema,
});

export const LeaguesPayloadSchema = z.looseObject({
  result: z.array(LeagueEntrySchema),
});

export type LeagueEntry = z.infer<typeof LeagueEntrySchema>;
export type LeaguesPayload = z.infer<typeof LeaguesPayloadSchema>;
