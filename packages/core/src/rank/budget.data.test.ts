import {
  ConfigFileSchema,
  DatasetFileSchema,
  parseEnvelope,
  RecipesFileSchema,
  SUPPORTED_SCHEMA_VERSION,
  TRACKED_SCHEMA_VERSION,
  TrackedFileSchema,
  WEIGHTS_SCHEMA_VERSION,
  WeightsFileSchema,
} from '@poe/contracts';
import type { WeightsFile } from '@poe/contracts';
import { describe, expect, it } from 'vitest';

import { CRAFTING_ITEM_LEVELS } from '../crafting-item-level.ts';
import { crossFileChecks } from '../cross-file.ts';
import type { CraftingItemLevel } from '../crafting-item-level.ts';
import { rank } from '../rank.ts';
import type { RankInput } from '../rank.ts';
import { NOW, priced, published, THRESHOLD } from './test-support.ts';

// Not NFR-6's 100 ms (AD-24): `pnpm check` runs this beside `test` and `build`, and that load
// roughly triples the samples. This gate catches gross regressions only; 100 ms is verified by hand.
const BUDGET_MS = 250;
const SAMPLES = 5;
// `deploy.yml` sets `off`: runner noise must not block a tick's price deploy (AD-24).
// `core` has no Node types, and Vitest's `import.meta.env` carries no unprefixed variable.
type WithProcess = { readonly process?: { readonly env: Readonly<Record<string, string | undefined>> } };
const isTimed = (globalThis as WithProcess).process?.env['RANK_BUDGET_TIMING'] !== 'off';

/** One committed `data/` file, unparsed (pnpm test:data). */
async function committed(name: string): Promise<unknown> {
  // A non-literal specifier: the file sits outside this package's `rootDir`.
  const here = (import.meta as { readonly dirname: string }).dirname;
  return ((await import(/* @vite-ignore */ `${here}/../../../../data/${name}`)) as { default: unknown }).default;
}

/** A file through its envelope, as `web` loads it. */
function parsed<S extends Parameters<typeof parseEnvelope>[0]>(name: string, schema: S, raw: unknown, expected: string) {
  const result = parseEnvelope(schema, raw, expected);
  if (!result.ok) {
    throw new Error(`the committed ${name} was refused: ${result.reason}`);
  }
  return result.value;
}

const [trackedRaw, weightsRaw, recipesRaw, datasetRaw, configRaw] = await Promise.all(
  ['tracked.json', 'weights.json', 'recipes.json', 'dataset.json', 'config.json'].map((name) => committed(name)),
);
const tracked = parsed('tracked.json', TrackedFileSchema, trackedRaw, TRACKED_SCHEMA_VERSION);
const recipes = parsed('recipes.json', RecipesFileSchema, recipesRaw, SUPPORTED_SCHEMA_VERSION);
const dataset = parsed('dataset.json', DatasetFileSchema, datasetRaw, SUPPORTED_SCHEMA_VERSION);
const config = parsed('config.json', ConfigFileSchema, configRaw, SUPPORTED_SCHEMA_VERSION);
/** A new parse builds new pool objects, so every memo keyed on them starts empty. */
const freshWeights = (): WeightsFile => parsed('weights.json', WeightsFileSchema, weightsRaw, WEIGHTS_SCHEMA_VERSION);
const weights = freshWeights();
const crossFileFailures = crossFileChecks(tracked.entries, weights).failures;

/** Every non-pruned entry priced in the active league, so pricing gates no crafted row. */
const everyEntryPriced = tracked.entries
  .filter((entry) => entry.status !== 'pruned')
  .map((entry, index) => published(entry, priced(((index * 37) % 500) / 100 + 0.01, config.league)));

function inputAt(craftingItemLevel: CraftingItemLevel, weightsFile: WeightsFile): RankInput {
  return {
    tracked: tracked.entries,
    dataset: everyEntryPriced,
    activeLeague: config.league,
    threshold: THRESHOLD,
    now: NOW,
    weights: weightsFile,
    recipes: recipes.recipes,
    currencyRates: dataset.currencyRates,
    craftingItemLevel,
    crossFileFailures,
  };
}

/** The fastest of `SAMPLES` timed passes; `prepare` runs outside the timed region. */
function fastest(prepare: () => RankInput): { readonly fastestMs: number; readonly samples: readonly number[] } {
  const samples: number[] = [];
  for (let run = 0; run < SAMPLES; run += 1) {
    const input = prepare();
    const started = Date.now();
    rank(input);
    samples.push(Date.now() - started);
  }
  return { fastestMs: Math.min(...samples), samples };
}

const describeSamples = (samples: readonly number[]) => samples.join(', ');

describe.each(CRAFTING_ITEM_LEVELS)('rank over the committed data/tracked.json at L %i (NFR-6, AD-24)', (level) => {
  it('ranks at least one crafted row with a summand', () => {
    const craftedRows = rank(inputAt(level, weights)).ordering.filter((row) => row.kind === 'crafted');
    expect(craftedRows.length).toBeGreaterThan(0);
    expect(craftedRows.some((row) => row.summands.length > 0)).toBe(true);
  });

  it('ranks the same with every pool memo filled as with every pool memo empty', () => {
    rank(inputAt(level, weights));
    expect(rank(inputAt(level, weights))).toStrictEqual(rank(inputAt(level, freshWeights())));
  });

  it.skipIf(!isTimed)('re-ranks under the budget with every pool memo filled (a threshold change)', () => {
    const input = inputAt(level, weights);
    rank(input);
    const { fastestMs, samples } = fastest(() => input);
    expect(fastestMs, `samples ms: ${describeSamples(samples)}`).toBeLessThan(BUDGET_MS);
  });

  it.skipIf(!isTimed)('ranks under the budget with every pool memo empty (a level switch to lines not yet derived)', () => {
    const { fastestMs, samples } = fastest(() => inputAt(level, freshWeights()));
    expect(fastestMs, `samples ms: ${describeSamples(samples)}`).toBeLessThan(BUDGET_MS);
  });
});
