import { z } from 'zod';

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
import { TrackedEntrySchema } from './tracked-entry.ts';
import { checkTrackedEntries } from './envelopes/tracked-file-checks.ts';
import {
  FilterCatalogueSchema,
  ItemCatalogueSchema,
  StatCatalogueSchema,
  StaticCatalogueSchema,
} from './trade-catalogue.ts';

/** Every file envelope; a member of a versioned file does not repeat `schemaVersion`. */

/** `data/tracked.json`, the curated workload (AD-12); file rules: AD-17. */
export const TrackedFileSchema = z
  .strictObject({
    schemaVersion: SchemaVersionSchema,
    entries: z.array(TrackedEntrySchema),
  })
  .superRefine((file, context) => {
    checkTrackedEntries(file.entries, context);
  });

/** The recipe grade prefixes, as the mixed-grade refusal prints them. */
const GRADE_PREFIXES = RECIPE_GRADES.map((grade) => `${grade}-`).join(', ');

/** `data/recipes.json`, absent-tolerable (AD-20, AD-24); unique `id`, one word each. */
export const RecipesFileSchema = z
  .strictObject({
    schemaVersion: SchemaVersionSchema,
    recipes: z.array(CraftRecipeSchema),
  })
  .superRefine((file, context) => {
    const firstIndexById = new Map<string, number>();
    const firstIndexByWord = new Map<string, number>();
    for (const [index, recipe] of file.recipes.entries()) {
      const first = firstIndexById.get(recipe.id);
      if (first === undefined) {
        firstIndexById.set(recipe.id, index);
        const word = recipeWord(recipe);
        if (word === undefined) {
          context.addIssue({
            code: 'custom',
            path: ['recipes', index],
            message: `recipe ${recipe.id} mixes grades across its currencies; every currency id shares one grade prefix (${GRADE_PREFIXES}) or none`,
          });
          continue;
        }
        const firstWithWord = firstIndexByWord.get(word);
        if (firstWithWord === undefined) {
          firstIndexByWord.set(word, index);
          continue;
        }
        context.addIssue({
          code: 'custom',
          path: ['recipes', index],
          message: `recipe ${recipe.id} reads ${word}, as recipes.${String(firstWithWord)} does; two recipes may not derive one word`,
        });
        continue;
      }
      context.addIssue({
        code: 'custom',
        path: ['recipes', index],
        message: `recipe id ${recipe.id} repeats recipes.${String(first)}; an id may appear once in recipes.json`,
      });
    }
  });

/** `data/currencies.json` — hand-maintained rates, read and never fetched (AD-20). */
export const CurrenciesFileSchema = z.strictObject({
  schemaVersion: SchemaVersionSchema,
  rates: z.array(CurrencyRateSchema),
});

/** `data/config.json`: active league, `minChunkSearches`, `schemaVersion`, nothing else (AD-19). */
export const ConfigFileSchema = z.strictObject({
  schemaVersion: SchemaVersionSchema,
  league: LeagueIdSchema.describe('The active league id (AD-19).'),
  minChunkSearches: z
    .int()
    .min(1)
    .describe(
      'A validation yardstick, and never a chunk bound. Read at exactly one place — AD-7’s load-time pinned cap.',
    ),
});

/** `data/dataset.json`, the published snapshot (AD-19); each `entryKey` appears once. */
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
  .superRefine((file, context) => {
    const firstIndexByEntryKey = new Map<string, number>();
    for (const [index, entry] of file.entries.entries()) {
      const first = firstIndexByEntryKey.get(entry.entryKey);
      if (first === undefined) {
        firstIndexByEntryKey.set(entry.entryKey, index);
        continue;
      }
      context.addIssue({
        code: 'custom',
        path: ['entries', index],
        message: `entry key ${entry.entryKey} repeats entries.${String(first)}; a key may appear once in dataset.json`,
      });
    }
  });

/** `data/sync-report.json` — figures and records (FR-25). */
export const SyncReportFileSchema = SyncRunReportSchema.extend({
  schemaVersion: SchemaVersionSchema,
});

/** `data/sync-progress.json`: keys the current pass has completed (AD-7). Internal to `sync`. */
export const SyncProgressFileSchema = SyncProgressSchema.extend({
  schemaVersion: SchemaVersionSchema,
});

/** `data/catalogue/*.json`: the captured `result` plus `schemaVersion`, diffable (AD-25). */
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

/** The one load path for versioned files: the version is checked before the body parses (NFR-8). */
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
      case 'unknown-major': {
        return {
          ok: false,
          reason: 'unknown-major',
          expected: version.expected,
          found: version.found,
        };
      }
      case 'malformed': {
        return {
          ok: false,
          reason: 'malformed-version',
          expected: version.expected,
          found: version.found,
        };
      }
    }
  }

  const parsed = schema.safeParse(data);
  return parsed.success ? { ok: true, value: parsed.data } : { ok: false, reason: 'invalid', issues: parsed.error.issues };
}
