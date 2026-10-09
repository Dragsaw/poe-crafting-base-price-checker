import {
  canonicalKey,
  compareCanonicalKeys,
  SUPPORTED_SCHEMA_VERSION,
  SYNC_PROGRESS_SCHEMA_VERSION,
  SYNC_REPORT_SCHEMA_VERSION,
} from '@poe/contracts';
import type { DatasetEntry, DatasetFile, SyncReportFile, TrackedEntry } from '@poe/contracts';
import { describe, expect, it, vi } from 'vitest';

import { DRY_RUN_INSTANT, dryRun } from './dry-run.ts';
import {
  CURRENCY_RATES,
  emptySearches,
  entries,
  ITEMS_CATALOGUE,
  LEAGUE,
  snapshotOf,
} from './dry-run/test-support.ts';
import { searchFixtureName } from './pricing/fixture-names.ts';
import { itemTypesOf } from './pricing/search-body.ts';
import type * as TradeClientModule from './trade/client.ts';

/** Every option set the dry run built its trade clients with, in build order. */
const tradeClientOptions = vi.hoisted((): unknown[] => []);

// A pass-through: the real clients are built, and the options are recorded so
// a test can inspect what the shell passed (AD-8).
vi.mock('./trade/client.ts', async (importOriginal) => {
  const actual = await importOriginal<typeof TradeClientModule>();
  return {
    ...actual,
    createTradeGovernor: (options: Parameters<typeof actual.createTradeGovernor>[0]) => {
      tradeClientOptions.push(options);
      return actual.createTradeGovernor(options);
    },
  };
});

function noListings(entry: TrackedEntry, index: number): DatasetEntry {
  return {
    entryKey: canonicalKey(entry),
    price: { state: 'no-listings' },
    lastAttemptedAt: DRY_RUN_INSTANT,
    lastSearchId: `S${String(index)}`,
    lastSearchLeague: LEAGUE,
  };
}

function datasetOf(published: readonly DatasetEntry[]): DatasetFile {
  return {
    schemaVersion: SUPPORTED_SCHEMA_VERSION,
    league: LEAGUE,
    generatedAt: DRY_RUN_INSTANT,
    entries: [...published],
    currencyRates: CURRENCY_RATES,
  };
}

/** The report of a finished dry run over no previous report, with no git history and no mtime. */
function reportOf(trackedListRequests: number, notReachedCount = 0): SyncReportFile {
  return {
    runStartedAt: DRY_RUN_INSTANT,
    runFinishedAt: DRY_RUN_INSTANT,
    figures: {
      requestsBySource: { 'tracked-list': trackedListRequests, 'league-validation': 1, 'session-probe': 0 },
      notReachedCount,
    },
    records: [],
    schemaVersion: SYNC_REPORT_SCHEMA_VERSION,
  };
}

