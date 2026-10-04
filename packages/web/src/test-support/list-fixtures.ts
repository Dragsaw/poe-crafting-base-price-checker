/**
 * Fixture builders for tracked and dataset entries, for the ranked-list tests.
 * Never imported by the app.
 */

import {
  canonicalKey,
  type BandedModifierRef,
  type CraftedTrackedEntry,
  type DatasetEntry,
  type PriceState,
  type RawTrackedEntry,
  type TrackedEntry,
} from '@poe/contracts';

import { TEST_LEAGUE, VALID_BODIES } from './artifact-server';

export const HOUR = 3_600_000;

export function rawEntry(baseTypeId: string, itemLevelMin = 82): RawTrackedEntry {
  return { kind: 'raw', baseTypeId, itemLevelMin, status: 'active' };
}

/** A crafted entry on one `(categoryId, className)`, carrying a valueless prefix and a valueless suffix. */
export function craftedEntry(className: string, categoryId: string, itemLevelMin = 82): CraftedTrackedEntry {
  return {
    kind: 'crafted',
    categoryId,
    className,
    itemLevelMin,
    prefix: { kind: 'valueless', statId: 'explicit.stat_3299347043' },
    suffix: { kind: 'valueless', statId: 'explicit.stat_1967051901' },
    status: 'active',
  };
}

/** A banded reference, with an Accepted Tier when one is given. */
export function banded(statId: string, valueMin: number, valueMax: number, acceptedTier?: string): BandedModifierRef {
  const reference = { kind: 'banded', statId, valueMin, valueMax } as const;
  return acceptedTier === undefined ? reference : { ...reference, acceptedTier };
}

/** An ISO timestamp `hours` before `now`. */
export function hoursBefore(now: number, hours: number): string {
  return new Date(now - hours * HOUR).toISOString();
}

/** A stored trade search: `lastSearchId` and the league it ran in. */
export interface StoredSearch {
  readonly id: string;
  readonly league: string;
}

function searchFields(search: StoredSearch | undefined): Pick<DatasetEntry, 'lastSearchId' | 'lastSearchLeague'> {
  return search === undefined ? {} : { lastSearchId: search.id, lastSearchLeague: search.league };
}

export function priced(
  entry: TrackedEntry,
  priceDivine: number,
  observedAt: string,
  league: string = TEST_LEAGUE,
  search?: StoredSearch,
): DatasetEntry {
  return {
    ...searchFields(search),
    entryKey: canonicalKey(entry),
    price: {
      state: 'priced',
      observation: {
        league,
        observedAt,
        priceDivine,
        sampleSize: 10,
        exchangeObservation: { currencyId: 'divine', rate: 1, source: 'measured', league, asOf: observedAt },
      },
    },
    lastAttemptedAt: observedAt,
  };
}

export function unpriced(
  entry: TrackedEntry,
  price: PriceState,
  lastAttemptedAt?: string,
  search?: StoredSearch,
): DatasetEntry {
  const base = { ...searchFields(search), entryKey: canonicalKey(entry), price };
  return lastAttemptedAt === undefined ? base : { ...base, lastAttemptedAt };
}

/** `VALID_BODIES` with the tracked list and the dataset's entries replaced. */
export function bodiesWith(
  tracked: readonly TrackedEntry[],
  dataset: readonly DatasetEntry[],
): { readonly tracked: unknown; readonly dataset: unknown } {
  return {
    tracked: { ...(VALID_BODIES.tracked as object), entries: tracked },
    dataset: { ...(VALID_BODIES.dataset as object), entries: dataset },
  };
}
