import { z } from 'zod';

// Cycle-safe only while canonical-key.ts imports this module as types only.
import { compareByCodeUnit } from './canonical-key.ts';

/**
 * A modifier reference is one of exactly **three kinds, discriminated by the
 * schema** (AD-5). The kind is what the reference names; no component infers it
 * from what the reference omits.
 *
 * - `banded` carries **both** edges, always. There is no open-top form: an
 *   omitted ceiling is a floor, and a floor spans tiers.
 * - `valueless` carries **no** edges at all, and never sentinels. It is not a
 *   degenerate band.
 * - `hybrid` names every stat line of one modifier. Its shape rules and its
 *   line order are IMPLEMENTATION-NOTES §4.1's.
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
  .refine((band) => band.valueMin <= band.valueMax, {
    path: ['valueMax'],
    message: 'valueMin must not exceed valueMax: an inverted band contains no tier.',
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

/**
 * A banded line of a `hybrid` reference. It carries no `kind` and no
 * `acceptedTier`: a line takes its kind from its edges (IMPLEMENTATION-NOTES
 * §4.1). The §4.1 band rules apply to hybrid lines only.
 */
export const BandedHybridLineSchema = z
  .strictObject({
    statId: StatIdSchema,
    valueMin: z.number().nonnegative().describe('The line band floor, inclusive (§4.1).'),
    valueMax: z.number().nonnegative().describe('The line band ceiling, inclusive and required (§4.1).'),
  })
  .refine((band) => band.valueMin <= band.valueMax, {
    path: ['valueMax'],
    message: 'valueMin must not exceed valueMax: an inverted band contains no tier.',
  })
  .describe('A hybrid line with both edges (IMPLEMENTATION-NOTES §4.1).');

/** A valueless line of a `hybrid` reference: no edges at all (§4.1). */
export const ValuelessHybridLineSchema = z
  .strictObject({
    statId: StatIdSchema,
  })
  .describe('A hybrid line with no edges (IMPLEMENTATION-NOTES §4.1).');

/**
 * Both members are strict, so a line with one edge only, a `kind` or an
 * `acceptedTier` fails both (§4.1).
 */
export const HybridLineSchema = z.union([BandedHybridLineSchema, ValuelessHybridLineSchema]);

/**
 * The lines of a `hybrid` reference, checked against the §4.1 shape rules and
 * sorted by `statId` on parse, so no consumer re-sorts. The transform sits on
 * this field and not on the object, so the object stays a `ZodObject` inside
 * the `discriminatedUnion`.
 */
const HybridLinesSchema = z
  .array(HybridLineSchema)
  .min(2, { message: 'A hybrid reference names at least two lines (§4.1).' })
  .superRefine((lines, ctx) => {
    const seen = new Set<string>();
    lines.forEach((line, index) => {
      if (seen.has(line.statId)) {
        ctx.addIssue({
          code: 'custom',
          path: [index, 'statId'],
          message: `statId ${line.statId} is repeated within the hybrid reference (§4.1).`,
        });
      }
      seen.add(line.statId);
    });
  })
  .transform((lines) => [...lines].sort((a, b) => compareByCodeUnit(a.statId, b.statId)));

export const HybridModifierRefSchema = z
  .strictObject({
    kind: z.literal('hybrid'),
    lines: HybridLinesSchema,
    acceptedTier: AcceptedTierSchema.optional(),
  })
  .describe(
    'One modifier with several stat lines. `acceptedTier` labels the hybrid as a whole, never a line (AD-5, IMPLEMENTATION-NOTES §4.1).',
  );

export const ModifierRefSchema = z.discriminatedUnion('kind', [
  BandedModifierRefSchema,
  ValuelessModifierRefSchema,
  HybridModifierRefSchema,
]);

export type BandedModifierRef = z.infer<typeof BandedModifierRefSchema>;
export type ValuelessModifierRef = z.infer<typeof ValuelessModifierRefSchema>;
export type BandedHybridLine = z.infer<typeof BandedHybridLineSchema>;
export type ValuelessHybridLine = z.infer<typeof ValuelessHybridLineSchema>;
export type HybridLine = z.infer<typeof HybridLineSchema>;
export type HybridModifierRef = z.infer<typeof HybridModifierRefSchema>;
export type ModifierRef = z.infer<typeof ModifierRefSchema>;
/** A reference that names one `statId`: the kinds whose `.statId` a reader may read. */
export type SingleLineModifierRef = BandedModifierRef | ValuelessModifierRef;
