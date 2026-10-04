import {
  CatalogueStatsFileSchema,
  ConfigFileSchema,
  DatasetFileSchema,
  RecipesFileSchema,
  SUPPORTED_SCHEMA_VERSION,
  SYNC_REPORT_SCHEMA_VERSION,
  SyncReportFileSchema,
  TRACKED_SCHEMA_VERSION,
  TrackedFileSchema,
  WEIGHTS_SCHEMA_VERSION,
  WeightsFileSchema,
} from '@poe/contracts';
import type { parseEnvelope } from '@poe/contracts';

/**
 * The seven artifacts `web` fetches (AD-24), in AD-24 order. An eighth needs
 * an AD-24 amendment. `web` never fetches `catalogue/static.json`. `required`
 * artifacts refuse the render when absent, exactly as when invalid;
 * `tolerable` ones let the page render and name the absence.
 */

/** The weights contract major the page reads (WEIGHTS-FILE-SCHEMA.md), defined once in `contracts`; only the major is compared. */
const WEIGHTS_EXPECTED_VERSION = WEIGHTS_SCHEMA_VERSION;

/** Whatever `parseEnvelope` accepts; `web` takes no direct `zod` dependency. */
export type EnvelopeSchema = Parameters<typeof parseEnvelope>[0];

export type ArtifactClass = 'required' | 'tolerable';

export interface ArtifactDescriptor<S extends EnvelopeSchema = EnvelopeSchema, C extends ArtifactClass = ArtifactClass> {
  /** The path under the site base, and the name every screen prints. */
  readonly path: string;
  readonly class: C;
  readonly schema: S;
  /** The version the page expects. `parseEnvelope` compares the major only. */
  readonly expected: string;
}

function artifact<S extends EnvelopeSchema, C extends ArtifactClass>(
  path: string,
  artifactClass: C,
  schema: S,
  expected: string,
): ArtifactDescriptor<S, C> {
  return { path, class: artifactClass, schema, expected };
}

export const ARTIFACTS = {
  dataset: artifact('dataset.json', 'required', DatasetFileSchema, SUPPORTED_SCHEMA_VERSION),
  syncReport: artifact('sync-report.json', 'tolerable', SyncReportFileSchema, SYNC_REPORT_SCHEMA_VERSION),
  weights: artifact('weights.json', 'tolerable', WeightsFileSchema, WEIGHTS_EXPECTED_VERSION),
  recipes: artifact('recipes.json', 'tolerable', RecipesFileSchema, SUPPORTED_SCHEMA_VERSION),
  tracked: artifact('tracked.json', 'required', TrackedFileSchema, TRACKED_SCHEMA_VERSION),
  config: artifact('config.json', 'required', ConfigFileSchema, SUPPORTED_SCHEMA_VERSION),
  catalogueStats: artifact('catalogue/stats.json', 'required', CatalogueStatsFileSchema, SUPPORTED_SCHEMA_VERSION),
} as const;

export type ArtifactKey = keyof typeof ARTIFACTS;

/** AD-24 order. When several artifacts fail, the screen names the first of them in this order. */
export const ARTIFACT_ORDER = [
  'dataset',
  'syncReport',
  'weights',
  'recipes',
  'tracked',
  'config',
  'catalogueStats',
] as const satisfies readonly ArtifactKey[];

/** A schema's parsed type — what `z.infer` reads — without a direct `zod` import. */
type OutputOf<S> = S extends { readonly _zod: { readonly output: infer O } } ? O : never;

/** What `parseEnvelope` yields for artifact `K`. */
export type Parsed<K extends ArtifactKey> = OutputOf<(typeof ARTIFACTS)[K]['schema']>;

type RequiredKey = {
  [K in ArtifactKey]: (typeof ARTIFACTS)[K]['class'] extends 'required' ? K : never;
}[ArtifactKey];
export type TolerableKey = Exclude<ArtifactKey, RequiredKey>;

/** One consistent set. A tolerable artifact that was absent is `undefined`, never a stand-in. */
export type ArtifactSet = { readonly [K in RequiredKey]: Parsed<K> } & {
  readonly [K in TolerableKey]: Parsed<K> | undefined;
};
