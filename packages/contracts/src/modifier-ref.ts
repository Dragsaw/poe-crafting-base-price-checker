import { z } from 'zod';

/**
 * A modifier reference is one of exactly **two kinds, discriminated by the
 * schema** (AD-5). The kind is what the reference names; no component infers it
 * from what the reference omits.
 *
 * - `banded` carries **both** edges, always. There is no open-top form: an
 *   omitted ceiling is a floor, and a floor spans tiers.
 * - `valueless` carries **no** edges at all, and never sentinels. It is not a
 *   degenerate band.
 */

export const StatIdSchema = z
  .string()
  .min(1)
  .describe(
    "A trade stat id, verbatim as `catalogue/stats.json` spells it (e.g. `explicit.stat_1509134228`). A reference names a stat line, not a game modifier.",
  );

export type StatId = z.infer<typeof StatIdSchema>;

/**
 * Display-only, on **both** arms and unused on `valueless` (AD-5). Four
 * prohibitions ride with it: `core` and `sync` never read it, nothing validates
 * it against a band, nothing validates its spelling, and it is never part of a
 * canonical key.
 */
export const AcceptedTierSchema = z
  .string()
  .describe(
    'A display-only free label such as "T1" or "T1-T2". Nothing validates it, joins it to the weights file, or keys on it (AD-5).',
  );

export const BandedModifierRefSchema = z
  .strictObject({
    kind: z.literal('banded'),
    statId: StatIdSchema,
    valueMin: z
      .number()
      .describe('The band floor, inclusive. A `number`, never an integer: the lattice the trade filter compares on may be finer than the integers.'),
    valueMax: z
      .number()
      .describe('The band ceiling, inclusive and **required**. There is no open-top form (AD-5).'),
    acceptedTier: AcceptedTierSchema.optional(),
  })
  .describe('An inclusive, closed band over the value the trade stat filter compares (AD-5).');

export const ValuelessModifierRefSchema = z
  .strictObject({
    kind: z.literal('valueless'),
    statId: StatIdSchema,
    acceptedTier: AcceptedTierSchema.optional(),
  })
  .describe(
    'A modifier that rolls no number. No edges at all, and no component may give it sentinel edges (AD-5).',
  );

export const ModifierRefSchema = z.discriminatedUnion('kind', [
  BandedModifierRefSchema,
  ValuelessModifierRefSchema,
]);

export type BandedModifierRef = z.infer<typeof BandedModifierRefSchema>;
export type ValuelessModifierRef = z.infer<typeof ValuelessModifierRefSchema>;
export type ModifierRef = z.infer<typeof ModifierRefSchema>;