describe('dryRun', () => {
  it('runs the chunk in memory through the pricing step and reports each entry', async () => {
    const [active, pinned, pruned] = entries as [TrackedEntry, TrackedEntry, TrackedEntry];

    expect(await dryRun(snapshotOf(entries))).toEqual({
      outcome: 'completed',
      completed: [canonicalKey(pinned), canonicalKey(active)],
      entries: [noListings(pinned, 1), noListings(active, 0)],
      // Pinned entries are exempt from the pass, so only the active key is recorded.
      progress: { schemaVersion: SYNC_PROGRESS_SCHEMA_VERSION, completed: [canonicalKey(active)] },
      dataset: datasetOf(
        [
          noListings(pinned, 1),
          noListings(active, 0),
          { entryKey: canonicalKey(pruned), price: { state: 'not-yet-synced', reason: 'never-synced' } } satisfies DatasetEntry,
        ].toSorted((a, b) => compareCanonicalKeys(a.entryKey, b.entryKey)),
      ),
      records: [],
      // Two searches that found nothing, so no fetch.
      report: reportOf(2),
    });
  });

  it('builds its trade clients with the invalid-request threshold of 1', async () => {
    tradeClientOptions.length = 0;

    await dryRun(snapshotOf(entries));

    expect(tradeClientOptions).toEqual([expect.objectContaining({ invalidRequestThreshold: 1 })]);
    // The batch pacer, cold: no even spread and no shared pacing state (AD-8).
    expect(tradeClientOptions[0]).not.toHaveProperty('spread');
    expect(tradeClientOptions[0]).not.toHaveProperty('pacing');
  });

  it('treats an absent tracked file as an empty workload', async () => {
    expect(await dryRun(snapshotOf(undefined))).toEqual({
      outcome: 'completed',
      completed: [],
      entries: [],
      progress: { schemaVersion: SYNC_PROGRESS_SCHEMA_VERSION, completed: [] },
      dataset: datasetOf([]),
      records: [],
      report: reportOf(0),
    });
  });

  it('publishes the output rate set: divine exactly 1, others at 4dp, league and asOf verbatim', async () => {
    const currencies = JSON.stringify({
      schemaVersion: SUPPORTED_SCHEMA_VERSION,
      rates: [
        { currencyId: 'divine', rate: 1, source: 'measured', league: 'Old League', asOf: '2025-12-01T00:00:00Z' },
        { currencyId: 'chaos', rate: 0.00812345, source: 'measured', league: 'Old League', asOf: '2025-12-02T00:00:00Z' },
      ],
    });

    const report = await dryRun(snapshotOf(entries, { currencies }));

    expect(report.dataset?.league).toBe(LEAGUE);
    expect(report.dataset?.currencyRates).toEqual([
      { currencyId: 'divine', rate: 1, source: 'measured', league: 'Old League', asOf: '2025-12-01T00:00:00Z' },
      { currencyId: 'chaos', rate: 0.0081, source: 'measured', league: 'Old League', asOf: '2025-12-02T00:00:00Z' },
    ]);
  });

  it('is deterministic for a given snapshot', async () => {
    expect(await dryRun(snapshotOf(entries))).toEqual(await dryRun(snapshotOf(entries)));
  });

  it('carries the snapshot report’s records into the report, and replaces its figures', async () => {
    const broken = { kind: 'stale-lock-broken', pid: 7, startedAt: '2025-12-31T00:00:00.000Z' } as const;
    const previous = JSON.stringify({
      ...reportOf(99, 5),
      runStartedAt: '2025-12-31T00:00:00.000Z',
      runFinishedAt: '2025-12-31T00:01:00.000Z',
      records: [broken],
    });

    const report = await dryRun(snapshotOf(entries, { report: previous }));

    expect(report.records).toEqual([]);
    expect(report.report).toEqual({ ...reportOf(2), records: [broken] });
  });

  it('refuses a snapshot report of an unknown major loudly', async () => {
    await expect(
      dryRun(snapshotOf(entries, { report: JSON.stringify({ ...reportOf(0), schemaVersion: '9.0.0' }) })),
    ).rejects.toThrow(/sync-report\.json/);
  });

  it('refuses an invalid tracked file loudly', async () => {
    await expect(
      dryRun(snapshotOf([], { tracked: '{"schemaVersion":"9.0.0","entries":[]}' })),
    ).rejects.toThrow(/9\.0\.0/);
  });

  it.each([
    ['config', 'data/config.json'],
    ['currencies', 'data/currencies.json'],
    ['items', 'data/catalogue/items.json'],
    ['stats', 'data/catalogue/stats.json'],
    ['filters', 'data/catalogue/filters.json'],
  ] as const)('refuses an absent or invalid %s file, naming it, before any request', async (key, path) => {
    await Promise.all(
      [undefined, '{"schemaVersion":"1.0.0"}'].map((contents) =>
        expect(dryRun(snapshotOf(entries, { [key]: contents }))).rejects.toThrow(path),
      ),
    );
  });

  it('records an absent weights file and runs otherwise unchanged', async () => {
    const report = await dryRun(snapshotOf(entries, { weights: undefined }));
    expect(report.outcome).toBe('completed');
    expect(report.report?.records).toEqual([{ kind: 'weights-absent', uncheckableClassNames: [] }]);
    expect(report.report?.figures.requestsBySource['tracked-list']).toBe(2);
  });

  it('marks an uncatalogued base type offline: no request, the others priced', async () => {
    const unknown: TrackedEntry = { kind: 'raw', baseTypeId: 'Patched Out', itemLevelMin: 82, status: 'active' };
    const report = await dryRun(snapshotOf([...entries, unknown]));
    expect(report.completed).not.toContain(canonicalKey(unknown));
    expect(report.report?.figures.requestsBySource['tracked-list']).toBe(2);
    expect(report.dataset?.entries.find((entry) => entry.entryKey === canonicalKey(unknown))).toEqual({
      entryKey: canonicalKey(unknown),
      price: { state: 'unresolvable' },
    });
    expect(report.report?.records).toEqual([
      { kind: 'unresolvable', entryKey: canonicalKey(unknown), identifier: 'Patched Out', identifierKind: 'baseTypeId' },
    ]);
  });

  it('skips an entry whose search has no recorded fixture: no request, listed as unrecorded', async () => {
    const [active, pinned] = entries as [TrackedEntry, TrackedEntry];
    const fixtures = emptySearches(entries);
    fixtures.delete(searchFixtureName(active, LEAGUE, itemTypesOf(ITEMS_CATALOGUE)));

    const report = await dryRun(snapshotOf(entries, { fixtures }));

    expect(report.outcome).toBe('completed');
    expect(report.unrecorded).toEqual([canonicalKey(active)]);
    expect(report.entries).toEqual([noListings(pinned, 1)]);
    expect(report.report?.figures.requestsBySource['tracked-list']).toBe(1);
    // The skipped entry keeps its dataset state: never attempted, as it was.
    expect(report.dataset?.entries.find((entry) => entry.entryKey === canonicalKey(active))).not.toHaveProperty(
      'lastAttemptedAt',
    );
  });

  it('omits unrecorded when every search is recorded', async () => {
    expect(await dryRun(snapshotOf(entries))).not.toHaveProperty('unrecorded');
  });

  it('fails loudly, naming the missing fixture, when a recorded search has no recorded fetch', async () => {
    const [active] = entries as [TrackedEntry];
    const fixtures = emptySearches(entries);
    fixtures.set(
      searchFixtureName(active, LEAGUE, itemTypesOf(ITEMS_CATALOGUE)),
      JSON.stringify({ id: 'S0', complexity: 1, result: ['unrecorded-id'], total: 1 }),
    );

    await expect(dryRun(snapshotOf(entries, { fixtures }))).rejects.toThrow(/no recorded fixture trade-fetch-/);
  });
});
