import { canonicalKey, compareCanonicalKeys, DatasetFileSchema } from '@poe/contracts';
import type { CurrencyRate, DatasetEntry, TrackedEntry } from '@poe/contracts';
import { describe, expect, it } from 'vitest';

import { buildDatasetFile } from './publish-dataset.ts';
import type { DatasetInputs } from './publish-dataset.ts';

const NOW = '2026-09-26T12:00:00.000Z';
const EARLIER = '2026-09-25T12:00:00.000Z';

function raw(baseTypeId: string, status: TrackedEntry['status'] = 'active'): TrackedEntry {
  return status === 'pruned'
    ? { kind: 'raw', baseTypeId, itemLevelMin: 82, status, prunedReason: 'no market' }
    : { kind: 'raw', baseTypeId, itemLevelMin: 82, status };
}

const key = canonicalKey;
const rotate = <T>(items: readonly T[]): T[] => [...items.slice(1), ...items.slice(0, 1)];
const byKey = (a: DatasetEntry, b: DatasetEntry): number => compareCanonicalKeys(a.entryKey, b.entryKey);

function attempted(tracked: TrackedEntry, at: string): DatasetEntry {
  return { entryKey: key(tracked), price: { state: 'no-listings' }, lastAttemptedAt: at };
}

function neverSynced(tracked: TrackedEntry): DatasetEntry {
  return { entryKey: key(tracked), price: { state: 'not-yet-synced', reason: 'never-synced' } };
}

const RATE: CurrencyRate = {
  currencyId: 'divine',
  rate: 1,
  source: 'measured',
  league: 'League A',
  asOf: '2026-09-01T00:00:00Z',
};

function inputs(overrides: Partial<DatasetInputs>): DatasetInputs {
  return {
    tracked: [],
    previous: [],
    stepEntries: [],
    league: 'League B',
    currencyRates: [RATE],
    now: NOW,
    ...overrides,
  };
}

describe('buildDatasetFile', () => {
  it('first run: 5 tracked, 2 visited → 2 step entries and 3 never-synced, sorted by canonical key', () => {
    const tracked = ['E', 'D', 'C', 'B', 'A'].map((id) => raw(id));
    const [e, , c] = tracked as [TrackedEntry, TrackedEntry, TrackedEntry];
    const file = buildDatasetFile(inputs({ tracked, stepEntries: [attempted(e, NOW), attempted(c, NOW)] }));

    expect(file.entries).toHaveLength(5);
    expect(file.entries.map((entry) => entry.entryKey)).toEqual(tracked.map((entry) => key(entry)).toSorted(compareCanonicalKeys));
    expect(file.entries.filter((entry) => entry.price.state === 'no-listings')).toEqual(
      [attempted(e, NOW), attempted(c, NOW)].toSorted(byKey),
    );
    for (const entry of file.entries) {
      if (entry.price.state === 'no-listings') {
        continue;
      }
      // AD-9: no placeholder timestamps on a never-synced entry.
      expect(Object.keys(entry)).toEqual(['entryKey', 'price']);
      expect(entry.price).toEqual({ state: 'not-yet-synced', reason: 'never-synced' });
    }
    expect(DatasetFileSchema.safeParse(file).success).toBe(true);
  });

  it('carry-over: an unvisited previous entry is carried unchanged', () => {
    const x = raw('X');
    const previous: DatasetEntry = { ...attempted(x, EARLIER), lastSearchId: 's', lastSearchLeague: 'League A' };
    expect(buildDatasetFile(inputs({ tracked: [x], previous: [previous] })).entries).toEqual([previous]);
  });

  it('yielded: the stamped step entry replaces the previous one', () => {
    const x = raw('X');
    const stamped = attempted(x, NOW);
    const file = buildDatasetFile(inputs({ tracked: [x], previous: [attempted(x, EARLIER)], stepEntries: [stamped] }));
    expect(file.entries).toEqual([stamped]);
  });

  it('removed from tracked: a previous key that is not tracked is absent', () => {
    const x = raw('X');
    const gone = attempted(raw('K'), EARLIER);
    const file = buildDatasetFile(inputs({ tracked: [x], previous: [gone], stepEntries: [attempted(raw('J'), NOW)] }));
    expect(file.entries).toEqual([neverSynced(x)]);
  });

  it('pruned: its previous entry, or never-synced', () => {
    const p = raw('P', 'pruned');
    const q = raw('Q', 'pruned');
    const kept = attempted(p, EARLIER);
    const file = buildDatasetFile(inputs({ tracked: [p, q], previous: [kept] }));
    expect(file.entries).toEqual([kept, neverSynced(q)].toSorted(byKey));
  });

  it('league change: an observation from league A is carried over; the top-level league is B', () => {
    const x = raw('X');
    const priced: DatasetEntry = {
      entryKey: key(x),
      price: {
        state: 'priced',
        observation: { league: 'League A', observedAt: EARLIER, priceDivine: 2, sampleSize: 10, exchangeObservation: RATE },
      },
      lastAttemptedAt: EARLIER,
      lastSearchId: 's',
      lastSearchLeague: 'League A',
    };
    const file = buildDatasetFile(inputs({ tracked: [x], previous: [priced], league: 'League B' }));
    expect(file.league).toBe('League B');
    expect(file.entries).toEqual([priced]);
  });

  it('rates, league and generatedAt are the passed-in values, verbatim', () => {
    const file = buildDatasetFile(inputs({}));
    expect(file).toEqual({
      schemaVersion: '1.0.0',
      league: 'League B',
      generatedAt: NOW,
      entries: [],
      currencyRates: [RATE],
    });
  });

  it('a duplicated tracked key yields one entry', () => {
    const x = raw('X');
    expect(buildDatasetFile(inputs({ tracked: [x, x] })).entries).toEqual([neverSynced(x)]);
  });

  it('two step entries for one key: the later one is published', () => {
    const x = raw('X');
    const earlier = attempted(x, EARLIER);
    const later: DatasetEntry = { ...attempted(x, NOW), lastSearchId: 'later' };
    const file = buildDatasetFile(inputs({ tracked: [x], stepEntries: [earlier, later] }));
    expect(file.entries).toEqual([later]);
  });

  it('is independent of input order: reordered tracked, previous and step entries build equal files', () => {
    const tracked = ['A', 'B', 'C', 'D', 'E'].map((id) => raw(id));
    const [a, b, c, d] = tracked as [TrackedEntry, TrackedEntry, TrackedEntry, TrackedEntry];
    const previous = [attempted(a, EARLIER), attempted(b, EARLIER)];
    const stepEntries = [attempted(c, NOW), attempted(d, NOW)];

    const forward = buildDatasetFile(inputs({ tracked, previous, stepEntries }));
    const reversed = buildDatasetFile(
      inputs({ tracked: tracked.toReversed(), previous: previous.toReversed(), stepEntries: stepEntries.toReversed() }),
    );
    const rotated = buildDatasetFile(
      inputs({ tracked: rotate(tracked), previous: rotate(previous), stepEntries: rotate(stepEntries) }),
    );

    expect(reversed).toEqual(forward);
    expect(rotated).toEqual(forward);
    expect(forward.entries.map((entry) => entry.entryKey)).toEqual(tracked.map((entry) => key(entry)).toSorted(compareCanonicalKeys));
  });
});
