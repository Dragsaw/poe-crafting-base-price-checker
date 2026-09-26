import { execFile } from 'node:child_process';
import { readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

import {
  canonicalKey,
  compareCanonicalKeys,
  createFakeClockPort,
  createFakeFilesystemPort,
  createFakeGitPort,
  DatasetFileSchema,
  SyncReportFileSchema,
} from '@poe/contracts';
import type { CurrencyRate, DatasetEntry, DatasetFile, SyncReportFile, TrackedEntry } from '@poe/contracts';
import { describe, expect, it, vi } from 'vitest';

import { DATASET_PATH, runChunk, TRACKED_PATH } from './chunk/run-chunk.ts';
import { DRY_RUN_INSTANT, dryRun, readRepositorySnapshot } from './dry-run.ts';
import type { DryRunSnapshot } from './dry-run.ts';
import { pinnedStarvationRecord } from './pinned-cap.ts';
import { LeagueMismatchError } from './league/league-gate.ts';
import { LEAGUES_FIXTURE_NAME, pricingFixtureName } from './pricing/fixture-names.ts';
import { createRequestCounter } from './request-counter.ts';
import { buildSearchBody, itemTypesOf } from './pricing/search-body.ts';
import type * as TradeClientModule from './trade/client.ts';
import { tradeSearchUrl } from './trade/endpoints.ts';

/** Every option set the dry run built its trade clients with, in build order. */
const tradeClientOptions = vi.hoisted((): unknown[] => []);

// A pass-through: the real clients are built, and the options are recorded so
// a test can inspect what the shell passed (AD-8, IMPLEMENTATION-NOTES.md §5.3).
vi.mock('./trade/client.ts', async (importOriginal) => {
  const actual = await importOriginal<typeof TradeClientModule>();
  return {
    ...actual,
    createTradeClients: (options: Parameters<typeof actual.createTradeClients>[0]) => {
      tradeClientOptions.push(options);
      return actual.createTradeClients(options);
    },
  };
});

const SCRIPT = fileURLToPath(new URL('./dry-run.ts', import.meta.url));
const DATA_DIR = fileURLToPath(new URL('../../../data', import.meta.url));

const LEAGUE = 'Test League';
const CONFIG = JSON.stringify({ schemaVersion: '1.0.0', league: LEAGUE, minChunkSearches: 1 });
const CURRENCIES = JSON.stringify({
  schemaVersion: '1.0.0',
  rates: [{ currencyId: 'divine', rate: 1, source: 'measured', league: LEAGUE, asOf: '2026-01-01T00:00:00Z' }],
});
/** Every base type the synthetic entries below name, in one group no category id matches. */
const ITEMS_CATALOGUE = {
  result: [
    {
      id: 'test',
      label: 'Test',
      entries: ['Solar Amulet', 'Gold Amulet', 'Wide Belt', 'A', 'B', 'C', 'P'].map((type) => ({ type })),
    },
  ],
};
const ITEMS = JSON.stringify({ schemaVersion: '1.0.0', ...ITEMS_CATALOGUE });
const STATS = JSON.stringify({ schemaVersion: '1.0.0', result: [] });
const FILTERS = JSON.stringify({ schemaVersion: '1.0.0', result: [] });
/** A present weights file with no ids, so no weights record arises. */
const WEIGHTS = JSON.stringify({ schemaVersion: '6.0.0', bases: {} });

/** The league gate's answer: the synthetic league is one the API carries. */
const LEAGUES_ANSWER = JSON.stringify({ result: [{ id: 'Standard' }, { id: LEAGUE }] });

/**
 * An in-memory answer per entry: a search that found nothing. It is not a
 * fixture file — the ordering tests below need synthetic entries, and the
 * recorded captures are exercised by the repository run at the bottom.
 */
function emptySearches(entries: readonly TrackedEntry[]): Map<string, string> {
  const itemTypes = itemTypesOf(ITEMS_CATALOGUE);
  return new Map([
    [LEAGUES_FIXTURE_NAME, LEAGUES_ANSWER],
    ...entries.map((entry, index) => [
      pricingFixtureName({
        method: 'POST',
        url: tradeSearchUrl(LEAGUE),
        body: JSON.stringify(buildSearchBody(entry, itemTypes)),
      }),
      JSON.stringify({ id: `S${String(index)}`, complexity: 1, result: [], total: 0 }),
    ] as const),
  ]);
}

function snapshotOf(entries: readonly TrackedEntry[] | undefined, extra: Partial<DryRunSnapshot> = {}): DryRunSnapshot {
  return {
    ...(entries === undefined ? {} : { tracked: JSON.stringify({ schemaVersion: '1.0.0', entries }) }),
    config: CONFIG,
    currencies: CURRENCIES,
    items: ITEMS,
    stats: STATS,
    filters: FILTERS,
    weights: WEIGHTS,
    fixtures: emptySearches(entries ?? []),
    ...extra,
  };
}

function noListings(entry: TrackedEntry, index: number): DatasetEntry {
  return {
    entryKey: canonicalKey(entry),
    price: { state: 'no-listings' },
    lastAttemptedAt: DRY_RUN_INSTANT,
    lastSearchId: `S${String(index)}`,
    lastSearchLeague: LEAGUE,
  };
}

const entries: TrackedEntry[] = [
  { kind: 'raw', baseTypeId: 'Solar Amulet', itemLevelMin: 82, status: 'active' },
  { kind: 'raw', baseTypeId: 'Gold Amulet', itemLevelMin: 82, status: 'pinned' },
  { kind: 'raw', baseTypeId: 'Wide Belt', itemLevelMin: 82, status: 'pruned', prunedReason: 'x' },
];

function datasetOf(published: readonly DatasetEntry[]): DatasetFile {
  return {
    schemaVersion: '1.0.0',
    league: LEAGUE,
    generatedAt: DRY_RUN_INSTANT,
    entries: [...published],
    currencyRates: JSON.parse(CURRENCIES).rates as CurrencyRate[],
  };
}

/** The report of a finished dry run over no previous report, with no git history and no mtime. */
function reportOf(trackedListRequests: number, notReachedCount = 0): SyncReportFile {
  return {
    runStartedAt: DRY_RUN_INSTANT,
    runFinishedAt: DRY_RUN_INSTANT,
    figures: {
      requestsBySource: { 'tracked-list': trackedListRequests, 'league-validation': 1 },
      notReachedCount,
    },
    records: [],
    schemaVersion: '1.1.0',
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
      progress: { schemaVersion: '1.1.0', completed: [canonicalKey(active)] },
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

  it('builds its trade clients with the invalid-request threshold of 1 (§5.3)', async () => {
    tradeClientOptions.length = 0;

    await dryRun(snapshotOf(entries));

    expect(tradeClientOptions).toEqual([expect.objectContaining({ invalidRequestThreshold: 1 })]);
  });

  it('treats an absent tracked file as an empty workload', async () => {
    expect(await dryRun(snapshotOf(undefined))).toEqual({
      outcome: 'completed',
      completed: [],
      entries: [],
      progress: { schemaVersion: '1.1.0', completed: [] },
      dataset: datasetOf([]),
      records: [],
      report: reportOf(0),
    });
  });

  it('publishes the output rate set: divine exactly 1, others at 4dp, league and asOf verbatim', async () => {
    const currencies = JSON.stringify({
      schemaVersion: '1.0.0',
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
    for (const contents of [undefined, '{"schemaVersion":"1.0.0"}']) {
      await expect(dryRun(snapshotOf(entries, { [key]: contents }))).rejects.toThrow(path);
    }
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

  it('fails loudly, naming the missing fixture, when a request has no recorded fixture', async () => {
    const [active] = entries as [TrackedEntry];
    const missing = pricingFixtureName({
      method: 'POST',
      url: tradeSearchUrl(LEAGUE),
      body: JSON.stringify(buildSearchBody(active, itemTypesOf(ITEMS_CATALOGUE))),
    });
    const fixtures = emptySearches(entries);
    fixtures.delete(missing);

    await expect(dryRun(snapshotOf(entries, { fixtures }))).rejects.toThrow(missing);
  });
});

describe('dryRun: the league gate', () => {
  it('sends one leagues GET, counted as league-validation, before the searches', async () => {
    const report = await dryRun(snapshotOf(entries));
    expect(report.report?.figures.requestsBySource).toEqual({
      'tracked-list': 2,
      'league-validation': 1,
    });
  });

  it('rejects on a league the recorded answer does not carry, and prices nothing', async () => {
    const fixtures = emptySearches(entries);
    fixtures.set(LEAGUES_FIXTURE_NAME, JSON.stringify({ result: [{ id: 'Standard' }] }));

    await expect(dryRun(snapshotOf(entries, { fixtures }))).rejects.toBeInstanceOf(LeagueMismatchError);
  });

  it('fails loudly, naming the fixture, when the leagues answer is not recorded', async () => {
    const fixtures = emptySearches(entries);
    fixtures.delete(LEAGUES_FIXTURE_NAME);

    await expect(dryRun(snapshotOf(entries, { fixtures }))).rejects.toThrow(LEAGUES_FIXTURE_NAME);
  });
});

describe('dryRun: the dataset snapshot', () => {
  const rotation: TrackedEntry[] = [
    { kind: 'raw', baseTypeId: 'A', itemLevelMin: 82, status: 'active' },
    { kind: 'raw', baseTypeId: 'B', itemLevelMin: 82, status: 'active' },
    { kind: 'raw', baseTypeId: 'C', itemLevelMin: 82, status: 'active' },
    { kind: 'raw', baseTypeId: 'P', itemLevelMin: 82, status: 'pinned' },
  ];
  const [A, B, C, P] = rotation as [TrackedEntry, TrackedEntry, TrackedEntry, TrackedEntry];
  const rotationTracked = JSON.stringify({ schemaVersion: '1.0.0', entries: rotation });
  // Before DRY_RUN_INSTANT, so the order depends on them. C is never attempted.
  const datasetText = JSON.stringify({
    schemaVersion: '1.0.0',
    league: 'Standard',
    generatedAt: '2025-12-31T00:00:00.000Z',
    entries: [
      { entryKey: canonicalKey(A), price: { state: 'no-listings' }, lastAttemptedAt: '2025-12-31T00:00:00.000Z' },
      { entryKey: canonicalKey(B), price: { state: 'no-listings' }, lastAttemptedAt: '2025-12-30T00:00:00.000Z' },
    ],
    currencyRates: [],
  });
  const withDataset = snapshotOf(rotation, { dataset: datasetText });

  it('orders the rotation by the snapshot’s lastAttemptedAt', async () => {
    const report = await dryRun(withDataset);
    expect(report.completed).toEqual([P, C, B, A].map(canonicalKey));
  });

  it('visits the same keys in the same order as runChunk on the same fake and clock', async () => {
    const fs = createFakeFilesystemPort({
      [TRACKED_PATH]: { contents: rotationTracked },
      [DATASET_PATH]: { contents: datasetText },
    });
    const visited: string[] = [];
    await runChunk(
      {
        fs,
        clock: createFakeClockPort(DRY_RUN_INSTANT),
        pid: 1,
        git: createFakeGitPort(),
        requests: createRequestCounter(),
        starvationRecord: (starvation) => pinnedStarvationRecord(starvation, { minChunkSearches: 1 }),
        publication: { league: LEAGUE, currencyRates: [] },
        log: () => undefined,
        catalogue: () =>
          Promise.resolve({
            ok: true,
            value: { statIds: new Set(), baseTypeIds: new Set(['A', 'B', 'C', 'P']), categoryIds: new Set() },
          }),
      },
      (entry) => {
        visited.push(canonicalKey(entry));
        return Promise.resolve({ kind: 'completed' });
      },
    );

    const report = await dryRun(withDataset);
    expect(report.completed).toEqual(visited);
    expect(visited).toHaveLength(4);
  });

  it('is deterministic with a dataset', async () => {
    expect(await dryRun(withDataset)).toEqual(await dryRun(withDataset));
  });

  it('publishes the snapshot’s entries merged with the step entries, under the active league', async () => {
    const report = await dryRun(withDataset);
    expect(report.dataset?.league).toBe(LEAGUE);
    expect(report.dataset?.entries.map((entry) => entry.entryKey)).toEqual(
      rotation.map(canonicalKey).toSorted(compareCanonicalKeys),
    );
    // Every tracked entry was visited, so every entry is this run's.
    for (const entry of report.dataset?.entries ?? []) {
      expect(entry.lastAttemptedAt, entry.entryKey).toBe(DRY_RUN_INSTANT);
    }
  });

  it('refuses an invalid dataset loudly', async () => {
    await expect(dryRun(snapshotOf(rotation, { dataset: '{"schemaVersion":"9.0.0"}' }))).rejects.toThrow(
      /dataset\.json/,
    );
  });
});

describe('dryRun: the repository snapshot and its recorded fixtures', () => {
  it('prices every non-pruned tracked entry from the recorded captures', async () => {
    const snapshot = await readRepositorySnapshot();
    const tracked = JSON.parse(snapshot.tracked ?? '{"entries":[]}') as { entries: TrackedEntry[] };
    const active = tracked.entries.filter((entry) => entry.status !== 'pruned');

    const report = await dryRun(snapshot);

    expect(report.outcome).toBe('completed');
    expect(report.entries).toHaveLength(active.length);
    expect(new Set(report.entries.map((entry) => entry.entryKey))).toEqual(new Set(active.map(canonicalKey)));
    for (const entry of report.entries) {
      expect(entry.price.state, entry.entryKey).toBe('priced');
    }
    // Every tracked id resolves against the committed catalogue.
    expect(report.report?.records.filter((record) => record.kind === 'unresolvable')).toEqual([]);
    // weights.json is committed, so its absence is not recorded.
    expect(report.report?.records.some((record) => record.kind === 'weights-absent')).toBe(false);
    // The published dataset holds every tracked entry, pruned ones included.
    expect(report.dataset).not.toBeNull();
    expect(DatasetFileSchema.safeParse(report.dataset).success).toBe(true);
    expect(report.dataset?.entries.map((entry) => entry.entryKey)).toEqual(
      [...new Set(tracked.entries.map(canonicalKey))].toSorted(compareCanonicalKeys),
    );
  });
});

interface Run {
  readonly code: number | null;
  readonly stdout: string;
  readonly stderr: string;
}

/** Spawns the script the way `pnpm sync:dry` does, with both streams piped. */
function runScript(): Promise<Run> {
  return new Promise((resolve) => {
    const child = execFile(process.execPath, [SCRIPT], { encoding: 'utf8' }, (_error, stdout, stderr) => {
      resolve({ code: child.exitCode, stdout, stderr });
    });
  });
}

/** Every path under `data/` with its size and modification time. */
function snapshot(directory: string): Record<string, string> {
  const found: Record<string, string> = {};
  let names: string[];
  try {
    names = readdirSync(directory);
  } catch {
    return found;
  }
  for (const name of names) {
    const path = join(directory, name);
    const stats = statSync(path);
    if (stats.isDirectory()) {
      Object.assign(found, snapshot(path));
    } else {
      found[path] = `${String(stats.size)}:${String(stats.mtimeMs)}`;
    }
  }
  return found;
}

describe('pnpm sync:dry', () => {
  it('exits 0, prints the same parseable JSON twice, and writes nothing to disk', async () => {
    const before = snapshot(DATA_DIR);

    const first = await runScript();
    const second = await runScript();

    expect(first.code, first.stderr).toBe(0);
    expect(second.code, second.stderr).toBe(0);
    expect(second.stdout).toBe(first.stdout);
    expect(first.stderr).toBe('');

    const report = JSON.parse(first.stdout) as Record<string, unknown>;
    expect(Object.keys(report)).toEqual([
      'outcome',
      'completed',
      'entries',
      'progress',
      'dataset',
      'records',
      'report',
    ]);
    expect(report['outcome']).toBe('completed');
    // Printed as written: the schema accepts it and its keys are in declared order.
    expect(DatasetFileSchema.safeParse(report['dataset']).success).toBe(true);
    expect(Object.keys(report['dataset'] as object)).toEqual([
      'schemaVersion',
      'league',
      'generatedAt',
      'entries',
      'currencyRates',
    ]);

    // The run-report assertion Story 1.5 left open: the schema accepts it, in
    // declared key order, with all three sources present.
    expect(SyncReportFileSchema.safeParse(report['report']).success).toBe(true);
    const printed = report['report'] as SyncReportFile;
    expect(Object.keys(printed)).toEqual(['runStartedAt', 'runFinishedAt', 'figures', 'records', 'schemaVersion']);
    expect(Object.keys(printed.figures.requestsBySource).toSorted()).toEqual([
      'league-validation',
      'tracked-list',
    ]);
    expect(printed.figures.requestsBySource['tracked-list']).toBeGreaterThan(0);
    // The league gate ran once, against the recorded leagues fixture (Story 1.11).
    expect(printed.figures.requestsBySource['league-validation']).toBe(1);
    expect(printed.records.some((record) => record.kind === 'league-mismatch')).toBe(false);

    expect(snapshot(DATA_DIR)).toEqual(before);
  });
});
