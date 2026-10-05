// Dataset built from one chunk (AD-9, AD-19, AD-20): pure, one entry per tracked entry, pruned too.
// Step entry, else previous entry unchanged, else `never-synced`; absence is never a missing key.
// No league filter: earlier-league observations carry over; top-level `league` names the active.

import { canonicalKey, compareCanonicalKeys, SUPPORTED_SCHEMA_VERSION } from '@poe/contracts';
import type { CurrencyRate, DatasetEntry, DatasetFile, TrackedEntry } from '@poe/contracts';

export interface DatasetInputs {
  readonly tracked: readonly TrackedEntry[];
  /** The previous `dataset.json` entries; empty when there was no file. */
  readonly previous: readonly DatasetEntry[];
  /** The entries the steps returned this chunk, in visiting order. */
  readonly stepEntries: readonly DatasetEntry[];
  /** The active league. */
  readonly league: string;
  /** The rate set as `sync` writes it out. */
  readonly currencyRates: readonly CurrencyRate[];
  /** `generatedAt`: the clock's reading. */
  readonly now: string;
}

export function buildDatasetFile(inputs: DatasetInputs): DatasetFile {
  const previous = new Map(inputs.previous.map((entry) => [entry.entryKey, entry]));
  // A later step entry for the same key wins: it is the more recent state.
  const stepped = new Map(inputs.stepEntries.map((entry) => [entry.entryKey, entry]));
  const keys = [...new Set(inputs.tracked.map((entry) => canonicalKey(entry)))].toSorted(compareCanonicalKeys);

  const entries = keys.map(
    (entryKey): DatasetEntry =>
      stepped.get(entryKey) ??
      previous.get(entryKey) ?? {
        entryKey,
        price: { state: 'not-yet-synced', reason: 'never-synced' },
      },
  );

  return {
    schemaVersion: SUPPORTED_SCHEMA_VERSION,
    league: inputs.league,
    generatedAt: inputs.now,
    entries,
    currencyRates: [...inputs.currencyRates],
  };
}
