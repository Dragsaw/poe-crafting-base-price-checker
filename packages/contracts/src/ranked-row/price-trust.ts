import { z } from 'zod';

/** The four states of EXPERIENCE.md *Price trust* (AD-17). */
export const PriceTrustVerdictSchema = z.enum(['current', 'rough', 'pending', 'broken']);

const WholeCountSchema = z.int().min(0);

/** Data, never a display string: EXPERIENCE.md *Price trust* owns the words for each kind. */
export const PriceTrustReasonSchema = z
  .discriminatedUnion('kind', [
    z.strictObject({ kind: z.literal('old'), days: WholeCountSchema.describe('Whole days of age, rounded down.') }),
    z.strictObject({ kind: z.literal('thin'), listings: z.int().min(1).describe('The observation’s `sampleSize`.') }),
    z.strictObject({
      kind: z.literal('no-listings'),
      days: WholeCountSchema.optional().describe('Whole days since `lastAttemptedAt`, rounded down; unset without one.'),
    }),
    z.strictObject({ kind: z.literal('never-synced') }),
    z.strictObject({ kind: z.literal('league-mismatch') }),
    z.strictObject({ kind: z.literal('no-exchange-rate') }),
    z.strictObject({ kind: z.literal('unresolvable') }),
    z.strictObject({ kind: z.literal('no-recipe') }),
    z.strictObject({ kind: z.literal('uncostable') }),
    z.strictObject({ kind: z.literal('all-broken') }),
    z.strictObject({ kind: z.literal('no-prices') }),
    z.strictObject({
      kind: z.literal('unreliable-share'),
      percent: WholeCountSchema.max(100).describe('The unreliable gross share in whole percent, rounded down.'),
    }),
  ])
  .describe('Why a price is not current (AD-17, *Price trust*).');

export const PriceTrustSchema = z
  .strictObject({
    verdict: PriceTrustVerdictSchema,
    reasons: z.array(PriceTrustReasonSchema).describe('Empty exactly when current; an old reason precedes a thin one.'),
  })
  .superRefine((trust, context) => {
    if ((trust.verdict === 'current') !== (trust.reasons.length === 0)) {
      context.addIssue({
        code: 'custom',
        path: ['reasons'],
        message: 'a verdict has no reason exactly when it is current',
      });
    }
  })
  .describe('The price-trust verdict `core` computes (AD-17, AD-10); `web` derives none.');

export type PriceTrustVerdict = z.infer<typeof PriceTrustVerdictSchema>;
export type PriceTrustReason = z.infer<typeof PriceTrustReasonSchema>;
export type PriceTrust = z.infer<typeof PriceTrustSchema>;
