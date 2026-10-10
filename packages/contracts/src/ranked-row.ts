import { z } from 'zod';

import { BaseTypeIdSchema } from './base-type.ts';
import { CurrencyIdSchema } from './currency-rate.ts';
import { PriceObservationSchema } from './price-observation.ts';
import { PriceTrustSchema } from './ranked-row/price-trust.ts';
import { DivineAmountSchema, IsoTimestampSchema, ItemLevelSchema } from './primitives.ts';
import { CurationStatusSchema } from './tracked-entry.ts';

/** Weakest first (AD-10). `absent` never rides on a ranked row. */
export const ProvenanceSchema = z.enum(['absent', 'uniform-prior', 'measured']);

/** Read-time only, never persisted (AD-4, AD-17); a raw EV is the unrounded price (FR-3). */
export const RawRankedRowSchema = z
  .strictObject({
    kind: z.literal('raw'),
    entryKey: z
      .string()
      .min(1)
      .describe('The tracked entry’s canonical key.'),
    baseTypeId: BaseTypeIdSchema,
    categoryId: z.string().min(1).describe('The tracked entry’s `categoryId`, for the appendix’s raw-ranks note (FR-4 state 16).'),
    className: z.string().min(1).describe('The tracked entry’s `className`, for the appendix’s raw-ranks note (FR-4 state 16).'),
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
    trust: PriceTrustSchema.describe('The verdict of the row’s one entry (AD-17, *Price trust*).'),
  })
  .describe('A ranked Raw Base (AD-17).');

/** A recipe with a currency lacking an active-league rate (AD-20); never a `0` (FR-26). */
export const UncostableSchema = z
  .strictObject({
    kind: z.literal('uncostable'),
    currencyId: CurrencyIdSchema.describe('The first currency of the recipe, in file order, with no active-league rate.'),
  })
  .describe('An uncostable recipe: the Craft Cost is unavailable, never zero (AD-20, FR-26).');

export const CraftedSummandSchema = z
  .strictObject({
    entryKey: z.string().min(1).describe('The tracked entry’s canonical key.'),
    probability: z
      .number()
      .min(0)
      .max(1)
      .describe('`combinationProbability` under the recipe, verbatim.'),
    priceDivine: DivineAmountSchema.describe('The active-league observed price, verbatim.'),
    contribution: z.number().min(0).describe('`probability × priceDivine`.'),
    trust: PriceTrustSchema.describe('The summand entry’s own verdict (AD-17, *Price trust*).'),
  })
  .describe('One summand of a crafted EV (AD-17).');

export const CraftedCombinationSchema = z
  .strictObject({
    entryKey: z.string().min(1).describe('The tracked entry’s canonical key.'),
    trust: PriceTrustSchema.describe('The combination entry’s own verdict (AD-17, *Price trust*).'),
  })
  .describe('A non-pruned entry of the class that is not a summand: below the threshold, pending or broken (AD-17).');

/** An uncostable recipe has `ev` null and still orders by `grossPayout` (EXPERIENCE.md 35). */
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
    combinations: z
      .array(CraftedCombinationSchema)
      .describe('Below-threshold, then pending, then broken, then canonical key.'),
    provenance: ProvenanceSchema.exclude(['absent']).describe(
      'The weakest Provenance over the pair’s inputs: the recipe’s eligible set over both slots (AD-10). A ranked row is never absent.',
    ),
    asOf: IsoTimestampSchema.optional().describe(
      'The oldest summand `observedAt` (AD-10). Unset when there is no summand.',
    ),
    lastAttemptedAt: IsoTimestampSchema.optional().describe(
      'Set only when there is no summand: the oldest `lastAttemptedAt` among the class’s non-pruned entries that have one (AD-10). With `asOf` also unset, the class was never attempted.',
    ),
    trust: PriceTrustSchema.describe('The first matching crafted rule of *Price trust* (AD-17).'),
  })
  .describe('A ranked `(Item Class, recipe)` pair (AD-17).');

export const RankedRowSchema = z
  .discriminatedUnion('kind', [RawRankedRowSchema, CraftedRankedRowSchema])
  .superRefine((row, context) => {
    if (row.kind === 'crafted' && (row.ev === null) !== (typeof row.craftCost !== 'number')) {
      context.addIssue({
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
export type CraftedCombination = z.infer<typeof CraftedCombinationSchema>;
export type Uncostable = z.infer<typeof UncostableSchema>;
export type RankedRow = z.infer<typeof RankedRowSchema>;
