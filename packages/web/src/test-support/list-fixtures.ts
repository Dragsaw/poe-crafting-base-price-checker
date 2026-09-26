/**
 * Fixture builders for tracked and dataset entries, for the ranked-list tests.
 * Never imported by the app.
 */

import { canonicalKey, type DatasetEntry, type PriceState, type RawTrackedEntry } from '@poe/contracts';

import { TEST_LEAGUE, VALID_BODIES } from './artifact-server';

export const HOUR = 3_600_000;

export function rawEntry(baseTypeId: string, itemLevelMin = 82): RawTrackedEntry {
  return { kind: 'raw', baseTypeId, itemLevelMin, status: 'active' };
}

/** An ISO timestamp `hours` before `now`. */
export function hoursBefore(now: number, hours: number): string {
  return new Date(now - hours * HOUR).toISOString();
}

export function priced(
  entry: RawTrackedEntry,
  priceDivine: number,
  observedAt: string,
  league: string = TEST_LEAGUE,
): DatasetEntry {
  return {
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

export function unpriced(entry: RawTrackedEntry, price: PriceState, lastAttemptedAt?: string): DatasetEntry {
  return lastAttemptedAt === undefined
    ? { entryKey: canonicalKey(entry), price }
    : { entryKey: canonicalKey(entry), price, lastAttemptedAt };
}

/** `VALID_BODIES` with the tracked list and the dataset's entries replaced. */
export function bodiesWith(
  tracked: readonly RawTrackedEntry[],
  dataset: readonly DatasetEntry[],
): { readonly tracked: unknown; readonly dataset: unknown } {
  return {
    tracked: { ...(VALID_BODIES.tracked as object), entries: tracked },
    dataset: { ...(VALID_BODIES.dataset as object), entries: dataset },
  };
}
