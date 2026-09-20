import { z } from 'zod';

import { CurrencyRateSchema } from './currency-rate.ts';
import { DatasetEntrySchema } from './dataset.ts';
import { IsoTimestampSchema, LeagueIdSchema } from './primitives.ts';
import {
  checkSchemaVersion,
  SchemaVersionSchema,
  SUPPORTED_SCHEMA_VERSION,
} from './schema-version.ts';
import { SyncRunReportSchema } from './sync-run-report.ts';
import { TrackedEntrySchema } from './tracked-entry.ts';
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

/** `data/tracked.json` — the player's curated workload (AD-12). */
export const TrackedFileSchema = z.strictObject({
  schemaVersion: SchemaVersionSchema,
  entries: z.array(TrackedEntrySchema),
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

/** `data/dataset.json` — the published snapshot, latest observation per entry (AD-19). */
export const DatasetFileSchema = z.strictObject({
  schemaVersion: SchemaVersionSchema,
  league: LeagueIdSchema.describe('The league the run was configured for.'),
  generatedAt: IsoTimestampSchema,
  entries: z.array(DatasetEntrySchema),
  currencyRates: z
    .array(CurrencyRateSchema)
    .describe(
      'The current rate set, carried here rather than in a ninth artifact so AD-24’s fetch set stays closed. `core` costs recipes from it (AD-20).',
    ),
});

/** `data/sync-report.json` — figures and records (FR-25). */
export const SyncReportFileSchema = SyncRunReportSchema.extend({
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
export type CurrenciesFile = z.infer<typeof CurrenciesFileSchema>;
export type ConfigFile = z.infer<typeof ConfigFileSchema>;
export type DatasetFile = z.infer<typeof DatasetFileSchema>;
export type SyncReportFile = z.infer<typeof SyncReportFileSchema>;
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
