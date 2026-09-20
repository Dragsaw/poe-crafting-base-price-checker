import { z } from 'zod';

import { DivineAmountSchema, IsoTimestampSchema, LeagueIdSchema } from './primitives.ts';

export const CurrencyIdSchema = z
  .string()
  .min(1)
  .describe("A currency id, verbatim as `catalogue/static.json` spells it (e.g. `exalted`, `divine`).");

export type CurrencyId = z.infer<typeof CurrencyIdSchema>;

/**
 * **`rate` is divine per one unit of the named currency.** The orientation is
 * repeated here, in the schema, because `contracts` is built first by whoever
 * holds neither side of the calculation (AD-20).
 *
 * A listing of `n` units normalises to `n × rate`; a recipe spending `q` of a
 * currency costs `q × rate`. The inverse reading is the same number's
 * reciprocal and **every artifact stays schema-valid under it**, so nothing
 * downstream can detect the swap — `sync` and `core` would simply disagree and
 * every crafted `EV` would come out deeply negative.
 *
 * Each rate declares **its own `league` and its own `asOf`**, and `sync` copies
 * both through unchanged. `sync` must not stamp a hand-maintained rate with the
 * active league: that would relabel last league's number as current on the first
 * run after a reset (AD-19, AD-20).
 */
export const CurrencyRateSchema = z
  .strictObject({
    currencyId: CurrencyIdSchema,
    rate: DivineAmountSchema.describe(
      'Divine per ONE unit of the named currency. A listing of n units normalises to n * rate; a recipe spending q costs q * rate. Divine’s own rate is always exactly 1 (AD-20).',
    ),
    source: z
      .string()
      .min(1)
      .describe('Where the rate came from. Hand-maintained rates are `measured` under AD-10.'),
    league: LeagueIdSchema.describe(
      'The league the rate was observed in — the file’s own value, copied through unchanged and never stamped by `sync` (AD-20).',
    ),
    asOf: IsoTimestampSchema.describe(
      'When the rate was observed — the file’s own value, copied through unchanged. It enters AD-10’s oldest-timestamp propagation like any other input.',
    ),
  })
  .describe('An exchange observation: divine per one unit of the named currency (AD-20).');

export type CurrencyRate = z.infer<typeof CurrencyRateSchema>;
