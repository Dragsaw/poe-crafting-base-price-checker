import { z } from 'zod';

import { BaseTypeIdSchema } from './base-type.ts';
import { CategoryIdSchema, ClassNameSchema } from './item-class.ts';
import { ModifierReferenceSchema } from './modifier-reference.ts';
import { ItemLevelSchema } from './primitives.ts';

/** The kind is what the entry names, never an inference (AD-5). */

/** Curation Status is a schema member, not a convention (AD-12, FR-15). */
export const CurationStatusSchema = z
  .enum(['active', 'pinned', 'pruned'])
  .describe(
    '`pinned` refreshes every chunk, exempt from rotation and subject to AD-7’s cap; `pruned` is a tombstone carrying its reason; `active` rotates (AD-12).',
  );

export type CurationStatus = z.infer<typeof CurationStatusSchema>;

/** A free string on purpose: the PRD requires only that the reason be carried and shown. */
export const PrunedReasonSchema = z
  .string()
  .min(1)
  .describe('Why the entry was pruned. Free-form: carried and shown, never parsed.');

const CraftedTrackedEntrySchema = z.strictObject({
  kind: z.literal('crafted'),
  categoryId: CategoryIdSchema,
  className: ClassNameSchema,
  itemLevelMin: ItemLevelSchema,
  prefix: ModifierReferenceSchema,
  suffix: ModifierReferenceSchema,
  status: CurationStatusSchema,
  prunedReason: PrunedReasonSchema.optional(),
});

const RawTrackedEntrySchema = z.strictObject({
  kind: z.literal('raw'),
  baseTypeId: BaseTypeIdSchema,
  categoryId: CategoryIdSchema.describe('Hand-curated, outside the canonical key and never sent (AD-5).'),
  className: ClassNameSchema.describe('Hand-curated, outside the canonical key and never sent (AD-5).'),
  itemLevelMin: ItemLevelSchema,
  status: CurationStatusSchema,
  prunedReason: PrunedReasonSchema.optional(),
});

/** The prune-reason rule only: FR-16 overlap is `./overlap.ts`, cross-file checks are `core`'s. */
export const TrackedEntrySchema = z
  .discriminatedUnion('kind', [CraftedTrackedEntrySchema, RawTrackedEntrySchema])
  .superRefine((entry, context) => {
    if (entry.status === 'pruned' && entry.prunedReason === undefined) {
      context.addIssue({
        code: 'custom',
        path: ['prunedReason'],
        message: 'a pruned entry is a tombstone carrying its reason (AD-12, FR-15)',
      });
    }
    if (entry.status !== 'pruned' && entry.prunedReason !== undefined) {
      context.addIssue({
        code: 'custom',
        path: ['prunedReason'],
        message: 'only a pruned entry carries a prune reason (AD-12)',
      });
    }
  });

export type CraftedTrackedEntry = z.infer<typeof CraftedTrackedEntrySchema>;
export type RawTrackedEntry = z.infer<typeof RawTrackedEntrySchema>;
export type TrackedEntry = z.infer<typeof TrackedEntrySchema>;
