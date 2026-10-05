import { z } from 'zod';

import { LeagueIdSchema } from './primitives.ts';

// The authority for the run-start league gate (AD-19, FR-32). Loose like the catalogue payloads:
// strict would refuse a live response over a field GGG added. Only `id` is read, byte for byte.
export const LeagueEntrySchema = z.looseObject({
  id: LeagueIdSchema,
});

export const LeaguesPayloadSchema = z.looseObject({
  result: z.array(LeagueEntrySchema),
});

export type LeagueEntry = z.infer<typeof LeagueEntrySchema>;
export type LeaguesPayload = z.infer<typeof LeaguesPayloadSchema>;
