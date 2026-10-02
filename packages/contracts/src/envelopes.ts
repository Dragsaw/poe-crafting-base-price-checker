import { z } from 'zod';

import { canonicalKey } from './canonical-key.ts';
import { CraftRecipeSchema, RECIPE_GRADES, recipeWord } from './craft-recipe.ts';
import { CurrencyRateSchema } from './currency-rate.ts';
import { DatasetEntrySchema } from './dataset.ts';
import { IsoTimestampSchema, LeagueIdSchema } from './primitives.ts';
import {
  checkSchemaVersion,
  SchemaVersionSchema,
  SUPPORTED_SCHEMA_VERSION,
} from './schema-version.ts';
import { SyncProgressSchema } from './sync-progress.ts';
import { SyncRunReportSchema } from './sync-run-report.ts';
import { describeOverlap, NEVER_CO_OCCUR, overlapBranches } from './overlap.ts';
import { TrackedEntrySchema } from './tracked-entry.ts';
import type { CraftedTrackedEntry } from './tracked-entry.ts';
import {
  FilterCatalogueSchema,
  ItemCatalogueSchema,
  StatCatalogueSchema,
  StaticCatalogueSchema,
} from './trade-catalogue.ts';

/**
 * Every file envelope, declared here. **One versioning mechanism and one
 * unknown-major refusal, spelled once** — later stories fill the envelopes
 * rather than inventing them. Entity schemas that are members of a versioned
 * file do not repeat `schemaVersion`; the envelope carries it for them.
 */

/**
 * `data/tracked.json` — the player's curated workload (AD-12).
 *
 * One file-level rule: each `canonicalKey` (§4.1) appears once in `entries`,
 * so entries equal under it are twins whatever else differs. Each repeat is
 * one issue at its own index, naming the key and its first occurrence.
 *
 * A second rule, the shared floor (AD-17, FR-22): every non-`pruned` crafted
 * entry of one `(categoryId, className)` declares the same `itemLevelMin`. The
 * first such entry sets the class's floor; each later entry that declares
 * another is one issue at its own index, naming the class, both floors and the
 * first entry's index. `pruned` tombstones are exempt — they are never
 * summands — and a `raw` entry names no class, so it takes no part. The floor
 * is declared, never derived here (AD-5, IMPLEMENTATION-NOTES.md §8).
 *
 * A third rule, within-file overlap (FR-16, AD-17, IMPLEMENTATION-NOTES.md
 * §2.1): no two non-`pruned` crafted entries of one class overlap under
 * `overlap` with `NEVER_CO_OCCUR` — intersecting bands, both valueless, or an
 * absent affix on either side of each slot. Each pair is one issue at the
 * later entry's index, naming both canonical keys and each slot's branch. The
 * `coOccur` branch needs the weights file and is `core`'s cross-file check.
 */
export const TrackedFileSchema = z
  .strictObject({
    schemaVersion: SchemaVersionSchema,
    entries: z.array(TrackedEntrySchema),
  })
  .superRefine((file, ctx) => {
    const firstIndexByKey = new Map<string, number>();
    file.entries.forEach((entry, index) => {
      const key = canonicalKey(entry);
      const first = firstIndexByKey.get(key);
      if (first === undefined) {
        firstIndexByKey.set(key, index);
        return;
      }
      ctx.addIssue({
        code: 'custom',
        path: ['entries', index],
        message: `canonical key ${key} repeats entries.${String(first)}; a key may appear once in the tracked list`,
      });
    });
    const firstFloorByClass = new Map<string, { readonly index: number; readonly floor: number }>();
    file.entries.forEach((entry, index) => {
      if (entry.kind !== 'crafted' || entry.status === 'pruned') {
        return;
      }
      const classKey = JSON.stringify([entry.categoryId, entry.className]);
      const first = firstFloorByClass.get(classKey);
      if (first === undefined) {
        firstFloorByClass.set(classKey, { index, floor: entry.itemLevelMin });
        return;
      }
      if (first.floor === entry.itemLevelMin) {
        return;
      }
      ctx.addIssue({
        code: 'custom',
        path: ['entries', index, 'itemLevelMin'],
        message: `item class ${entry.categoryId}/${entry.className} declares itemLevelMin ${String(entry.itemLevelMin)} here and ${String(first.floor)} at entries.${String(first.index)}; the crafted entries of one item class share one floor (AD-17)`,
      });
    });
    const earlierByClass = new Map<string, { readonly index: number; readonly key: string; readonly entry: CraftedTrackedEntry }[]>();
    file.entries.forEach((entry, index) => {
      if (entry.kind !== 'crafted' || entry.status === 'pruned') {
        return;
      }
      const classKey = JSON.stringify([entry.categoryId, entry.className]);
      const earlier = earlierByClass.get(classKey) ?? [];
      const key = canonicalKey(entry);
      for (const other of earlier) {
        // A twin is the uniqueness rule's issue, not a second one here.
        if (other.key === key) {
          continue;
        }
        const branches = overlapBranches(other.entry, entry, NEVER_CO_OCCUR);
        if (branches === undefined) {
          continue;
        }
        ctx.addIssue({
          code: 'custom',
          path: ['entries', index],
          message: `entries ${other.key} (entries.${String(other.index)}) and ${key} overlap on ${describeOverlap(branches)}; one item satisfies both and would be counted twice (AD-17)`,
        });
      }
      earlier.push({ index, key, entry });
      earlierByClass.set(classKey, earlier);
    });
  });

