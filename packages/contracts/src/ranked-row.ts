import { z } from 'zod';

import { BaseTypeIdSchema } from './base-type.ts';
import { CurrencyIdSchema } from './currency-rate.ts';
import { PriceObservationSchema } from './price-observation.ts';
import { DivineAmountSchema, IsoTimestampSchema, ItemLevelSchema } from './primitives.ts';
import { CurationStatusSchema } from './tracked-entry.ts';

/**
 * The three-value Provenance order (AD-10), weakest first: `absent` <
 * `uniform-prior` < `measured`. `absent` comes only from a `partial` pool and
 * never rides on a ranked row.
 */
export const ProvenanceSchema = z.enum(['absent', 'uniform-prior', 'measured']);

/**
 * One row of the ranking `core` derives in the browser on every input change
 * (AD-4, AD-17). No artifact persists it: it is a read-time value, and `web`
 * renders it without computing any term of it.
 *
 * A discriminated union on `kind`, one arm per AD-5 arm: `raw` and `crafted`.
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

/**
 * A recipe `core` could not cost (AD-20): a currency of the recipe has no rate,
 * or only a rate from another league. Never a `0` (FR-26).
 */
export const UncostableSchema = z
  .strictObject({
    kind: z.literal('uncostable'),
    currencyId: CurrencyIdSchema.describe('The first currency of the recipe, in file order, with no active-league rate.'),
  })
  .describe('An uncostable recipe: the Craft Cost is unavailable, never zero (AD-20, FR-26).');

/**
 * One term of a crafted EV (AD-17): a priced, unpruned tracked entry of the
 * Item Class whose gross price is at or above the threshold.
 */
export const CraftedSummandSchema = z
  .strictObject({
    entryKey: z.string().min(1).describe('The tracked entry’s canonical key (IMPLEMENTATION-NOTES.md §4.1).'),
    probability: z
      .number()
      .min(0)
      .max(1)
      .describe('`combinationProbability` under the recipe (IMPLEMENTATION-NOTES.md §9, §11), verbatim.'),
    priceDivine: DivineAmountSchema.describe('The active-league observed price, verbatim.'),
    contribution: z.number().min(0).describe('`probability × priceDivine`.'),
  })
  .describe('One summand of a crafted EV (AD-17).');

/**
 * The `crafted` arm: one `(Item Class, recipe)` pair (AD-17). `grossPayout` is
 * the sum of the summands' contributions; `ev` is `grossPayout − craftCost`,
 * subtracted once. A class with no surviving summand ranks at `−craftCost` with
 * `summands: []`. An uncostable recipe leaves `ev` `null`: the pair is still
 * ordered within its branch, by `grossPayout` (EXPERIENCE.md state 35).
 */
export const CraftedRankedRowSchema = z
  .strictObject({
    kind: z.literal('crafted'),
    classKey: z
      .string()
      .min(1)
      .describe('The serialised Item Class key, `["crafted", categoryId, className]`: the canonical key’s class prefix.'),
    categoryId: z.string().min(1),
    className: z.string().min(1),
    itemLevelMin: ItemLevelSchema.describe('The one floor every crafted entry on the class declares (AD-17).'),
    recipeId: z.string().min(1),
    grossPayout: z.number().min(0).describe('Σ contribution over `summands`.'),
    craftCost: z
      .union([z.number().min(0), UncostableSchema])
      .describe('Σ quantity × rate over the recipe’s currencies, in divine; or uncostable (AD-20).'),
    ev: z.number().nullable().describe('`grossPayout − craftCost`; `null` exactly when the recipe is uncostable.'),
    summands: z.array(CraftedSummandSchema).describe('By contribution descending, then canonical key.'),
    provenance: ProvenanceSchema.exclude(['absent']).describe(
      'The weakest Provenance over the pair’s inputs: the recipe’s eligible set over both slots (AD-10). A ranked row is never absent.',
    ),
    asOf: IsoTimestampSchema.optional().describe(
      'The oldest timestamp of the pair’s inputs: each summand’s observedAt and each used rate’s asOf. Unset when there is none (AD-10).',
    ),
  })
  .describe('A ranked `(Item Class, recipe)` pair (AD-17).');

export const RankedRowSchema = z
  .discriminatedUnion('kind', [RawRankedRowSchema, CraftedRankedRowSchema])
  .superRefine((row, ctx) => {
    if (row.kind === 'crafted' && (row.ev === null) !== (typeof row.craftCost !== 'number')) {
      ctx.addIssue({
        code: 'custom',
        path: ['ev'],
        message: 'a crafted ev is null exactly when its craftCost is uncostable (AD-20)',
      });
    }
  })
  .describe('One ranked row, computed at read time by `core` (AD-4, AD-17).');

export type Provenance = z.infer<typeof ProvenanceSchema>;
export type RawRankedRow = z.infer<typeof RawRankedRowSchema>;
export type CraftedRankedRow = z.infer<typeof CraftedRankedRowSchema>;
export type CraftedSummand = z.infer<typeof CraftedSummandSchema>;
export type Uncostable = z.infer<typeof UncostableSchema>;
export type RankedRow = z.infer<typeof RankedRowSchema>;
