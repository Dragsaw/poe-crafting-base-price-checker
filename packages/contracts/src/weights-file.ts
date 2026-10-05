import { z } from 'zod';

import { defenceLettersOf } from './class-name.ts';
import { CategoryIdSchema, ClassNameSchema } from './item-class.ts';
import { StatIdSchema } from './modifier-reference.ts';
import { IsoTimestampSchema } from './primitives.ts';
import { SchemaVersionSchema } from './schema-version.ts';

// The weights contract (WEIGHTS-FILE-SCHEMA.md, AD-11); enforces its *Validation* section. Objects
// are loose so a later additive `6.x` file loads; only the major is compared (`parseEnvelope`).
// `producer.generatedAt` is ISO-8601 UTC because the trust strip prints it as a date.

/** The weights contract this build reads. Only the major is compared. */
export const WEIGHTS_SCHEMA_VERSION = '6.1.0';

/** One verbatim `[min, max]` pair; `min > max` is a hard error. */
const RangePairSchema = z
  .tuple([z.number(), z.number()])
  .refine(([min, max]) => min <= max, {
    message: 'a range pair has min > max; each pair is [min, max] with min <= max',
  });

/** One stat line of a tier. `statId` is `null` where the producer matched no trade stat. */
export const WeightsLineSchema = z.looseObject({
  statId: StatIdSchema.nullable(),
  ranges: z
    .array(RangePairSchema)
    .max(2, {
      message: 'a line carries more than two range pairs; a stat line has at most two # (OQ-19)',
    }),
});

/** One poe2db tier of one modifier; flattening its lines loses a hybrid tier's co-occurrence. */
export const ModifierWeightSchema = z
  .looseObject({
    sourceModifierId: z.string(),
    modGroup: z
      .string({ error: 'modGroup is missing or not a string; every entry names its mutual-exclusion group' })
      .min(1, { message: 'modGroup is empty; every entry names its mutual-exclusion group' }),
    itemLevelMin: z.number(),
    tierLabel: z.string().optional(),
    weight: z.number().min(0, { message: 'weight is negative; a raw spawn weight is >= 0' }),
    weightSource: z.enum(['published', 'absent', 'not-in-game'], {
      error: 'weightSource is not "published", "absent" or "not-in-game"; it is one of the three, never inferred',
    }),
    lines: z.array(WeightsLineSchema).min(1, { message: 'lines is empty; an entry carries at least one line' }),
  })
  .superRefine((entry, context) => {
    if (entry.weightSource === 'not-in-game' && entry.weight !== 0) {
      context.addIssue({
        code: 'custom',
        path: ['weight'],
        message: `weight is ${String(entry.weight)} on a not-in-game entry; a not-in-game tier carries weight 0`,
      });
    }
    const firstIndexByStatId = new Map<string, number>();
    for (const [index, line] of entry.lines.entries()) {
      if (line.statId === null) {
        continue;
      }
      const first = firstIndexByStatId.get(line.statId);
      if (first === undefined) {
        firstIndexByStatId.set(line.statId, index);
        continue;
      }
      context.addIssue({
        code: 'custom',
        path: ['lines', index, 'statId'],
        message: `statId ${line.statId} repeats lines.${String(first)}; a statId may appear once among one entry's lines`,
      });
    }
  });

/** One `(categoryId, className, slot)` pool. A `sourceModifierId` appears once per slot. */
export const WeightsPoolSchema = z
  .looseObject({
    poolCoverage: z.enum(['complete', 'partial'], {
      error: 'poolCoverage is missing or not "complete" or "partial"; every pool declares it, with no default',
    }),
    entries: z.array(ModifierWeightSchema),
  })
  .superRefine((pool, context) => {
    const firstIndexById = new Map<string, number>();
    for (const [index, entry] of pool.entries.entries()) {
      const first = firstIndexById.get(entry.sourceModifierId);
      if (first === undefined) {
        firstIndexById.set(entry.sourceModifierId, index);
        continue;
      }
      context.addIssue({
        code: 'custom',
        path: ['entries', index, 'sourceModifierId'],
        message: `sourceModifierId repeats entries.${String(first)}; a sourceModifierId may appear once per slot`,
      });
    }
  });

/** One item class's two pools. */
export const WeightsClassPoolsSchema = z.looseObject({
  prefix: WeightsPoolSchema,
  suffix: WeightsPoolSchema,
});

/** The family before a defence-suffixed key's letters; empty means the key matches neither grammar. */
function familyOf(className: string, letterCount: number): string {
  const tokens = className.split('_');
  return tokens.slice(0, tokens.length - letterCount).join('_');
}

/** The `5.1.0` `className` grammar rule (WEIGHTS-FILE-SCHEMA.md *Validation*). */
const WeightsCategorySchema = z
  .record(ClassNameSchema, WeightsClassPoolsSchema)
  .superRefine((classes, context) => {
    const plain: string[] = [];
    const defence: string[] = [];
    const firstByLetterSet = new Map<string, string>();
    for (const className of Object.keys(classes)) {
      const letters = defenceLettersOf(className);
      if (letters === undefined) {
        plain.push(className);
        continue;
      }
      if (familyOf(className, letters.size) === '') {
        context.addIssue({
          code: 'custom',
          path: [className],
          message: `className ${className} matches neither grammar; a defence-suffixed key is <family>_<letters> with a non-empty family`,
        });
        continue;
      }
      defence.push(className);
      const letterSet = [...letters].toSorted((a, b) => Number(a > b) - Number(a < b)).join('_');
      const first = firstByLetterSet.get(letterSet);
      if (first === undefined) {
        firstByLetterSet.set(letterSet, className);
        continue;
      }
      context.addIssue({
        code: 'custom',
        path: [className],
        message: `className ${className} carries the letter set of ${first}; the defence-suffixed classes of one categoryId carry distinct letter sets`,
      });
    }
    const [firstDefence] = defence;
    const [firstPlain] = plain;
    if (firstDefence !== undefined && firstPlain !== undefined) {
      context.addIssue({
        code: 'custom',
        path: [],
        message: `defence-suffixed ${firstDefence} and plain ${firstPlain} share a categoryId; one categoryId never mixes the two grammars`,
      });
    }
  });

export const WeightsFileSchema = z.looseObject({
  schemaVersion: SchemaVersionSchema,
  gamePatch: z
    .string({ error: 'gamePatch is missing or not a string; it is operator-asserted and never defaulted' })
    .min(1, { message: 'gamePatch is empty; it is operator-asserted and never defaulted' }),
  producer: z.looseObject({
    id: z.string().min(1),
    version: z.string().optional(),
    generatedAt: IsoTimestampSchema,
    sourceUrl: z.string().optional(),
  }),
  bases: z.record(CategoryIdSchema, WeightsCategorySchema),
});

export type WeightsLine = z.infer<typeof WeightsLineSchema>;
export type ModifierWeight = z.infer<typeof ModifierWeightSchema>;
export type WeightsPool = z.infer<typeof WeightsPoolSchema>;
export type WeightsClassPools = z.infer<typeof WeightsClassPoolsSchema>;
export type WeightsFile = z.infer<typeof WeightsFileSchema>;