/**
 * `data/recipes.json` — the Craft Recipes (AD-20). Absent-tolerable (AD-24).
 *
 * Three file-level rules. Each `id` appears once, the same shape as
 * `TrackedFileSchema`'s: each repeat is one issue at its own index, naming the
 * id and its first occurrence. Each recipe derives one word (`recipeWord`): a
 * recipe that mixes grades is one issue at its index. And no two recipes derive
 * the same word: each repeat is one issue at its index, naming the word and its
 * first recipe (Story 3.4 Decision, UX memlog 233; an AD-3 refusal). A repeated
 * id is reported once, as a repeated id.
 */
export const RecipesFileSchema = z
  .strictObject({
    schemaVersion: SchemaVersionSchema,
    recipes: z.array(CraftRecipeSchema),
  })
  .superRefine((file, ctx) => {
    const firstIndexById = new Map<string, number>();
    const firstIndexByWord = new Map<string, number>();
    file.recipes.forEach((recipe, index) => {
      const first = firstIndexById.get(recipe.id);
      if (first === undefined) {
        firstIndexById.set(recipe.id, index);
        const word = recipeWord(recipe);
        if (word === undefined) {
          ctx.addIssue({
            code: 'custom',
            path: ['recipes', index],
            message: `recipe ${recipe.id} mixes grades across its currencies; every currency id shares one grade prefix (${RECIPE_GRADES.map((grade) => `${grade}-`).join(', ')}) or none`,
          });
          return;
        }
        const firstWithWord = firstIndexByWord.get(word);
        if (firstWithWord === undefined) {
          firstIndexByWord.set(word, index);
          return;
        }
        ctx.addIssue({
          code: 'custom',
          path: ['recipes', index],
          message: `recipe ${recipe.id} reads ${word}, as recipes.${String(firstWithWord)} does; two recipes may not derive one word`,
        });
        return;
      }
      ctx.addIssue({
        code: 'custom',
        path: ['recipes', index],
        message: `recipe id ${recipe.id} repeats recipes.${String(first)}; an id may appear once in recipes.json`,
      });
    });
  });

/** `data/currencies.json` — hand-maintained rates, read and never fetched (AD-20). */
export const CurrenciesFileSchema = z.strictObject({
  schemaVersion: SchemaVersionSchema,
  rates: z.array(CurrencyRateSchema),
});

/**
 * `data/config.json` — the active league, `minChunkSearches` and
 * `schemaVersion`, **and nothing else** (AD-19). It is a player-owned file, not
 * a settings bag, which is what the `strictObject` enforces.
 */
export const ConfigFileSchema = z.strictObject({
  schemaVersion: SchemaVersionSchema,
  league: LeagueIdSchema.describe('The active league id (AD-19).'),
  minChunkSearches: z
    .int()
    .min(1)
    .describe(
      'A validation yardstick, and never a chunk bound. Read at exactly one place — AD-7’s load-time pinned cap (IMPLEMENTATION-NOTES.md §6).',
    ),
});

/**
 * `data/dataset.json` — the published snapshot, latest observation per entry (AD-19).
 *
 * One file-level rule, the same shape as `TrackedFileSchema`'s: each `entryKey`
 * appears once in `entries`, compared as an exact string, so entries with the
 * same key are twins whatever else differs. Each repeat is one issue at its own
 * index, naming the key and its first occurrence.
 */
export const DatasetFileSchema = z
  .strictObject({
    schemaVersion: SchemaVersionSchema,
    league: LeagueIdSchema.describe('The league the run was configured for.'),
    generatedAt: IsoTimestampSchema,
    entries: z.array(DatasetEntrySchema),
    currencyRates: z
      .array(CurrencyRateSchema)
      .describe(
        'The current rate set, carried here rather than in a ninth artifact so AD-24’s fetch set stays closed. `core` costs recipes from it (AD-20).',
      ),
  })
  .superRefine((file, ctx) => {
    const firstIndexByEntryKey = new Map<string, number>();
    file.entries.forEach((entry, index) => {
      const first = firstIndexByEntryKey.get(entry.entryKey);
      if (first === undefined) {
        firstIndexByEntryKey.set(entry.entryKey, index);
        return;
      }
      ctx.addIssue({
        code: 'custom',
        path: ['entries', index],
        message: `entry key ${entry.entryKey} repeats entries.${String(first)}; a key may appear once in dataset.json`,
      });
    });
  });

