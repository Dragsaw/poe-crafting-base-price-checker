import { z } from 'zod';

import { BaseTypeIdSchema } from './base-type.ts';
import { CategoryIdSchema, ClassNameSchema } from './item-class.ts';
import { ModifierRefSchema } from './modifier-ref.ts';
import { ItemLevelSchema } from './primitives.ts';

/**
 * A tracked entry is one of exactly **two kinds, and the kind is what the entry
 * names — never an inference from what it omits** (AD-5).
 *
 * - `crafted` keys on `(categoryId, className, itemLevelMin, prefix?, suffix?)`
 *   with at least one affix present.
 * - `raw` keys on `(baseTypeId, itemLevelMin)` and **carries no affix members
 *   at all** — a stronger guarantee than two nulls, and the reason the arms are
 *   `strictObject`s.
 */

/**
 * Curation Status is a **schema member, not a convention** (AD-12, FR-15).
 */
export const CurationStatusSchema = z
  .enum(['active', 'pinned', 'pruned'])
  .describe(
    '`pinned` refreshes every chunk, exempt from rotation and subject to AD-7’s cap; `pruned` is a tombstone carrying its reason; `active` rotates (AD-12).',
  );

export type CurationStatus = z.infer<typeof CurationStatusSchema>;

/**
 * A free string, deliberately. The PRD requires only that the reason be carried
 * and shown; no enum is invented for it.
 */
export const PrunedReasonSchema = z
  .string()
  .min(1)
  .describe('Why the entry was pruned. Free-form: carried and shown, never parsed.');

export const CraftedTrackedEntrySchema = z.strictObject({
  kind: z.literal('crafted'),
  categoryId: CategoryIdSchema,
  className: ClassNameSchema,
  itemLevelMin: ItemLevelSchema,
  prefix: ModifierRefSchema.optional(),
  suffix: ModifierRefSchema.optional(),
  status: CurationStatusSchema,
  prunedReason: PrunedReasonSchema.optional(),
});

export const RawTrackedEntrySchema = z.strictObject({
  kind: z.literal('raw'),
  baseTypeId: BaseTypeIdSchema,
  itemLevelMin: ItemLevelSchema,
  status: CurationStatusSchema,
  prunedReason: PrunedReasonSchema.optional(),
});

/**
 * The two shape rules the I/O matrix fixes, and no others. FR-16's
 * within-file overlap rejection is a rule of the whole list, so it lives in
 * `TrackedFileSchema` (`./overlap.ts`); the five cross-file checks are
 * `core`'s (`cross-file.ts`), because `contracts` sees one file at a time.
 */
export const TrackedEntrySchema = z
  .discriminatedUnion('kind', [CraftedTrackedEntrySchema, RawTrackedEntrySchema])
  .superRefine((entry, ctx) => {
    if (entry.kind === 'crafted' && entry.prefix === undefined && entry.suffix === undefined) {
      ctx.addIssue({
        code: 'custom',
        message:
          'a crafted tracked entry carries at least one affix; an entry with neither prefix nor suffix is a raw entry and must name itself one (AD-5)',
      });
    }
    if (entry.status === 'pruned' && entry.prunedReason === undefined) {
      ctx.addIssue({
        code: 'custom',
        path: ['prunedReason'],
        message: 'a pruned entry is a tombstone carrying its reason (AD-12, FR-15)',
      });
    }
    if (entry.status !== 'pruned' && entry.prunedReason !== undefined) {
      ctx.addIssue({
        code: 'custom',
        path: ['prunedReason'],
        message: 'only a pruned entry carries a prune reason (AD-12)',
      });
    }
  });

export type CraftedTrackedEntry = z.infer<typeof CraftedTrackedEntrySchema>;
export type RawTrackedEntry = z.infer<typeof RawTrackedEntrySchema>;
export type TrackedEntry = z.infer<typeof TrackedEntrySchema>;
