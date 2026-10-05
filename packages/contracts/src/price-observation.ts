import { z } from 'zod';

import { CurrencyRateSchema } from './currency-rate.ts';
import { DivineAmountSchema, IsoTimestampSchema, LeagueIdSchema } from './primitives.ts';

/** Exists only where there is an observation (AD-9); `strictObject` keeps attempt fields off it. */
export const PriceObservationSchema = z
  .strictObject({
    league: LeagueIdSchema.describe(
      'The league the observation was made in. `core` refuses an observation whose league is not the active one (AD-19).',
    ),
    observedAt: IsoTimestampSchema.describe('When the observation was made.'),
    priceDivine: DivineAmountSchema.describe(
      'The median of the cheapest listings after normalisation to divine. On an even sample the median is the LOWER of the two middle values, never their mean (AD-16, IMPLEMENTATION-NOTES.md §4.3).',
    ),
    sampleSize: z
      .int()
      .min(1)
      .describe(
        'The number of listings actually returned, not the number requested. Fewer than 10 is valid and records the true count; zero is `no-listings`, never an observation (AD-16).',
      ),
    exchangeObservation: CurrencyRateSchema.describe(
      'The exchange observation used to normalise this price — rate, source, league and timestamp. It participates in AD-10’s propagation like any other input (AD-20).',
    ),
  })
  .describe(
    'An observed price, normalised to divine. Every price in the system is an ASKING price; the system never observes a sale (AD-12).',
  );

export type PriceObservation = z.infer<typeof PriceObservationSchema>;