/** `data/sync-report.json` — figures and records (FR-25). */
export const SyncReportFileSchema = SyncRunReportSchema.extend({
  schemaVersion: SchemaVersionSchema,
});

/**
 * `data/sync-progress.json` — the keys the current pass has completed (AD-7).
 * Internal to `sync`: `web` never fetches it.
 */
export const SyncProgressFileSchema = SyncProgressSchema.extend({
  schemaVersion: SchemaVersionSchema,
});

/**
 * `data/catalogue/*.json` — the four committed catalogue artifacts. One
 * envelope shape over all four: the captured `result` payload with
 * `schemaVersion` beside it, so a refresh diff stays a diff of the trade API's
 * own response (AD-25).
 */
export function catalogueFileEnvelope<
  Shape extends z.ZodRawShape,
  Config extends z.core.$ZodObjectConfig,
>(payload: z.ZodObject<Shape, Config>) {
  return payload.extend({ schemaVersion: SchemaVersionSchema });
}

export const CatalogueItemsFileSchema = catalogueFileEnvelope(ItemCatalogueSchema);
export const CatalogueStatsFileSchema = catalogueFileEnvelope(StatCatalogueSchema);
export const CatalogueStaticFileSchema = catalogueFileEnvelope(StaticCatalogueSchema);
export const CatalogueFiltersFileSchema = catalogueFileEnvelope(FilterCatalogueSchema);

export type TrackedFile = z.infer<typeof TrackedFileSchema>;
export type RecipesFile = z.infer<typeof RecipesFileSchema>;
export type CurrenciesFile = z.infer<typeof CurrenciesFileSchema>;
export type ConfigFile = z.infer<typeof ConfigFileSchema>;
export type DatasetFile = z.infer<typeof DatasetFileSchema>;
export type SyncReportFile = z.infer<typeof SyncReportFileSchema>;
export type SyncProgressFile = z.infer<typeof SyncProgressFileSchema>;
export type CatalogueItemsFile = z.infer<typeof CatalogueItemsFileSchema>;
export type CatalogueStatsFile = z.infer<typeof CatalogueStatsFileSchema>;
export type CatalogueStaticFile = z.infer<typeof CatalogueStaticFileSchema>;
export type CatalogueFiltersFile = z.infer<typeof CatalogueFiltersFileSchema>;

export type EnvelopeIssues = z.ZodError['issues'];

export interface EnvelopeAccepted<T> {
  readonly ok: true;
  readonly value: T;
}

export interface EnvelopeVersionRefused {
  readonly ok: false;
  readonly reason: 'unknown-major' | 'malformed-version';
  readonly expected: string;
  readonly found: string;
}

export interface EnvelopeInvalid {
  readonly ok: false;
  readonly reason: 'invalid';
  readonly issues: EnvelopeIssues;
}

export type EnvelopeResult<T> = EnvelopeAccepted<T> | EnvelopeVersionRefused | EnvelopeInvalid;

const VersionProbeSchema = z.object({ schemaVersion: z.string() });

/**
 * The one load path for every versioned file.
 *
 * The version is read **before** the body is parsed, so an unknown major is
 * refused *rather than parsed on* (NFR-8) — a consumer that parsed first would
 * report a pile of shape errors that are really one version mismatch, and a
 * reader would go fixing fields. The refusal names **both** versions.
 */
export function parseEnvelope<S extends z.ZodType>(
  schema: S,
  data: unknown,
  expected: string = SUPPORTED_SCHEMA_VERSION,
): EnvelopeResult<z.infer<S>> {
  const probe = VersionProbeSchema.safeParse(data);
  if (!probe.success) {
    return { ok: false, reason: 'invalid', issues: probe.error.issues };
  }

  const version = checkSchemaVersion(probe.data.schemaVersion, expected);
  if (!version.ok) {
    // Exhaustive by construction: a new `checkSchemaVersion` reason leaves this
    // switch with a code path that returns nothing, which is a compile error
    // rather than a silent relabelling as `malformed-version`.
    switch (version.reason) {
      case 'unknown-major':
        return {
          ok: false,
          reason: 'unknown-major',
          expected: version.expected,
          found: version.found,
        };
      case 'malformed':
        return {
          ok: false,
          reason: 'malformed-version',
          expected: version.expected,
          found: version.found,
        };
    }
  }

  const parsed = schema.safeParse(data);
  if (!parsed.success) {
    return { ok: false, reason: 'invalid', issues: parsed.error.issues };
  }
  return { ok: true, value: parsed.data as z.infer<S> };
}
