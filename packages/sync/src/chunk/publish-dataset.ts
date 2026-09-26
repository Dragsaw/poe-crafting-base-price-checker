/**
 * The published Dataset, built from one chunk (AD-9, AD-19, AD-20).
 *
 * Pure: every input is a value. The file holds exactly one entry per tracked
 * entry, `pruned` ones included, sorted by canonical key. Each entry is the
 * step's entry where this chunk produced one, else the previous dataset's
 * entry, carried over unchanged, else `not-yet-synced` with reason
 * `never-synced` and no timestamps — absence is never a missing key (AD-9). A
 * previous entry whose key is no longer tracked is dropped.
 *
 * There is no league filter: an observation from an earlier league is carried
 * over as it is, and only the top-level `league` names the active one
 * (AD-19). The rate set arrives already in its output form (AD-20); this
 * module neither reads nor names a player file.
 */

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
  const keys = [...new Set(inputs.tracked.map(canonicalKey))].toSorted(compareCanonicalKeys);

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
