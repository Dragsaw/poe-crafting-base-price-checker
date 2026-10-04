import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

import {
  canonicalKey,
  compareCanonicalKeys,
  createFakeClockPort,
  createFakeFilesystemPort,
  createFakeGitPort,
  createFakeHttpPort,
  DatasetFileSchema,
  SyncProgressFileSchema,
  SUPPORTED_SCHEMA_VERSION,
  SYNC_PROGRESS_SCHEMA_VERSION,
  SYNC_REPORT_SCHEMA_VERSION,
  SyncReportFileSchema,
  TRACKED_SCHEMA_VERSION,
  trackedEarlierMajorMessage,
  WEIGHTS_SCHEMA_VERSION,
} from '@poe/contracts';
import type {
  DatasetEntry,
  DatasetFile,
  FakeFilesystemPort,
  HttpPort,
  HttpResponse,
  PinnedStarvationRecord,
  SyncReportFile,
  SyncRunRecord,
  TrackedEntry,
} from '@poe/contracts';
import { describe, expect, it } from 'vitest';

import type { CatalogueIds } from '../catalogue/catalogue-ids.ts';
import { WEIGHTS_PATH } from '../catalogue/weights-ids.ts';
import {
  createLeagueGate,
  LeagueMismatchError,
  LeagueRequestRejectedError,
} from '../league/league-gate.ts';
import { DataFileError } from '../load-data-file.ts';
import { PinnedCapExceededError, pinnedStarvationRecord } from '../pinned-cap.ts';
import { MalformedRequestError, UnexpectedTradeResponseError } from '../pricing/price-entry.ts';
import { createRequestCounter, zeroRequests } from '../request-counter.ts';
import { createTradeClient } from '../trade/client.ts';
import { TRADE_LEAGUES_URL } from '../trade/endpoints.ts';
import { InvalidArtifactError } from '../write-artifact.ts';
import { CrossFileGateError } from './cross-file-gate.ts';
import { LOCK_PATH, serialiseLock } from './lock.ts';
import { DATASET_PATH, PROGRESS_PATH, REPORT_PATH, runChunk, TRACKED_PATH } from './run-chunk.ts';
import type {
  ChunkOutcome,
  ChunkPorts,
  ChunkPublication,
  ChunkSetup,
  ChunkStep,
  StepResult,
} from './run-chunk.ts';

/**
 * The runner's ports as the tests build them: the shell's `load` hook is made
 * from `publication`, `starvationRecord` and `gate` overrides by `run` below.
 */
type TestPorts = Omit<ChunkPorts, 'load'> & {
  readonly publication?: ChunkPublication;
  readonly starvationRecord?: ChunkSetup['starvationRecord'];
  readonly gate?: NonNullable<ChunkSetup['gate']>;
  /** Replaces the `load` the adapter builds, e.g. to count its calls. */
  readonly load?: ChunkPorts['load'];
};

const DEFAULT_STARVATION: ChunkSetup['starvationRecord'] = (starvation) =>
  pinnedStarvationRecord(starvation, { minChunkSearches: 10 });

const NOW = '2026-09-26T12:00:00.000Z';
/** Five hours before NOW: a live lock. */
const FIVE_HOURS_AGO = '2026-09-26T07:00:00.000Z';
/** Seven hours before NOW: a stale lock. */
const SEVEN_HOURS_AGO = '2026-09-26T05:00:00.000Z';
const PID = 1000;
const PUBLICATION: ChunkPublication = { league: 'Standard', currencyRates: [] };

/** Runs a chunk whose `load` answers the test's publication, starvation record, gate and step. */
function run(ports: TestPorts, step: ChunkStep): Promise<ChunkOutcome> {
  const { publication = PUBLICATION, starvationRecord = DEFAULT_STARVATION, gate, load, ...base } = ports;
  return runChunk({
    ...base,
    load:
      load ?? (() => Promise.resolve({ publication, starvationRecord, step, ...(gate && { gate }) })),
  });
}

function raw(baseTypeId: string, status: TrackedEntry['status'] = 'active'): TrackedEntry {
  return status === 'pruned'
    ? { kind: 'raw', baseTypeId, itemLevelMin: 82, status, prunedReason: 'no market' }
    : { kind: 'raw', baseTypeId, itemLevelMin: 82, status };
}

const A = raw('A');
const B = raw('B');
const C = raw('C');
const PRUNED = raw('P', 'pruned');
const key = canonicalKey;

function noListingsEntry(entry: TrackedEntry): DatasetEntry {
  return { entryKey: key(entry), price: { state: 'no-listings' }, lastAttemptedAt: NOW };
}

function trackedText(entries: readonly TrackedEntry[]): string {
  return JSON.stringify({ schemaVersion: TRACKED_SCHEMA_VERSION, entries });
}

function progressText(completed: readonly string[]): string {
  return JSON.stringify({ schemaVersion: '1.0.0', completed });
}

/** A set that holds every id except the ones named: a catalogue that is not the test's subject. */
class EverySetExcept extends Set<string> {
  readonly #missing: ReadonlySet<string>;

  constructor(missing: readonly string[] = []) {
    super();
    this.#missing = new Set(missing);
  }

  override has(id: string): boolean {
    return !this.#missing.has(id);
  }
}

/** A catalogue that exposes every id except the ones named. */
function catalogueWithout(...missing: string[]): CatalogueIds {
  return {
    statIds: new EverySetExcept(missing),
    baseTypeIds: new EverySetExcept(missing),
    categoryIds: new EverySetExcept(missing),
  };
}

/** A catalogue in which every tracked id resolves. */
const RESOLVES_ALL = catalogueWithout();

/**
 * The read-only git port, the request counter, the starvation record and the
 * catalogue every runner needs: no history, nothing counted, a yardstick of
 * 10, and every id resolving.
 */
function shellPorts(): Pick<TestPorts, 'git' | 'requests' | 'starvationRecord' | 'catalogue'> {
  return {
    git: createFakeGitPort(),
    requests: createRequestCounter(),
    starvationRecord: (starvation) => pinnedStarvationRecord(starvation, { minChunkSearches: 10 }),
    catalogue: () => Promise.resolve({ ok: true, value: RESOLVES_ALL }),
  };
}

/** A present weights file with no ids: no weights record arises. */
const EMPTY_WEIGHTS = JSON.stringify({ schemaVersion: WEIGHTS_SCHEMA_VERSION, gamePatch: '0.5.5', producer: { id: 'test', generatedAt: '2026-09-26T00:00:00Z' }, bases: {} });

interface Harness {
  readonly fs: FakeFilesystemPort;
  readonly ports: TestPorts;
  readonly logs: string[];
}

function harness(
  entries: readonly TrackedEntry[] = [A, B, C, PRUNED],
  extra: Parameters<typeof createFakeFilesystemPort>[0] = {},
  overrides: Partial<TestPorts> = {},
): Harness {
  const fs = createFakeFilesystemPort({
    [TRACKED_PATH]: { contents: trackedText(entries) },
    [WEIGHTS_PATH]: { contents: EMPTY_WEIGHTS },
    ...extra,
  });
  const logs: string[] = [];
  const { publication = PUBLICATION, ...rest } = overrides;
  const ports: TestPorts = {
    fs,
    clock: createFakeClockPort(NOW),
    pid: PID,
    ...shellPorts(),
    log: (line) => {
      logs.push(line);
    },
    ...rest,
    publication,
  };
  return { fs, ports, logs };
}

/** A step that answers from a script keyed by entry, recording each visit. */
function scriptedStep(script: (entry: TrackedEntry) => StepResult = () => ({ kind: 'completed' })): {
  readonly visited: string[];
  readonly step: ChunkStep;
} {
  const visited: string[] = [];
  return {
    visited,
    step: (entry) => {
      visited.push(key(entry));
      return Promise.resolve(script(entry));
    },
  };
}

async function progressOf(fs: FakeFilesystemPort): Promise<unknown> {
  const text = await fs.readTextFile(PROGRESS_PATH);
  return text === undefined ? undefined : SyncProgressFileSchema.parse(JSON.parse(text));
}

async function reportOf(fs: FakeFilesystemPort): Promise<SyncReportFile | undefined> {
  const text = await fs.readTextFile(REPORT_PATH);
  return text === undefined ? undefined : SyncReportFileSchema.parse(JSON.parse(text));
}

describe('runChunk: the three bounds and the yield', () => {
  it('workload bound: completes every non-pruned entry, writes progress, releases the lock', async () => {
    const { fs, ports } = harness();
    const { visited, step } = scriptedStep(() => ({
      kind: 'completed',
      searchRemaining: 10,
      fetchRemaining: 10,
    }));

    const outcome = await run(ports, step);

    expect(outcome).toEqual({ kind: 'completed', completed: [key(A), key(B), key(C)], entries: [], records: [] });
    expect(visited).toEqual([key(A), key(B), key(C)]);
    expect(await progressOf(fs)).toEqual({
      schemaVersion: SYNC_PROGRESS_SCHEMA_VERSION,
      completed: [key(A), key(B), key(C)],
    });
    expect(await fs.exists(LOCK_PATH)).toBe(false);
  });

  it('search bound: stops after the entry whose search allowance fell below 1', async () => {
    const { fs, ports } = harness();
    const { visited, step } = scriptedStep((entry) => ({
      kind: 'completed',
      searchRemaining: key(entry) === key(B) ? 0 : 5,
      fetchRemaining: 5,
    }));

    const outcome = await run(ports, step);

    expect(outcome).toMatchObject({ kind: 'bounded', bound: 'search', completed: [key(A), key(B)] });
    expect(visited).not.toContain(key(C));
    expect(await progressOf(fs)).toEqual({ schemaVersion: SYNC_PROGRESS_SCHEMA_VERSION, completed: [key(A), key(B)] });
    expect(await fs.exists(LOCK_PATH)).toBe(false);
  });

  it('fetch bound: stops after the entry whose fetch allowance fell below 1', async () => {
    const { ports } = harness();
    const { visited, step } = scriptedStep((entry) => ({
      kind: 'completed',
      searchRemaining: 5,
      fetchRemaining: key(entry) === key(A) ? 0 : 5,
    }));

    const outcome = await run(ports, step);

    expect(outcome).toMatchObject({ kind: 'bounded', bound: 'fetch', completed: [key(A)] });
    expect(visited).toEqual([key(A)]);
  });

  it('an allowance below 1 on the last entry is completed, not bounded: no work is left', async () => {
    const { fs, ports } = harness([A, B]);
    const { step } = scriptedStep((entry) => ({
      kind: 'completed',
      searchRemaining: key(entry) === key(B) ? 0 : 5,
    }));

    const outcome = await run(ports, step);

    expect(outcome).toEqual({ kind: 'completed', completed: [key(A), key(B)], entries: [], records: [] });
    expect(await progressOf(fs)).toEqual({ schemaVersion: SYNC_PROGRESS_SCHEMA_VERSION, completed: [key(A), key(B)] });
  });

  it('an allowance of exactly 1 does not bound', async () => {
    const { ports } = harness();
    const { visited, step } = scriptedStep(() => ({
      kind: 'completed',
      searchRemaining: 1,
      fetchRemaining: 1,
    }));

    const outcome = await run(ports, step);

    expect(outcome.kind).toBe('completed');
    expect(visited).toEqual([key(A), key(B), key(C)]);
  });

  it('an absent allowance bounds nothing, because nothing was observed', async () => {
    const { ports } = harness();
    const outcome = await run(ports, scriptedStep().step);
    expect(outcome.kind).toBe('completed');
    expect(outcome.completed).toHaveLength(3);
  });

  it('yield: the yielded entry is not completed, and the outcome is a value, not a throw', async () => {
    const { fs, ports } = harness();
    const { visited, step } = scriptedStep((entry) =>
      ({ kind: key(entry) === key(B) ? 'yielded' : 'completed' }),
    );

    const outcome = await run(ports, step);

    expect(outcome).toEqual({ kind: 'yielded', completed: [key(A)], entries: [], records: [] });
    expect(visited).toEqual([key(A), key(B)]);
    expect(await progressOf(fs)).toEqual({ schemaVersion: SYNC_PROGRESS_SCHEMA_VERSION, completed: [key(A)] });
    expect(await fs.exists(LOCK_PATH)).toBe(false);
  });

  it('never visits a pruned entry', async () => {
    const { ports } = harness();
    const { visited, step } = scriptedStep();
    await run(ports, step);
    expect(visited).not.toContain(key(PRUNED));
  });

  it('treats an absent tracked list as an empty workload', async () => {
    const fs = createFakeFilesystemPort();
    const { visited, step } = scriptedStep();

    const outcome = await run(
      { fs, clock: createFakeClockPort(NOW), pid: PID, ...shellPorts(), publication: PUBLICATION },
      step,
    );

    expect(outcome).toEqual({ kind: 'completed', completed: [], entries: [], records: [] });
    expect(visited).toEqual([]);
    expect(await fs.exists(LOCK_PATH)).toBe(false);
  });
});

function stepEntryOf(tracked: TrackedEntry, state: 'no-listings' | 'never-synced'): DatasetEntry {
  return {
    entryKey: key(tracked),
    price:
      state === 'no-listings'
        ? { state: 'no-listings' }
        : { state: 'not-yet-synced', reason: 'never-synced' },
    lastAttemptedAt: NOW,
  };
}

describe('runChunk: the step entries', () => {
  it('collects completed and yielded entries on the outcome, in visiting order', async () => {
    const { ports } = harness();
    const { step } = scriptedStep((entry) =>
      key(entry) === key(B)
        ? { kind: 'yielded', entry: stepEntryOf(entry, 'never-synced') }
        : { kind: 'completed', entry: stepEntryOf(entry, 'no-listings') },
    );

    const outcome = await run(ports, step);

    expect(outcome.kind).toBe('yielded');
    expect(outcome.completed).toEqual([key(A)]);
    expect(outcome.entries).toEqual([stepEntryOf(A, 'no-listings'), stepEntryOf(B, 'never-synced')]);
  });

  it('a step that returns no entry adds nothing', async () => {
    const { ports } = harness();
    const outcome = await run(ports, scriptedStep().step);
    expect(outcome.entries).toEqual([]);
  });
});

async function datasetOf(fs: FakeFilesystemPort): Promise<DatasetFile | undefined> {
  const text = await fs.readTextFile(DATASET_PATH);
  return text === undefined ? undefined : DatasetFileSchema.parse(JSON.parse(text));
}

function previousFile(entries: readonly DatasetEntry[]): string {
  return `${JSON.stringify(
    { schemaVersion: SUPPORTED_SCHEMA_VERSION, league: 'Old League', generatedAt: SEVEN_HOURS_AGO, entries, currencyRates: [] },
    null,
    2,
  )}\n`;
}

function neverSynced(tracked: TrackedEntry): DatasetEntry {
  return { entryKey: key(tracked), price: { state: 'not-yet-synced', reason: 'never-synced' } };
}

function noListings(tracked: TrackedEntry, at = NOW): DatasetEntry {
  return { entryKey: key(tracked), price: { state: 'no-listings' }, lastAttemptedAt: at };
}

describe('runChunk: the published dataset', () => {
  const DIVINE: ChunkPublication['currencyRates'][number] = {
    currencyId: 'divine',
    rate: 1,
    source: 'measured',
    league: 'Old League',
    asOf: '2026-09-01T00:00:00Z',
  };
  const RATES = [DIVINE];
  const PUBLISHING: ChunkPublication = { league: 'New League', currencyRates: RATES };

  it('completed: one entry per tracked entry, pruned included, sorted, with the passed-in league and rates', async () => {
    const { fs, ports } = harness([C, A, B, PRUNED], {}, { publication: PUBLISHING });
    const step = scriptedStep((entry) =>
      key(entry) === key(B) ? { kind: 'completed', entry: noListings(entry) } : { kind: 'completed' },
    ).step;

    const outcome = await run(ports, step);
    expect(outcome.kind).toBe('completed');

    const expectedKeys = [key(A), key(B), key(C), key(PRUNED)].toSorted(compareCanonicalKeys);
    expect(await datasetOf(fs)).toEqual({
      schemaVersion: SUPPORTED_SCHEMA_VERSION,
      league: 'New League',
      generatedAt: NOW,
      entries: expectedKeys.map((entryKey) =>
        entryKey === key(B) ? noListings(B) : { entryKey, price: { state: 'not-yet-synced', reason: 'never-synced' } },
      ),
      currencyRates: RATES,
    });
  });

  it('writes the schema’s key order, LF, no BOM and one trailing newline, whatever order the caller built', async () => {
    const { fs, ports } = harness([A], {}, { publication: PUBLISHING });
    await run(ports, scriptedStep().step);

    const text = (await fs.readTextFile(DATASET_PATH)) ?? '';
    expect(text.codePointAt(0)).not.toBe(0xFE_FF);
    expect(text).not.toContain('\r');
    expect(text.endsWith('}\n')).toBe(true);
    expect(text.endsWith('\n\n')).toBe(false);
    expect(Object.keys(JSON.parse(text) as object)).toEqual([
      'schemaVersion',
      'league',
      'generatedAt',
      'entries',
      'currencyRates',
    ]);
  });

  it('carry-over: an unvisited previous entry is written byte-identical; an untracked key is dropped', async () => {
    const carried: DatasetEntry = {
      entryKey: key(C),
      price: { state: 'no-listings' },
      lastAttemptedAt: FIVE_HOURS_AGO,
      lastSearchId: 'abc',
      lastSearchLeague: 'Old League',
    };
    const gone = noListings(raw('GONE'), FIVE_HOURS_AGO);
    const previous = previousFile([carried, gone]);
    const { fs, ports } = harness([A, C], { [DATASET_PATH]: { contents: previous } });
    // A is never attempted, so it goes first; the chunk bounds after it and never visits C.
    const step = scriptedStep(() => ({ kind: 'completed', searchRemaining: 0 })).step;

    const outcome = await run(ports, step);

    expect(outcome.kind).toBe('bounded');
    const written = (await fs.readTextFile(DATASET_PATH)) ?? '';
    const block = JSON.stringify(carried, null, 2).split('\n').map((line) => `    ${line}`).join('\n');
    expect(previous).toContain(block);
    expect(written).toContain(block);
    const dataset = await datasetOf(fs);
    expect(dataset?.entries.map((entry) => entry.entryKey)).toEqual(
      [key(A), key(C)].toSorted(compareCanonicalKeys),
    );
    expect(written).not.toContain(gone.entryKey);
  });

  it('league change: a previous observation from another league is carried over unchanged', async () => {
    const priced: DatasetEntry = {
      entryKey: key(B),
      price: {
        state: 'priced',
        observation: {
          league: 'Old League',
          observedAt: FIVE_HOURS_AGO,
          priceDivine: 0.5,
          sampleSize: 10,
          exchangeObservation: DIVINE,
        },
      },
      lastAttemptedAt: FIVE_HOURS_AGO,
    };
    const { fs, ports } = harness([B], { [DATASET_PATH]: { contents: previousFile([priced]) } }, {
      publication: PUBLISHING,
    });

    // The step returns no entry for B, so its previous observation carries over.
    await run(ports, scriptedStep(() => ({ kind: 'completed', searchRemaining: 0 })).step);

    expect(await datasetOf(fs)).toMatchObject({ league: 'New League', entries: [priced] });
  });

  it('pruned: keeps its previous entry, or is never-synced', async () => {
    const PRUNED_TOO = raw('Q', 'pruned');
    const kept = noListings(PRUNED, SEVEN_HOURS_AGO);
    const { fs, ports } = harness([PRUNED, PRUNED_TOO], { [DATASET_PATH]: { contents: previousFile([kept]) } });

    await run(ports, scriptedStep().step);

    const dataset = await datasetOf(fs);
    expect(dataset?.entries).toEqual(
      [kept, neverSynced(PRUNED_TOO)].toSorted((a, b) => compareCanonicalKeys(a.entryKey, b.entryKey)),
    );
  });

  it('yielded: the stamped entry replaces the previous one', async () => {
    const stamped: DatasetEntry = {
      entryKey: key(A),
      price: { state: 'no-listings' },
      lastAttemptedAt: NOW,
      lastSearchId: 'old-search',
    };
    const previous = { ...stamped, lastAttemptedAt: SEVEN_HOURS_AGO };
    const { fs, ports } = harness([A], { [DATASET_PATH]: { contents: previousFile([previous]) } });

    const outcome = await run(ports, scriptedStep(() => ({ kind: 'yielded', entry: stamped })).step);

    expect(outcome.kind).toBe('yielded');
    const dataset = await datasetOf(fs);
    expect(dataset?.entries).toEqual([stamped]);
  });

  it('re-serialise: the same inputs write byte-identical files', async () => {
    const texts: (string | undefined)[] = [];
    for (let attempt = 0; attempt < 2; attempt += 1) {
      const { fs, ports } = harness(undefined, {}, { publication: PUBLISHING });
      await run(ports, scriptedStep((entry) => ({ kind: 'completed', entry: noListings(entry) })).step);
      texts.push(await fs.readTextFile(DATASET_PATH));
    }
    expect(texts[0]).toBeDefined();
    expect(texts[1]).toBe(texts[0]);
  });

  it('busy: writes no dataset', async () => {
    const held = serialiseLock({ pid: 7, startedAt: FIVE_HOURS_AGO });
    const { fs, ports } = harness(undefined, { [LOCK_PATH]: { contents: held } });
    const outcome = await run(ports, scriptedStep().step);
    expect(outcome.kind).toBe('busy');
    expect(await fs.exists(DATASET_PATH)).toBe(false);
  });

  it('dispossessed: writes no dataset', async () => {
    const { fs, ports } = harness();
    const outcome = await run(ports, (entry) => {
      fs.setFile(LOCK_PATH, { contents: serialiseLock({ pid: 99, startedAt: NOW }) });
      return Promise.resolve({ kind: 'completed', entry: noListings(entry) });
    });
    expect(outcome.kind).toBe('dispossessed');
    expect(await fs.exists(DATASET_PATH)).toBe(false);
  });

  it('a step throw publishes the entries completed before it', async () => {
    const { fs, ports } = harness();
    await expect(
      run(ports, (entry) =>
        key(entry) === key(B)
          ? Promise.reject(new Error('step exploded'))
          : Promise.resolve({ kind: 'completed', entry: noListings(entry) }),
      ),
    ).rejects.toThrow('step exploded');
    const published = await datasetOf(fs);
    expect(published?.entries.find((entry) => entry.entryKey === key(A))).toEqual(noListings(A));
    expect(published?.entries.find((entry) => entry.entryKey === key(B))).toEqual(neverSynced(B));
  });

  it('an invalid artifact is refused: InvalidArtifactError, the file untouched, no progress, lock released', async () => {
    const previous = previousFile([noListings(A, SEVEN_HOURS_AGO)]);
    const { fs, ports } = harness([A], { [DATASET_PATH]: { contents: previous } });
    const invalid = { ...noListings(A), lastAttemptedAt: 'not a timestamp' };

    const failure = run(ports, scriptedStep(() => ({ kind: 'completed', entry: invalid })).step);

    await expect(failure).rejects.toBeInstanceOf(InvalidArtifactError);
    await expect(failure).rejects.toMatchObject({ path: DATASET_PATH });
    expect(await fs.readTextFile(DATASET_PATH)).toBe(previous);
    expect(await fs.exists(PROGRESS_PATH)).toBe(false);
    expect(await fs.exists(LOCK_PATH)).toBe(false);
  });
});

describe('runChunk: resume and pass', () => {
  it('resume: starts after the completed entry, recomputed from the tracked list', async () => {
    const { fs, ports } = harness(undefined, {
      [PROGRESS_PATH]: { contents: progressText([key(A)]) },
    });
    const { visited, step } = scriptedStep();

    const outcome = await run(ports, step);

    expect(visited).toEqual([key(B), key(C)]);
    expect(outcome.completed).toEqual([key(B), key(C)]);
    expect(await progressOf(fs)).toEqual({
      schemaVersion: SYNC_PROGRESS_SCHEMA_VERSION,
      completed: [key(A), key(B), key(C)],
    });
  });

  it('pass complete: every non-pruned key done restarts the pass with an empty completed set', async () => {
    const { fs, ports } = harness(undefined, {
      [PROGRESS_PATH]: { contents: progressText([key(A), key(B), key(C)]) },
    });
    const { visited, step } = scriptedStep((entry) =>
      key(entry) === key(A) ? { kind: 'completed', searchRemaining: 0 } : { kind: 'completed' },
    );

    await run(ports, step);

    expect(visited).toEqual([key(A)]);
    // The earlier pass's B and C are gone: only this pass's work is recorded.
    expect(await progressOf(fs)).toEqual({ schemaVersion: SYNC_PROGRESS_SCHEMA_VERSION, completed: [key(A)] });
  });

  // Story hybrid-mods 2, I/O matrix "Old progress keys": a key the 2.0.0 tracked
  // schema can no longer produce (an absent affix encoded as `null`) ages out.
  it('drops a progress key absent from the current tracked key set, without throwing', async () => {
    const oldKey = '["crafted","weapon.bow","Bows",82,["explicit.stat_1",1,2],null]';
    const { fs, ports } = harness(undefined, {
      [PROGRESS_PATH]: { contents: progressText([oldKey, key(A)]) },
    });
    const { visited, step } = scriptedStep();

    await run(ports, step);

    expect(visited).toEqual([key(B), key(C)]);
    expect(await progressOf(fs)).toEqual({ schemaVersion: SYNC_PROGRESS_SCHEMA_VERSION, completed: [key(A), key(B), key(C)] });
  });

  it('records completed entries only, never the planned ones', async () => {
    const { fs, ports } = harness();
    await run(ports, scriptedStep(() => ({ kind: 'yielded' })).step);
    expect(await progressOf(fs)).toEqual({ schemaVersion: SYNC_PROGRESS_SCHEMA_VERSION, completed: [] });
  });

  it('refuses a progress file of an unknown major and still releases the lock', async () => {
    const { fs, ports } = harness(undefined, {
      [PROGRESS_PATH]: { contents: JSON.stringify({ schemaVersion: '9.0.0', completed: [] }) },
    });
    await expect(run(ports, scriptedStep().step)).rejects.toThrow(/9\.0\.0/);
    expect(await fs.exists(LOCK_PATH)).toBe(false);
    // Read before the gate now, it still fails the run at its usual place, with a report.
    const report = SyncReportFileSchema.parse(JSON.parse((await fs.readTextFile(REPORT_PATH)) ?? ''));
    expect(report.records).toEqual([expect.objectContaining({ kind: 'run-failure' })]);
    expect('runFinishedAt' in report).toBe(false);
  });

  it('serialises progress through writeArtifact: the schema’s key order, LF, one trailing newline', async () => {
    const { fs, ports } = harness([A]);
    await run(ports, scriptedStep().step);
    // `SyncProgressFileSchema` extends the progress shape with `schemaVersion`,
    // so the declared order puts it last.
    expect(await fs.readTextFile(PROGRESS_PATH)).toBe(
      `{\n  "completed": [\n    ${JSON.stringify(key(A))}\n  ],\n  "schemaVersion": "1.2.0"\n}\n`,
    );
  });
});

describe('runChunk: the lock', () => {
  it('takes the lock as exactly {pid, startedAt} from the clock', async () => {
    const { fs, ports } = harness();
    let seen: string | undefined;
    await run(ports, async () => {
      seen = await fs.readTextFile(LOCK_PATH);
      return { kind: 'completed' };
    });
    expect(seen).toBe(serialiseLock({ pid: PID, startedAt: NOW }));
    expect(JSON.parse(seen ?? '')).toEqual({ pid: PID, startedAt: NOW });
  });

  it('busy lock: writes nothing, leaves the lock untouched, logs one line', async () => {
    const held = serialiseLock({ pid: 7, startedAt: FIVE_HOURS_AGO });
    let loads = 0;
    const { fs, ports, logs } = harness(undefined, { [LOCK_PATH]: { contents: held } }, {
      load: () => {
        loads += 1;
        return Promise.reject(new Error('load must not run on a busy chunk'));
      },
    });
    const { visited, step } = scriptedStep();

    const outcome = await run(ports, step);

    expect(outcome).toEqual({ kind: 'busy', completed: [], entries: [], records: [] });
    expect(loads).toBe(0);
    expect(visited).toEqual([]);
    expect(await fs.readTextFile(LOCK_PATH)).toBe(held);
    expect(await fs.exists(PROGRESS_PATH)).toBe(false);
    expect(logs).toHaveLength(1);
    expect(logs[0]).toContain('pid 7');
  });

  it('treats a lock exactly at the threshold as live: staleness is strictly greater', async () => {
    const held = serialiseLock({ pid: 7, startedAt: '2026-09-26T06:00:00.000Z' });
    const { ports } = harness(undefined, { [LOCK_PATH]: { contents: held } });
    const outcome = await run(ports, scriptedStep().step);
    expect(outcome.kind).toBe('busy');
  });

  it('judges staleness by time, never by pid: its own pid in a live lock is still busy', async () => {
    const held = serialiseLock({ pid: PID, startedAt: FIVE_HOURS_AGO });
    const { ports } = harness(undefined, { [LOCK_PATH]: { contents: held } });
    const outcome = await run(ports, scriptedStep().step);
    expect(outcome.kind).toBe('busy');
  });

  it('stale lock: breaks and retakes it, runs the chunk, records the old pid and startedAt', async () => {
    const stale = serialiseLock({ pid: 7, startedAt: SEVEN_HOURS_AGO });
    const { fs, ports } = harness(undefined, { [LOCK_PATH]: { contents: stale } });
    let during: string | undefined;

    const outcome = await run(ports, async () => {
      during = await fs.readTextFile(LOCK_PATH);
      return { kind: 'completed' };
    });

    expect(during).toBe(serialiseLock({ pid: PID, startedAt: NOW }));
    expect(outcome.kind).toBe('completed');
    expect(outcome.completed).toHaveLength(3);
    expect(outcome.records).toEqual([
      { kind: 'stale-lock-broken', pid: 7, startedAt: SEVEN_HOURS_AGO },
    ]);
    expect(await fs.exists(LOCK_PATH)).toBe(false);
    expect(fs.paths()).not.toContain('data/sync.break.lock');
  });

  it('race: two runners breaking the same stale lock, exactly one takes it', async () => {
    const stale = serialiseLock({ pid: 7, startedAt: SEVEN_HOURS_AGO });
    const fs = createFakeFilesystemPort({
      [TRACKED_PATH]: { contents: trackedText([A, B]) },
      [LOCK_PATH]: { contents: stale },
    });
    const clock = createFakeClockPort(NOW);
    const first = scriptedStep();
    const second = scriptedStep();

    const outcomes = await Promise.all([
      run({ fs, clock, pid: 1, ...shellPorts(), publication: PUBLICATION, log: () => {} }, first.step),
      run({ fs, clock, pid: 2, ...shellPorts(), publication: PUBLICATION, log: () => {} }, second.step),
    ]);

    const kinds = outcomes.map((outcome) => outcome.kind).toSorted((a, b) => Number(a > b) - Number(a < b));
    expect(kinds).toEqual(['busy', 'completed']);
    expect(first.visited.length + second.visited.length).toBe(2);
    expect(outcomes.flatMap((outcome) => outcome.records)).toHaveLength(1);
    expect(await fs.exists(LOCK_PATH)).toBe(false);
  });

  it('race: many runners on a free lock, exactly one runs', async () => {
    const fs = createFakeFilesystemPort({ [TRACKED_PATH]: { contents: trackedText([A]) } });
    const clock = createFakeClockPort(NOW);
    const outcomes = await Promise.all(
      [1, 2, 3, 4].map((pid) =>
        run(
          { fs, clock, pid, ...shellPorts(), publication: PUBLICATION, log: () => {} },
          scriptedStep().step,
        ),
      ),
    );
    expect(outcomes.filter((outcome) => outcome.kind === 'completed')).toHaveLength(1);
    expect(outcomes.filter((outcome) => outcome.kind === 'busy')).toHaveLength(3);
  });

  it('dispossessed: a lock replaced mid-chunk means no progress write and no release', async () => {
    const { fs, ports, logs } = harness();
    const successor = serialiseLock({ pid: 99, startedAt: NOW });

    const outcome = await run(ports, (entry) => {
      if (key(entry) === key(B)) {
        fs.setFile(LOCK_PATH, { contents: successor });
      }
      return Promise.resolve({ kind: 'completed' });
    });

    expect(outcome.kind).toBe('dispossessed');
    expect(outcome.completed).toEqual([key(A), key(B), key(C)]);
    expect(await fs.exists(PROGRESS_PATH)).toBe(false);
    expect(await fs.readTextFile(LOCK_PATH)).toBe(successor);
    expect(logs).toHaveLength(1);
  });

  it('a throw from the step releases the lock and is rethrown', async () => {
    const { fs, ports } = harness();
    const failure = new Error('step exploded');

    await expect(
      run(ports, (entry) =>
        key(entry) === key(B) ? Promise.reject(failure) : Promise.resolve({ kind: 'completed' }),
      ),
    ).rejects.toBe(failure);

    expect(await fs.exists(LOCK_PATH)).toBe(false);
    // What the chunk completed is kept, and no penalty is remembered.
    expect(await progressOf(fs)).toEqual({ schemaVersion: SYNC_PROGRESS_SCHEMA_VERSION, completed: [key(A)] });
  });

  it('a MalformedRequestError from the step releases the lock and is rethrown', async () => {
    const { fs, ports } = harness();
    const failure = new MalformedRequestError(key(B), 'search', 400, {
      entryKey: key(B),
      price: { state: 'not-yet-synced', reason: 'never-synced' },
      lastAttemptedAt: NOW,
    });

    await expect(
      run(ports, (entry) =>
        key(entry) === key(B) ? Promise.reject(failure) : Promise.resolve({ kind: 'completed' }),
      ),
    ).rejects.toBe(failure);

    expect(await fs.exists(LOCK_PATH)).toBe(false);
  });

  it('a throw from the gate releases the lock, is rethrown, and no step runs', async () => {
    const failure = new Error('gate refused');
    const { fs, ports } = harness(undefined, {}, { gate: () => Promise.reject(failure) });
    const { visited, step } = scriptedStep();

    await expect(run(ports, step)).rejects.toBe(failure);

    expect(visited).toEqual([]);
    expect(await fs.exists(LOCK_PATH)).toBe(false);
  });

  it('runs the gate under the lock, with the tracked entries, before any step', async () => {
    const order: string[] = [];
    let lockDuringGate: boolean | undefined;
    const { fs, ports } = harness([A], {}, {
      gate: async ({ entries }) => {
        lockDuringGate = await fs.exists(LOCK_PATH);
        order.push(`gate:${String(entries.length)}`);
        return { kind: 'pass' };
      },
    });

    await run(ports, () => {
      order.push('step');
      return Promise.resolve({ kind: 'completed' });
    });

    expect(order).toEqual(['gate:1', 'step']);
    expect(lockDuringGate).toBe(true);
  });

  it('an invalid tracked list throws and still releases the lock', async () => {
    const fs = createFakeFilesystemPort({ [TRACKED_PATH]: { contents: '{not json' } });
    const failure = run(
      { fs, clock: createFakeClockPort(NOW), pid: PID, ...shellPorts(), publication: PUBLICATION },
      scriptedStep().step,
    );
    await expect(failure).rejects.toThrow(/tracked\.json/);
    await expect(failure).rejects.toBeInstanceOf(DataFileError);
    await expect(failure).rejects.toMatchObject({ path: TRACKED_PATH, reason: 'not-json' });
    expect(await fs.exists(LOCK_PATH)).toBe(false);
  });

  it('a tracked list holding one canonical key twice throws before any step and still releases the lock (L-A1)', async () => {
    const { fs, ports } = harness([A, B, A]);
    const { visited, step } = scriptedStep();

    const failure = run(ports, step);

    await expect(failure).rejects.toThrow(/tracked\.json/);
    await expect(failure).rejects.toThrow(key(A));
    expect(visited).toEqual([]);
    expect(await fs.exists(DATASET_PATH)).toBe(false);
    expect(await fs.exists(PROGRESS_PATH)).toBe(false);
    expect(await fs.exists(LOCK_PATH)).toBe(false);
    const report = SyncReportFileSchema.parse(JSON.parse((await fs.readTextFile(REPORT_PATH)) ?? ''));
    const failures = report.records.filter((record) => record.kind === 'run-failure');
    expect(failures).toHaveLength(1);
    expect(failures[0]).toMatchObject({ message: expect.stringContaining('tracked.json') });
    expect(failures[0]).toMatchObject({ message: expect.stringContaining(key(A)) });
  });

  // Story hybrid-mods 2, I/O matrix "Earlier major": IMPLEMENTATION-NOTES §4.1.
  it('refuses a tracked list at the earlier 1.x major with the re-author message, before any step', async () => {
    const fs = createFakeFilesystemPort({
      [TRACKED_PATH]: { contents: JSON.stringify({ schemaVersion: '1.0.0', entries: [A] }) },
    });
    const { visited, step } = scriptedStep();
    const failure = run({ fs, clock: createFakeClockPort(NOW), pid: PID, ...shellPorts(), publication: PUBLICATION }, step);

    await expect(failure).rejects.toBeInstanceOf(DataFileError);
    await expect(failure).rejects.toMatchObject({ path: TRACKED_PATH, reason: 'unknown-major' });
    await expect(failure).rejects.toThrow(String(trackedEarlierMajorMessage('1.0.0')));
    expect(visited).toEqual([]);
    expect(await fs.exists(LOCK_PATH)).toBe(false);
  });

  it('refuses a later or malformed tracked major with the generic message', async () => {
    for (const version of ['3.0.0', 'abc']) {
      const fs = createFakeFilesystemPort({
        [TRACKED_PATH]: { contents: JSON.stringify({ schemaVersion: version, entries: [] }) },
      });
      const failure = run({ fs, clock: createFakeClockPort(NOW), pid: PID, ...shellPorts(), publication: PUBLICATION }, scriptedStep().step);
      await expect(failure).rejects.toThrow(`schemaVersion ${version} refused`);
      await expect(failure).rejects.not.toThrow(/Re-author/);
    }
  });
});

function datasetText(entries: readonly { key: string; at?: string; unresolvable?: boolean }[]): string {
  return JSON.stringify({
    schemaVersion: SUPPORTED_SCHEMA_VERSION,
    league: 'Standard',
    generatedAt: NOW,
    entries: entries.map(({ key: entryKey, at, unresolvable }) => ({
      entryKey,
      price: { state: unresolvable === true ? 'unresolvable' : 'no-listings' },
      ...(at !== undefined && { lastAttemptedAt: at }),
    })),
    currencyRates: [],
  });
}

describe('runChunk: the Refresh Rotation', () => {
  const P1 = raw('P1', 'pinned');
  const P2 = raw('P2', 'pinned');
  const P3 = raw('P3', 'pinned');

  it('orders by the dataset’s lastAttemptedAt, against the clock', async () => {
    const U = raw('U');
    const { fs, ports } = harness([A, B, C, U], {
      [DATASET_PATH]: {
        contents: datasetText([
          { key: key(A), at: FIVE_HOURS_AGO },
          { key: key(B), at: SEVEN_HOURS_AGO },
          { key: key(U), at: '2026-09-25T12:00:00.000Z', unresolvable: true },
        ]),
      },
    });
    const { visited, step } = scriptedStep();

    await run(ports, step);

    // C never attempted, then U, B, A oldest first. U's id resolves again, so
    // it is recovered into row 2 rather than waiting in row 3 (AD-7).
    expect(visited).toEqual([key(C), key(U), key(B), key(A)]);
    expect(await progressOf(fs)).toEqual({
      schemaVersion: SYNC_PROGRESS_SCHEMA_VERSION,
      completed: [key(A), key(B), key(C), key(U)],
    });
  });

  it('an invalid dataset throws and still releases the lock', async () => {
    const { fs, ports } = harness(undefined, { [DATASET_PATH]: { contents: '{"schemaVersion":"2.0.0"}' } });
    const failure = run(ports, scriptedStep().step);
    await expect(failure).rejects.toThrow(/dataset\.json/);
    await expect(failure).rejects.toBeInstanceOf(DataFileError);
    await expect(failure).rejects.toMatchObject({ path: DATASET_PATH, reason: 'unknown-major' });
    expect(await fs.exists(LOCK_PATH)).toBe(false);
  });

  it('a dataset that repeats an entryKey throws rather than healing, and still releases the lock', async () => {
    const { fs, ports } = harness(undefined, {
      [DATASET_PATH]: { contents: datasetText([{ key: key(A) }, { key: key(A) }]) },
    });
    await expect(run(ports, scriptedStep().step)).rejects.toThrow(/dataset\.json.*repeats entries\.0/);
    expect(await fs.exists(LOCK_PATH)).toBe(false);
  });

  it('starvation: 3 pinned, 2 active, R=2 after the first step keeps 1 more pinned, then active', async () => {
    const { fs, ports } = harness([P1, P2, P3, A, B]);
    let remaining = 3;
    const { visited, step } = scriptedStep((entry) => {
      remaining -= 1;
      return entry.status === 'pinned'
        ? { kind: 'completed', searchRemaining: remaining }
        : { kind: 'completed' };
    });

    const outcome = await run(ports, step);

    expect(visited).toEqual([key(P1), key(P2), key(A), key(B)]);
    expect(outcome).toEqual({
      kind: 'completed',
      completed: [key(P1), key(P2), key(A), key(B)],
      entries: [],
      records: [],
      pinnedStarvation: { discoveredAllowance: 3, pinnedCount: 3, pinnedRefreshed: 2, activeRefreshed: 2 },
    });
    // Row 1 is exempt from the pass.
    expect(await progressOf(fs)).toEqual({ schemaVersion: SYNC_PROGRESS_SCHEMA_VERSION, completed: [key(A), key(B)] });
  });

  it('starvation leaves the outcome kind unchanged: the reserved search still bounds the chunk', async () => {
    const { ports } = harness([P1, P2, P3, A, B]);
    let remaining = 3;
    const { visited, step } = scriptedStep(() => {
      remaining -= 1;
      return { kind: 'completed', searchRemaining: remaining };
    });

    const outcome = await run(ports, step);

    expect(visited).toEqual([key(P1), key(P2), key(A)]);
    expect(outcome).toMatchObject({
      kind: 'bounded',
      bound: 'search',
      pinnedStarvation: { discoveredAllowance: 3, pinnedCount: 3, pinnedRefreshed: 2, activeRefreshed: 1 },
    });
  });

  it('starvation with nothing left to cut: 1 pinned reports R=0 while active waits', async () => {
    const { ports } = harness([P1, A]);
    const { visited, step } = scriptedStep((entry) =>
      entry.status === 'pinned' ? { kind: 'completed', searchRemaining: 0 } : { kind: 'completed' },
    );

    const outcome = await run(ports, step);

    // The kind is what the search bound makes it, record or not.
    expect(visited).toEqual([key(P1)]);
    expect(outcome).toEqual({
      kind: 'bounded',
      bound: 'search',
      completed: [key(P1)],
      entries: [],
      records: [],
      pinnedStarvation: { discoveredAllowance: 1, pinnedCount: 1, pinnedRefreshed: 1, activeRefreshed: 0 },
    });
  });

  it('a later pinned step’s first report: discoveredAllowance is R plus the steps taken', async () => {
    const { ports } = harness([P1, P2, P3, A, B]);
    const { visited, step } = scriptedStep((entry) =>
      key(entry) === key(P2) ? { kind: 'completed', searchRemaining: 1 } : { kind: 'completed' },
    );

    const outcome = await run(ports, step);

    expect(visited).toEqual([key(P1), key(P2), key(A), key(B)]);
    expect(outcome).toEqual({
      kind: 'completed',
      completed: [key(P1), key(P2), key(A), key(B)],
      entries: [],
      records: [],
      pinnedStarvation: { discoveredAllowance: 3, pinnedCount: 3, pinnedRefreshed: 2, activeRefreshed: 2 },
    });
  });

  it('a rotation step reporting a low allowance never truncates or records', async () => {
    const { ports } = harness([P1, A, B]);
    const { visited, step } = scriptedStep((entry) =>
      ({ kind: 'completed', searchRemaining: entry.status === 'pinned' ? 5 : 0 }),
    );

    const outcome = await run(ports, step);

    expect(visited).toEqual([key(P1), key(A)]);
    expect(outcome).toEqual({ kind: 'bounded', bound: 'search', completed: [key(P1), key(A)], entries: [], records: [] });
  });

  it('a yield in row 1 after a cut: kind yielded, the record still carried', async () => {
    const { fs, ports } = harness([P1, P2, P3, A, B]);
    const { visited, step } = scriptedStep((entry) =>
      key(entry) === key(P1) ? { kind: 'completed', searchRemaining: 2 } : { kind: 'yielded' },
    );

    const outcome = await run(ports, step);

    expect(visited).toEqual([key(P1), key(P2)]);
    expect(outcome).toEqual({
      kind: 'yielded',
      completed: [key(P1)],
      entries: [],
      records: [],
      pinnedStarvation: { discoveredAllowance: 3, pinnedCount: 3, pinnedRefreshed: 1, activeRefreshed: 0 },
    });
    expect(await progressOf(fs)).toEqual({ schemaVersion: SYNC_PROGRESS_SCHEMA_VERSION, completed: [] });
  });

  it('a recovered pinned + unresolvable entry rejoins row 1, exempt from the pass', async () => {
    const PU = raw('PU', 'pinned');
    const { fs, ports } = harness([PU, A], {
      [DATASET_PATH]: {
        contents: datasetText([{ key: key(PU), at: '2026-09-25T11:00:00.000Z', unresolvable: true }]),
      },
    });
    const { visited, step } = scriptedStep();

    await run(ports, step);

    expect(visited).toEqual([key(PU), key(A)]);
    expect(await progressOf(fs)).toEqual({ schemaVersion: SYNC_PROGRESS_SCHEMA_VERSION, completed: [key(A)] });
  });

  it('no rotation waiting: 3 pinned alone with R=1 are all visited, with no record', async () => {
    const { ports } = harness([P1, P2, P3, PRUNED]);
    const { visited, step } = scriptedStep(() => ({ kind: 'completed', searchRemaining: 1 }));

    const outcome = await run(ports, step);

    expect(visited).toEqual([key(P1), key(P2), key(P3)]);
    expect(outcome).toEqual({ kind: 'completed', completed: visited, entries: [], records: [] });
    expect(outcome.pinnedStarvation).toBeUndefined();
  });

  it('no truncation when the allowance covers the pinned set plus one', async () => {
    const { ports } = harness([P1, P2, A]);
    const { visited, step } = scriptedStep(() => ({ kind: 'completed', searchRemaining: 5 }));
    const outcome = await run(ports, step);
    expect(visited).toEqual([key(P1), key(P2), key(A)]);
    expect(outcome.pinnedStarvation).toBeUndefined();
  });

  it('pinned every chunk: a pinned key in progress is still visited first, and never written', async () => {
    const { fs, ports } = harness([P1, A, B], {
      [PROGRESS_PATH]: { contents: progressText([key(P1), key(A)]) },
    });
    const { visited, step } = scriptedStep();

    await run(ports, step);

    expect(visited).toEqual([key(P1), key(B)]);
    expect(await progressOf(fs)).toEqual({ schemaVersion: SYNC_PROGRESS_SCHEMA_VERSION, completed: [key(A), key(B)] });
  });
});

describe('runChunk: the declared yardstick is never a chunk bound', () => {
  it('runs an identical chunk whatever the player config declares, and never reads it', async () => {
    const outcomes = [];
    for (const declared of [1, 3, 1000]) {
      const { fs, ports } = harness(undefined, {
        'data/config.json': {
          contents: JSON.stringify({ schemaVersion: SUPPORTED_SCHEMA_VERSION, league: 'L', minChunkSearches: declared }),
        },
      });
      const reads: string[] = [];
      const reading = {
        ...fs,
        readTextFile: (path: string) => {
          reads.push(path);
          return fs.readTextFile(path);
        },
      };
      outcomes.push(await run({ ...ports, fs: reading }, scriptedStep().step));
      expect(reads).not.toContain('data/config.json');
    }
    expect(outcomes[0]).toEqual(outcomes[1]);
    expect(outcomes[1]).toEqual(outcomes[2]);
  });

  it('names neither the yardstick nor the config file anywhere in chunk/ source', () => {
    const directory = fileURLToPath(new URL('.', import.meta.url));
    const sources = readdirSync(directory).filter(
      (name) => name.endsWith('.ts') && !name.endsWith('.test.ts'),
    );
    expect(sources.length).toBeGreaterThan(0);
    for (const name of sources) {
      const text = readFileSync(join(directory, name), 'utf8');
      expect(text, name).not.toMatch(/minChunkSearches/);
      expect(text, name).not.toMatch(/config\.json/);
      expect(text, name).not.toMatch(/currencies\.json/);
    }
  });
});

/** P1–P3 pinned and A, B waiting: the first pinned step reports R=2, so P3 is cut. */
function starvingStep(): ChunkStep {
  let remaining = 3;
  return scriptedStep((entry) => {
    remaining -= 1;
    return entry.status === 'pinned'
      ? { kind: 'completed', searchRemaining: remaining }
      : { kind: 'completed' };
  }).step;
}

describe('runChunk: the Sync Report', () => {
  const D = raw('D');
  const E = raw('E');
  const P1 = raw('P1', 'pinned');
  const P2 = raw('P2', 'pinned');
  const P3 = raw('P3', 'pinned');
  const ZERO = { 'tracked-list': 0, 'league-validation': 0, 'session-probe': 0 };
  const STARVED: PinnedStarvationRecord = {
    kind: 'pinned-starvation',
    discoveredAllowance: 3,
    declaredMinChunkSearches: 10,
    pinnedCount: 3,
    pinnedRefreshed: 2,
    activeRefreshed: 2,
  };
  const BROKEN: SyncRunRecord = { kind: 'stale-lock-broken', pid: 7, startedAt: SEVEN_HOURS_AGO };

  function reportText(records: readonly SyncRunRecord[], schemaVersion = '1.0.0'): string {
    return JSON.stringify({
      runStartedAt: SEVEN_HOURS_AGO,
      runFinishedAt: SEVEN_HOURS_AGO,
      figures: { requestsBySource: { ...ZERO, 'tracked-list': 40 }, notReachedCount: 9 },
      records,
      schemaVersion,
    });
  }

  const SEARCH_URL = 'https://example.test/search';
  const FETCH_URL = 'https://example.test/fetch';

  function countedHttp(requests: ReturnType<typeof createRequestCounter>): HttpPort {
    return requests.counted(
      createFakeHttpPort({
        [`POST ${SEARCH_URL}`]: { status: 200, headers: {}, body: '{}' },
        [`GET ${FETCH_URL}`]: { status: 200, headers: {}, body: '{}' },
      }),
      'tracked-list',
    );
  }

  it('first run: 3 searches + 3 fetches count 6 against tracked-list, the others 0, no records, finished', async () => {
    const requests = createRequestCounter();
    const http = countedHttp(requests);
    const { fs, ports } = harness([A, B, C], {}, { requests });

    await run(ports, async () => {
      await http.send({ method: 'POST', url: SEARCH_URL, headers: {} });
      await http.send({ method: 'GET', url: FETCH_URL, headers: {} });
      return { kind: 'completed' };
    });

    expect(await reportOf(fs)).toEqual({
      runStartedAt: NOW,
      runFinishedAt: NOW,
      figures: { requestsBySource: { ...ZERO, 'tracked-list': 6 }, notReachedCount: 0 },
      records: [],
      schemaVersion: SYNC_REPORT_SCHEMA_VERSION,
    });
  });

  it('counts only the requests sent after the lock was taken', async () => {
    const requests = createRequestCounter();
    const http = countedHttp(requests);
    await http.send({ method: 'GET', url: FETCH_URL, headers: {} });
    const { fs, ports } = harness([A], {}, { requests });

    await run(ports, async () => {
      await http.send({ method: 'POST', url: SEARCH_URL, headers: {} });
      return { kind: 'completed' };
    });

    const report = await reportOf(fs);
    expect(report?.figures.requestsBySource).toEqual({ ...ZERO, 'tracked-list': 1 });
  });

  it('writes after progress, in the schema’s key order, LF and one trailing newline', async () => {
    const { fs, ports } = harness([A]);
    const writes: string[] = [];
    const recording = {
      ...fs,
      writeTextFile: (path: string, contents: string) => {
        writes.push(path);
        return fs.writeTextFile(path, contents);
      },
    };

    await run({ ...ports, fs: recording }, scriptedStep().step);

    expect(writes).toEqual([DATASET_PATH, PROGRESS_PATH, REPORT_PATH]);
    const text = (await fs.readTextFile(REPORT_PATH)) ?? '';
    expect(text.endsWith('}\n')).toBe(true);
    expect(text).not.toContain('\r');
    expect(Object.keys(JSON.parse(text) as object)).toEqual([
      'runStartedAt',
      'runFinishedAt',
      'figures',
      'records',
      'schemaVersion',
    ]);
  });

  it('carry-over: a previous stale-lock-broken record survives the next chunk; figures are replaced', async () => {
    const { fs, ports } = harness([A], { [REPORT_PATH]: { contents: reportText([BROKEN]) } });

    await run(ports, scriptedStep().step);

    const report = await reportOf(fs);
    expect(report?.records).toEqual([BROKEN]);
    expect(report?.figures).toEqual({ requestsBySource: ZERO, notReachedCount: 0 });
  });

  it('player cleared: a previous report with no records keeps only this chunk’s new records', async () => {
    const { fs, ports } = harness([A], {
      [REPORT_PATH]: { contents: reportText([]) },
      [LOCK_PATH]: { contents: serialiseLock({ pid: 7, startedAt: SEVEN_HOURS_AGO }) },
    });

    await run(ports, scriptedStep().step);

    const finalReport = await reportOf(fs);
    expect(finalReport?.records).toEqual([BROKEN]);
  });

  it('dedup: the same starvation payload two chunks running is one record', async () => {
    const { fs, ports } = harness([P1, P2, P3, A, B], {}, {
      starvationRecord: (starvation) => ({
        kind: 'pinned-starvation',
        discoveredAllowance: starvation.discoveredAllowance,
        declaredMinChunkSearches: 10,
        pinnedCount: starvation.pinnedCount,
        pinnedRefreshed: starvation.pinnedRefreshed,
        activeRefreshed: starvation.activeRefreshed,
      }),
    });

    await run(ports, starvingStep());
    const finalReport = await reportOf(fs);
    expect(finalReport?.records).toEqual([STARVED]);
    await run(ports, starvingStep());
    const report = await reportOf(fs);
    expect(report?.records).toEqual([STARVED]);
  });

  it('not reached: 5 eligible, bounded after 2, reports 3', async () => {
    const { fs, ports } = harness([A, B, C, D, E]);
    let remaining = 2;
    const outcome = await run(
      ports,
      scriptedStep(() => {
        remaining -= 1;
        return { kind: 'completed', searchRemaining: remaining };
      }).step,
    );
    expect(outcome).toMatchObject({ kind: 'bounded', completed: [key(A), key(B)] });
    const report = await reportOf(fs);
    expect(report?.figures.notReachedCount).toBe(3);
  });

  it('not reached: a yielded entry was attempted, so it is not counted', async () => {
    const { fs, ports } = harness([A, B, C]);
    await run(
      ports,
      scriptedStep((entry) => (({ kind: key(entry) === key(B) ? 'yielded' : 'completed' }))).step,
    );
    const report = await reportOf(fs);
    expect(report?.figures.notReachedCount).toBe(1);
  });

  it('not reached: a pinned entry cut by the cap counts', async () => {
    const { fs, ports } = harness([P1, P2, P3, A, B]);
    await run(ports, starvingStep());
    // Five in rows 1–3, four attempted: P3 was cut.
    const report = await reportOf(fs);
    expect(report?.figures.notReachedCount).toBe(1);
  });

  it('excluded: a pruned entry and an entry the catalogue check marked never count', async () => {
    const U = raw('U');
    const { fs, ports } = harness([A, B, PRUNED, U], {}, {
      catalogue: () => Promise.resolve({ ok: true, value: catalogueWithout('U') }),
    });
    const { visited, step } = scriptedStep(() => ({ kind: 'completed', searchRemaining: 0 }));

    await run(ports, step);

    expect(visited).toHaveLength(1);
    // A and B are eligible, one attempted.
    const report = await reportOf(fs);
    expect(report?.figures.notReachedCount).toBe(1);
  });

  it.each([
    ['committed', { [TRACKED_PATH]: SEVEN_HOURS_AGO }, FIVE_HOURS_AGO, { source: 'git-author-date', at: SEVEN_HOURS_AGO }],
    ['uncommitted-only', {}, FIVE_HOURS_AGO, { source: 'file-modified', at: FIVE_HOURS_AGO }],
    ['neither', {}, undefined, undefined],
  ] as const)('edit date: %s', async (_name, commits, modifiedAt, expected) => {
    const { fs, ports } = harness([A], {}, { git: createFakeGitPort(commits) });
    fs.setFile(TRACKED_PATH, {
      contents: trackedText([A]),
      ...(modifiedAt !== undefined && { modifiedAt }),
    });

    await run(ports, scriptedStep().step);

    const report = await reportOf(fs);
    const figures = report?.figures;
    expect(figures?.trackedListEditedAt).toEqual(expected);
    expect(figures !== undefined && 'trackedListEditedAt' in figures).toBe(expected !== undefined);
  });

  it('4xx abort: entries 1–2 published, entry 3 stamped, a trade-request-rejected record, no finish, lock released, rethrown', async () => {
    const { fs, ports } = harness([A, B, C, D, E]);
    const stamped: DatasetEntry = {
      entryKey: key(C),
      price: { state: 'not-yet-synced', reason: 'never-synced' },
      lastAttemptedAt: NOW,
    };
    const failure = new MalformedRequestError(key(C), 'search', 400, stamped);

    await expect(
      run(ports, (entry) =>
        key(entry) === key(C)
          ? Promise.reject(failure)
          : Promise.resolve({ kind: 'completed', entry: noListingsEntry(entry) }),
      ),
    ).rejects.toBe(failure);

    const dataset = DatasetFileSchema.parse(JSON.parse((await fs.readTextFile(DATASET_PATH)) ?? ''));
    const byKey = new Map(dataset.entries.map((entry) => [entry.entryKey, entry]));
    expect(byKey.get(key(A))).toEqual(noListingsEntry(A));
    expect(byKey.get(key(B))).toEqual(noListingsEntry(B));
    expect(byKey.get(key(C))).toEqual(stamped);
    expect(byKey.get(key(D))).toEqual({
      entryKey: key(D),
      price: { state: 'not-yet-synced', reason: 'never-synced' },
    });
    // A malformed-request abort remembers the full staleLockAfter (§5.3).
    expect(await progressOf(fs)).toEqual({
      schemaVersion: SYNC_PROGRESS_SCHEMA_VERSION,
      completed: [key(A), key(B)],
      notBefore: '2026-09-26T18:00:00.000Z',
    });

    const report = await reportOf(fs);
    expect(report).toEqual({
      runStartedAt: NOW,
      figures: { requestsBySource: ZERO, notReachedCount: 2 },
      records: [
        {
          kind: 'run-failure',
          reason: 'trade-request-rejected',
          entryKey: key(C),
          status: 400,
          message: failure.message,
        },
      ],
      schemaVersion: SYNC_REPORT_SCHEMA_VERSION,
    });
    expect(report !== undefined && 'runFinishedAt' in report).toBe(false);
    expect(await fs.exists(LOCK_PATH)).toBe(false);
  });

  it('unparseable fetch body: entries 1–2 published, entry 3 keeps the answered search fields, an unrecoverable-error record, no notBefore, lock released, rethrown', async () => {
    const { fs, ports } = harness([A, B, C, D, E]);
    const searched: DatasetEntry = {
      entryKey: key(C),
      price: { state: 'no-listings' },
      lastAttemptedAt: NOW,
      lastSearchId: 'Ab3dE',
      lastSearchLeague: 'Standard',
    };
    const failure = new UnexpectedTradeResponseError(key(C), 'fetch', 'no top-level `result` array', searched);

    await expect(
      run(ports, (entry) =>
        key(entry) === key(C)
          ? Promise.reject(failure)
          : Promise.resolve({ kind: 'completed', entry: noListingsEntry(entry) }),
      ),
    ).rejects.toBe(failure);

    const dataset = DatasetFileSchema.parse(JSON.parse((await fs.readTextFile(DATASET_PATH)) ?? ''));
    const byKey = new Map(dataset.entries.map((entry) => [entry.entryKey, entry]));
    expect(byKey.get(key(A))).toEqual(noListingsEntry(A));
    expect(byKey.get(key(B))).toEqual(noListingsEntry(B));
    expect(byKey.get(key(C))).toEqual(searched);
    expect(byKey.get(key(D))).toEqual({
      entryKey: key(D),
      price: { state: 'not-yet-synced', reason: 'never-synced' },
    });
    // Only a MalformedRequestError writes the abort notBefore.
    expect(await progressOf(fs)).toEqual({ schemaVersion: SYNC_PROGRESS_SCHEMA_VERSION, completed: [key(A), key(B)] });

    const report = await reportOf(fs);
    expect(report?.records).toEqual([
      { kind: 'run-failure', reason: 'unrecoverable-error', entryKey: key(C), message: failure.message },
    ]);
    expect(report !== undefined && 'runFinishedAt' in report).toBe(false);
    expect(await fs.exists(LOCK_PATH)).toBe(false);
  });

  it('unparseable search body: entries 1–2 published, entry 3 stamped with lastAttemptedAt, an unrecoverable-error record, no notBefore, lock released, rethrown', async () => {
    const { fs, ports } = harness([A, B, C, D, E]);
    const stamped: DatasetEntry = {
      entryKey: key(C),
      price: { state: 'no-listings' },
      lastAttemptedAt: NOW,
      lastSearchId: 'Zz9yX',
      lastSearchLeague: 'Standard',
    };
    const failure = new UnexpectedTradeResponseError(key(C), 'search', 'no top-level `id` and `result`', stamped);

    await expect(
      run(ports, (entry) =>
        key(entry) === key(C)
          ? Promise.reject(failure)
          : Promise.resolve({ kind: 'completed', entry: noListingsEntry(entry) }),
      ),
    ).rejects.toBe(failure);

    const dataset = DatasetFileSchema.parse(JSON.parse((await fs.readTextFile(DATASET_PATH)) ?? ''));
    const byKey = new Map(dataset.entries.map((entry) => [entry.entryKey, entry]));
    expect(byKey.get(key(A))).toEqual(noListingsEntry(A));
    expect(byKey.get(key(B))).toEqual(noListingsEntry(B));
    expect(byKey.get(key(C))).toEqual(stamped);
    // Only a rejected request writes the abort notBefore.
    expect(await progressOf(fs)).toEqual({ schemaVersion: SYNC_PROGRESS_SCHEMA_VERSION, completed: [key(A), key(B)] });

    const report = await reportOf(fs);
    expect(report?.records).toEqual([
      { kind: 'run-failure', reason: 'unrecoverable-error', entryKey: key(C), message: failure.message },
    ]);
    expect(report !== undefined && 'runFinishedAt' in report).toBe(false);
    expect(await fs.exists(LOCK_PATH)).toBe(false);
  });

  it.each([
    ['progress', PROGRESS_PATH],
    ['report', REPORT_PATH],
  ] as const)('4xx abort whose %s write fails: still rejects with the original error, the fault logged', async (_name, failing) => {
    const { fs, ports, logs } = harness([A, B]);
    const stamped: DatasetEntry = {
      entryKey: key(B),
      price: { state: 'not-yet-synced', reason: 'never-synced' },
      lastAttemptedAt: NOW,
    };
    const failure = new MalformedRequestError(key(B), 'search', 400, stamped);
    const faulty = {
      ...fs,
      writeTextFile: (path: string, contents: string) =>
        path === failing ? Promise.reject(new Error(`disk full: ${path}`)) : fs.writeTextFile(path, contents),
    };

    await expect(
      run({ ...ports, fs: faulty }, (entry) =>
        key(entry) === key(B) ? Promise.reject(failure) : Promise.resolve({ kind: 'completed' }),
      ),
    ).rejects.toBe(failure);

    expect(logs.some((line) => line.includes(`disk full: ${failing}`))).toBe(true);
    // A failed publication does not stop the report.
    if (failing === PROGRESS_PATH) {
      const finalReport = await reportOf(fs);
      expect(finalReport?.records).toEqual([
        { kind: 'run-failure', reason: 'trade-request-rejected', entryKey: key(B), status: 400, message: failure.message },
      ]);
    }
    expect(await fs.exists(LOCK_PATH)).toBe(false);
  });

  it('a fault resolving the edit date after publish still writes the failure report', async () => {
    const { fs, ports } = harness([A]);
    let calls = 0;
    const flaky = {
      ...ports.git,
      lastCommitAuthorDate: () => {
        calls += 1;
        return calls === 1 ? Promise.reject(new Error('git broke')) : Promise.resolve(undefined);
      },
    };

    await expect(run({ ...ports, git: flaky }, scriptedStep().step)).rejects.toThrow('git broke');

    const finalReport = await reportOf(fs);
    expect(finalReport?.records).toEqual([
      { kind: 'run-failure', reason: 'unrecoverable-error', message: 'git broke' },
    ]);
  });

  it('other throw: an unrecoverable-error record naming the entry, after the dataset and progress so far', async () => {
    const { fs, ports } = harness([A, B, C]);
    const failure = new Error('step exploded');

    await expect(
      run(ports, (entry) =>
        key(entry) === key(B) ? Promise.reject(failure) : Promise.resolve({ kind: 'completed' }),
      ),
    ).rejects.toBe(failure);

    expect(await fs.exists(DATASET_PATH)).toBe(true);
    expect(await progressOf(fs)).toEqual({ schemaVersion: SYNC_PROGRESS_SCHEMA_VERSION, completed: [key(A)] });
    const report = await reportOf(fs);
    expect(report?.records).toEqual([
      { kind: 'run-failure', reason: 'unrecoverable-error', entryKey: key(B), message: 'step exploded' },
    ]);
    expect(report !== undefined && 'runFinishedAt' in report).toBe(false);
    expect(await fs.exists(LOCK_PATH)).toBe(false);
  });

  it('a gate throw writes the report with an unrecoverable-error record and no entry key', async () => {
    const failure = new Error('gate refused');
    const { fs, ports } = harness([A], {}, { gate: () => Promise.reject(failure) });

    await expect(run(ports, scriptedStep().step)).rejects.toBe(failure);

    const finalReport = await reportOf(fs);
    expect(finalReport?.records).toEqual([
      { kind: 'run-failure', reason: 'unrecoverable-error', message: 'gate refused' },
    ]);
    // The gate runs after the order, so the throw publishes the marks (none here).
    expect(await fs.exists(DATASET_PATH)).toBe(true);
    expect(await progressOf(fs)).toEqual({ schemaVersion: SYNC_PROGRESS_SCHEMA_VERSION, completed: [] });
  });

  it('a failure record follows the records carried from the previous report', async () => {
    const { fs, ports } = harness([A], { [REPORT_PATH]: { contents: reportText([BROKEN]) } });

    await expect(run(ports, () => Promise.reject(new Error('boom')))).rejects.toThrow('boom');

    const finalReport = await reportOf(fs);
    expect(finalReport?.records).toEqual([
      BROKEN,
      { kind: 'run-failure', reason: 'unrecoverable-error', entryKey: key(A), message: 'boom' },
    ]);
  });

  it('a failure before the weights read keeps the previous coverage pair', async () => {
    const withPair = JSON.stringify({
      schemaVersion: '1.1.0',
      runStartedAt: SEVEN_HOURS_AGO,
      figures: {
        requestsBySource: { 'tracked-list': 0, 'league-validation': 0, 'session-probe': 0 },
        notReachedCount: 0,
        coverage: 0.75,
        rankableClassCount: 4,
      },
      records: [],
    });
    const fs = createFakeFilesystemPort({
      [TRACKED_PATH]: { contents: '{not json' },
      [REPORT_PATH]: { contents: withPair },
    });
    await expect(
      run({ fs, clock: createFakeClockPort(NOW), pid: PID, ...shellPorts(), publication: PUBLICATION }, scriptedStep().step),
    ).rejects.toThrow(/tracked\.json/);

    const report = await reportOf(fs);
    const figures = report?.figures;
    expect(figures?.coverage).toBe(0.75);
    expect(figures?.rankableClassCount).toBe(4);
  });

  it('a failure before the weights read leaves the pair absent when the previous report has none', async () => {
    const fs = createFakeFilesystemPort({ [TRACKED_PATH]: { contents: '{not json' } });
    await expect(
      run({ fs, clock: createFakeClockPort(NOW), pid: PID, ...shellPorts(), publication: PUBLICATION }, scriptedStep().step),
    ).rejects.toThrow(/tracked\.json/);

    const finalReport = await reportOf(fs);
    const figures = finalReport?.figures;
    expect(figures?.coverage).toBeUndefined();
    expect(figures?.rankableClassCount).toBeUndefined();
  });

  it('busy: no report write', async () => {
    const { fs, ports } = harness([A], {
      [LOCK_PATH]: { contents: serialiseLock({ pid: 99, startedAt: FIVE_HOURS_AGO }) },
    });
    const outcome = await run(ports, scriptedStep().step);
    expect(outcome.kind).toBe('busy');
    expect(await fs.exists(REPORT_PATH)).toBe(false);
  });

  it('dispossessed: no report write, on a normal finish or on a throw', async () => {
    for (const throws of [false, true]) {
      const { fs, ports } = harness([A, B]);
      const successor = serialiseLock({ pid: 99, startedAt: NOW });
      const running = run(ports, (entry) => {
        fs.setFile(LOCK_PATH, { contents: successor });
        return throws && key(entry) === key(B)
          ? Promise.reject(new Error('late'))
          : Promise.resolve({ kind: 'completed' });
      });
      if (throws) {
        await expect(running).rejects.toThrow('late');
      } else {
        const outcome = await running;
        expect(outcome.kind).toBe('dispossessed');
      }
      expect(await fs.exists(REPORT_PATH)).toBe(false);
      expect(await fs.exists(DATASET_PATH)).toBe(false);
      expect(await fs.readTextFile(LOCK_PATH)).toBe(successor);
    }
  });

  it('invalid previous: an unknown major refuses loudly and writes nothing', async () => {
    const previous = reportText([], '9.0.0');
    const { fs, ports } = harness([A], { [REPORT_PATH]: { contents: previous } });
    const { visited, step } = scriptedStep();

    await expect(run(ports, step)).rejects.toThrow(/sync-report\.json.*9\.0\.0/);

    expect(visited).toEqual([]);
    expect(await fs.readTextFile(REPORT_PATH)).toBe(previous);
    expect(await fs.exists(DATASET_PATH)).toBe(false);
    expect(await fs.exists(PROGRESS_PATH)).toBe(false);
    expect(await fs.exists(LOCK_PATH)).toBe(false);
  });
});

const weightsPoolOf = (...entries: unknown[]): unknown => ({ poolCoverage: 'complete', entries });

const weightsEntryOf = (id: string, ...lines: unknown[]): unknown => ({
  sourceModifierId: id,
  modGroup: id,
  itemLevelMin: 1,
  weight: 1,
  weightSource: 'published',
  lines,
});

const weightsLineOf = (statId: string | null): unknown => ({ statId, ranges: [] });

const coveredWeights = (suffixCoverage: 'complete' | 'partial'): string =>
  JSON.stringify({
    schemaVersion: WEIGHTS_SCHEMA_VERSION, gamePatch: '0.5.5', producer: { id: 'test', generatedAt: '2026-09-26T00:00:00Z' },
    bases: {
      'weapon.bow': {
        Bows: {
          prefix: { poolCoverage: 'complete', entries: [coverageTier('p1', 'explicit.ok')] },
          // `explicit.stat_suffix` is the suffix every `craftedEntry` carries.
          suffix: { poolCoverage: suffixCoverage, entries: [coverageTier('s1', 'explicit.stat_suffix')] },
        },
      },
    },
  });

const coverageTier = (id: string, statId: string): unknown => ({
  sourceModifierId: id, modGroup: id, itemLevelMin: 1, weight: 1,
  weightSource: 'published',
  lines: [{ statId, ranges: [] }],
});

async function publishedOf(fs: FakeFilesystemPort, entry: TrackedEntry): Promise<DatasetEntry | undefined> {
  const text = await fs.readTextFile(DATASET_PATH);
  const file = text === undefined ? undefined : DatasetFileSchema.parse(JSON.parse(text));
  return file?.entries.find((published) => published.entryKey === key(entry));
}

const withCatalogue = (...missing: string[]): Partial<TestPorts> => ({
  catalogue: () => Promise.resolve({ ok: true, value: catalogueWithout(...missing) }),
});

function craftedEntry(
  categoryId: string,
  prefix: string,
  className = 'Bows',
  status: TrackedEntry['status'] = 'active',
): TrackedEntry {
  const base = {
    kind: 'crafted',
    categoryId,
    className,
    itemLevelMin: 75,
    prefix: { kind: 'valueless', statId: prefix },
    suffix: { kind: 'valueless', statId: 'explicit.stat_suffix' },
  } as const;
  return status === 'pruned' ? { ...base, status, prunedReason: 'no market' } : { ...base, status };
}

describe('runChunk: unresolvable ids, detected offline (Story 1.10)', () => {
  const STAT_GONE = 'explicit.gone';


  it('unknown stat: marked unresolvable and recorded, never searched, and the others are priced', async () => {
    const X = craftedEntry('weapon.bow', STAT_GONE);
    const { fs, ports } = harness([A, X, B], {}, withCatalogue(STAT_GONE));
    const { visited, step } = scriptedStep((entry) => ({ kind: 'completed', entry: noListingsEntry(entry) }));

    const outcome = await run(ports, step);

    expect(outcome.kind).toBe('completed');
    expect(visited).toEqual([key(A), key(B)]);
    expect(await publishedOf(fs, X)).toEqual({ entryKey: key(X), price: { state: 'unresolvable' } });
    expect(await publishedOf(fs, A)).toEqual(noListingsEntry(A));
    const report = await reportOf(fs);
    expect(report?.records).toEqual([
      { kind: 'unresolvable', entryKey: key(X), identifier: STAT_GONE, identifierKind: 'statId' },
    ]);
  });

  it('unknown base type and unknown category: the same, with their own identifier kinds', async () => {
    const RAW_GONE = raw('Gone Base');
    const CAT_GONE = craftedEntry('weapon.gone', 'explicit.ok');
    const { fs, ports } = harness([RAW_GONE, CAT_GONE, A], {}, withCatalogue('Gone Base', 'weapon.gone'));
    const { visited, step } = scriptedStep();

    await run(ports, step);

    expect(visited).toEqual([key(A)]);
    const report = await reportOf(fs);
    expect(report?.records).toEqual([
      { kind: 'unresolvable', entryKey: key(RAW_GONE), identifier: 'Gone Base', identifierKind: 'baseTypeId' },
      { kind: 'unresolvable', entryKey: key(CAT_GONE), identifier: 'weapon.gone', identifierKind: 'categoryId' },
    ]);
    const publishedEntry = await publishedOf(fs, RAW_GONE);
    expect(publishedEntry?.price).toEqual({ state: 'unresolvable' });
    const published = await publishedOf(fs, CAT_GONE);
    expect(published?.price).toEqual({ state: 'unresolvable' });
  });

  it('was priced: the mark keeps the old lastAttemptedAt and search fields, drops the observation, stamps nothing', async () => {
    const X = raw('X');
    const priced: DatasetEntry = {
      entryKey: key(X),
      price: {
        state: 'priced',
        observation: {
          league: 'Standard',
          observedAt: FIVE_HOURS_AGO,
          priceDivine: 2,
          sampleSize: 4,
          exchangeObservation: {
            currencyId: 'divine',
            rate: 1,
            source: 'measured',
            league: 'Standard',
            asOf: '2026-09-20T00:00:00Z',
          },
        },
      },
      lastAttemptedAt: FIVE_HOURS_AGO,
      lastSearchId: 'S9',
      lastSearchLeague: 'Standard',
    };
    const dataset = JSON.stringify({
      schemaVersion: SUPPORTED_SCHEMA_VERSION,
      league: 'Standard',
      generatedAt: FIVE_HOURS_AGO,
      entries: [priced],
      currencyRates: [],
    });
    const { fs, ports } = harness([X], { [DATASET_PATH]: { contents: dataset } }, withCatalogue('X'));

    await run(ports, scriptedStep().step);

    expect(await publishedOf(fs, X)).toEqual({
      entryKey: key(X),
      price: { state: 'unresolvable' },
      lastAttemptedAt: FIVE_HOURS_AGO,
      lastSearchId: 'S9',
      lastSearchLeague: 'Standard',
    });
  });

  it('not reached: 3 tracked, 1 a miss, bounded after 1, counts 1', async () => {
    const X = raw('X');
    const { fs, ports } = harness([A, X, B], {}, withCatalogue('X'));
    const { visited, step } = scriptedStep(() => ({ kind: 'completed', searchRemaining: 0 }));

    const outcome = await run(ports, step);

    expect(outcome).toMatchObject({ kind: 'bounded', bound: 'search' });
    expect(visited).toHaveLength(1);
    const report = await reportOf(fs);
    expect(report?.figures.notReachedCount).toBe(1);
  });

  it('pruned: a pruned entry with a missing id is not checked, marked or recorded', async () => {
    const PX = craftedEntry('weapon.gone', STAT_GONE, 'Bows', 'pruned');
    const { fs, ports } = harness([A, PX], {}, withCatalogue('weapon.gone', STAT_GONE));

    await run(ports, scriptedStep().step);

    expect(await publishedOf(fs, PX)).toEqual({
      entryKey: key(PX),
      price: { state: 'not-yet-synced', reason: 'never-synced' },
    });
    const report = await reportOf(fs);
    expect(report?.records).toEqual([]);
  });

  it('recovery: an unresolvable entry whose ids resolve sits in row 2, not row 3', async () => {
    const U = raw('U');
    // U was attempted five hours ago: inside row 3's 24 h interval, so only
    // row 2 can place it this chunk. A is older, so row 2 visits it first.
    const { ports } = harness([A, U], {
      [DATASET_PATH]: {
        contents: datasetText([
          { key: key(A), at: SEVEN_HOURS_AGO },
          { key: key(U), at: FIVE_HOURS_AGO, unresolvable: true },
        ]),
      },
    });
    const { visited, step } = scriptedStep();

    await run(ports, step);

    expect(visited).toEqual([key(A), key(U)]);
  });

  it('recovery: a recovered entry the chunk does not reach stays unresolvable in the dataset', async () => {
    const U = raw('U');
    const { fs, ports } = harness([A, U], {
      [DATASET_PATH]: {
        contents: datasetText([
          { key: key(A), at: SEVEN_HOURS_AGO },
          { key: key(U), at: FIVE_HOURS_AGO, unresolvable: true },
        ]),
      },
    });
    const { visited, step } = scriptedStep(() => ({ kind: 'completed', searchRemaining: 0 }));

    await run(ports, step);

    expect(visited).toEqual([key(A)]);
    expect(await publishedOf(fs, U)).toEqual({
      entryKey: key(U),
      price: { state: 'unresolvable' },
      lastAttemptedAt: FIVE_HOURS_AGO,
    });
    const report = await reportOf(fs);
    expect(report?.records).toEqual([]);
  });

  it('jewel miss: the step’s mark and record are published, and the chunk continues', async () => {
    const J = craftedEntry('jewel', 'explicit.ok', 'Emerld');
    const mark: DatasetEntry = { entryKey: key(J), price: { state: 'unresolvable' } };
    const record: SyncRunRecord = {
      kind: 'unresolvable',
      entryKey: key(J),
      identifier: 'Emerld',
      identifierKind: 'baseTypeId',
    };
    const { fs, ports } = harness([J, A]);
    const { visited, step } = scriptedStep((entry) =>
      key(entry) === key(J) ? { kind: 'completed', entry: mark, records: [record] } : { kind: 'completed' },
    );

    const outcome = await run(ports, step);

    expect(outcome.kind).toBe('completed');
    expect(visited).toHaveLength(2);
    expect(await publishedOf(fs, J)).toEqual(mark);
    const report = await reportOf(fs);
    expect(report?.records).toEqual([record]);
  });

  it('empty search: zero results stay no-listings, never unresolvable', async () => {
    const { fs, ports } = harness([A]);

    await run(ports, scriptedStep((entry) => ({ kind: 'completed', entry: noListingsEntry(entry) })).step);

    const published = await publishedOf(fs, A);
    expect(published?.price).toEqual({ state: 'no-listings' });
    const report = await reportOf(fs);
    expect(report?.records).toEqual([]);
  });

  it('weights absent: a weights-absent record naming the uncheckable classes, the run otherwise unchanged', async () => {
    const X = craftedEntry('weapon.bow', 'explicit.ok', 'Bows');
    const Y = craftedEntry('armour.chest', 'explicit.ok', 'Body_Armours_str');
    const Z = craftedEntry('armour.chest', 'explicit.ok', 'Pruned_Class', 'pruned');
    const present = harness([A, X, Y, Z]);
    const absent = harness([A, X, Y, Z]);
    await absent.fs.deleteFile(WEIGHTS_PATH);
    const presentRun = scriptedStep();
    const absentRun = scriptedStep();

    await run(present.ports, presentRun.step);
    await run(absent.ports, absentRun.step);

    expect(absentRun.visited).toEqual(presentRun.visited);
    expect(await absent.fs.readTextFile(DATASET_PATH)).toBe(await present.fs.readTextFile(DATASET_PATH));
    const finalReport = await reportOf(absent.fs);
    expect(finalReport?.records).toEqual([
      { kind: 'weights-absent', uncheckableClassNames: ['Body_Armours_str', 'Bows'] },
    ]);
    // Weights present: no weights-absent record.
    const report = await reportOf(present.fs);
    expect(report?.records).toEqual([]);
  });

  describe('pool coverage (AD-27)', () => {
    /**
     * Bows with a covered class, or with a `partial` suffix slot, which leaves
     * it uncovered (IN §3). A weight-0 suffix would also leave it uncovered,
     * but every crafted entry now names a suffix, and a weight-0 pool contains
     * none, so the cross-file gate would refuse the run; a partial slot gets no
     * pool check.
     */
    const X = craftedEntry('weapon.bow', 'explicit.ok', 'Bows');
    const Y = craftedEntry('armour.chest', 'explicit.ok', 'Body_Armours_str');

    it('a present file writes both fields, and a replaced file gives the new figure on the next chunk', async () => {
      const { fs, ports } = harness([X, Y], { [WEIGHTS_PATH]: { contents: coveredWeights('complete') } });

      await run(ports, scriptedStep().step);
      const first = await reportOf(fs);
      expect(first?.figures.coverage).toBe(0.5);
      expect(first?.figures.rankableClassCount).toBe(2);

      await fs.writeTextFile(WEIGHTS_PATH, coveredWeights('partial'));
      await run(ports, scriptedStep().step);
      const second = await reportOf(fs);
      expect(second?.figures.coverage).toBe(0);
      expect(second?.figures.rankableClassCount).toBe(2);
    });

    it('an absent file omits both fields', async () => {
      const { fs, ports } = harness([X]);
      await fs.deleteFile(WEIGHTS_PATH);

      await run(ports, scriptedStep().step);

      const report = await reportOf(fs);
      const figures = report?.figures;
      expect(figures !== undefined && 'coverage' in figures).toBe(false);
      expect(figures !== undefined && 'rankableClassCount' in figures).toBe(false);
    });

    it('a present file with no rankable class omits both fields', async () => {
      const { fs, ports } = harness([A], { [WEIGHTS_PATH]: { contents: coveredWeights('complete') } });

      await run(ports, scriptedStep().step);

      const report = await reportOf(fs);
      const figures = report?.figures;
      expect(figures !== undefined && 'coverage' in figures).toBe(false);
      expect(figures !== undefined && 'rankableClassCount' in figures).toBe(false);
    });
  });

  it('weights miss: one record per distinct uncatalogued id, nulls skipped, and the run continues', async () => {
    const weights = JSON.stringify({
      schemaVersion: WEIGHTS_SCHEMA_VERSION, gamePatch: '0.5.5', producer: { id: 'test', generatedAt: '2026-09-26T00:00:00Z' },
      bases: {
        'weapon.bow': {
          Bows: {
            prefix: weightsPoolOf(weightsEntryOf('p1', weightsLineOf('explicit.w1'), weightsLineOf(null))),
            suffix: weightsPoolOf(weightsEntryOf('s1', weightsLineOf('explicit.w1')), weightsEntryOf('s2', weightsLineOf('explicit.ok'))),
          },
        },
        'weapon.gone': { Gone: { prefix: weightsPoolOf(), suffix: weightsPoolOf() } },
      },
    });
    const { fs, ports } = harness(
      [A],
      { [WEIGHTS_PATH]: { contents: weights } },
      withCatalogue('explicit.w1', 'weapon.gone'),
    );
    const { visited, step } = scriptedStep();

    const outcome = await run(ports, step);

    expect(outcome.kind).toBe('completed');
    expect(visited).toEqual([key(A)]);
    const report = await reportOf(fs);
    expect(report?.records).toEqual([
      { kind: 'uncatalogued-weights-id', identifier: 'weapon.gone', identifierKind: 'categoryId' },
      { kind: 'uncatalogued-weights-id', identifier: 'explicit.w1', identifierKind: 'statId' },
    ]);
    // The file is never rewritten.
    expect(await fs.readTextFile(WEIGHTS_PATH)).toBe(weights);
  });

  it('weights bad major: a run-failure record, the error rethrown, nothing searched, nothing published', async () => {
    // X is uncatalogued: a refusal before the order exists writes the report
    // only, so neither its mark nor its `unresolvable` record appears.
    const { fs, ports } = harness(
      [A, raw('X')],
      { [WEIGHTS_PATH]: { contents: JSON.stringify({ schemaVersion: '5.1.0', bases: {} }) } },
      { catalogue: () => Promise.resolve({ ok: true, value: catalogueWithout('X') }) },
    );
    const { visited, step } = scriptedStep();

    await expect(run(ports, step)).rejects.toThrow(/weights\.json.*5\.1\.0/);

    expect(visited).toEqual([]);
    expect(await fs.exists(DATASET_PATH)).toBe(false);
    expect(await fs.exists(PROGRESS_PATH)).toBe(false);
    const report = await reportOf(fs);
    expect(report?.runFinishedAt).toBeUndefined();
    expect(report?.records).toEqual([
      expect.objectContaining({ kind: 'run-failure', reason: 'unrecoverable-error' }),
    ]);
    expect(await fs.exists(LOCK_PATH)).toBe(false);
  });

  it('weights hard error: a DataFileError naming the file and the rule, nothing searched, nothing published', async () => {
    const weights = JSON.stringify({
      schemaVersion: WEIGHTS_SCHEMA_VERSION, gamePatch: '0.5.5', producer: { id: 'test', generatedAt: '2026-09-26T00:00:00Z' },
      bases: { 'weapon.bow': { Bows: { prefix: { entries: [] }, suffix: { poolCoverage: 'complete', entries: [] } } } },
    });
    const { fs, ports } = harness([A], { [WEIGHTS_PATH]: { contents: weights } });
    const { visited, step } = scriptedStep();

    const failure = run(ports, step);
    await expect(failure).rejects.toBeInstanceOf(DataFileError);
    await expect(failure).rejects.toMatchObject({ path: WEIGHTS_PATH, reason: 'invalid' });
    await expect(failure).rejects.toThrow(/data\/weights\.json: invalid: bases\.weapon\.bow\.Bows\.prefix\.poolCoverage: /);

    expect(visited).toEqual([]);
    expect(Object.values(ports.requests.snapshot()).every((count) => count === 0)).toBe(true);
    expect(await fs.exists(DATASET_PATH)).toBe(false);
    expect(await fs.exists(PROGRESS_PATH)).toBe(false);
  });

  it('a catalogue that cannot be loaded aborts before any request, with a run-failure record', async () => {
    const { fs, ports } = harness([A], {}, {
      catalogue: () =>
        Promise.resolve({
          ok: false,
          error: new DataFileError('data/catalogue/stats.json', 'absent', 'the file is absent'),
        }),
    });
    const { visited, step } = scriptedStep();

    await expect(run(ports, step)).rejects.toThrow(/stats\.json/);

    expect(visited).toEqual([]);
    const report = await reportOf(fs);
    expect(report?.records).toEqual([
      expect.objectContaining({ kind: 'run-failure', message: expect.stringContaining('stats.json') as unknown }),
    ]);
  });

  it('busy lock: no catalogue work', async () => {
    let loads = 0;
    const held = serialiseLock({ pid: 7, startedAt: FIVE_HOURS_AGO });
    const { ports } = harness(undefined, { [LOCK_PATH]: { contents: held } }, {
      catalogue: () => {
        loads += 1;
        return Promise.resolve({ ok: true, value: catalogueWithout() });
      },
    });

    const outcome = await run(ports, scriptedStep().step);
    expect(outcome.kind).toBe('busy');
    expect(loads).toBe(0);
  });

  it('jewel: a published-unresolvable jewel entry whose ids resolve is not recovered, and waits in row 3', async () => {
    const J = craftedEntry('jewel', 'explicit.ok', 'Emerld');
    const { ports } = harness([J, A], {
      [DATASET_PATH]: { contents: datasetText([{ key: key(J), at: FIVE_HOURS_AGO, unresolvable: true }]) },
    });
    const { visited, step } = scriptedStep();

    await run(ports, step);

    // Inside row 3's 24 h interval, so not visited.
    expect(visited).toEqual([key(A)]);
  });

  it('4xx abort after an offline miss: the mark is published and its record precedes the run-failure', async () => {
    const X = raw('X');
    const { fs, ports } = harness([X, B], {}, withCatalogue('X'));
    const stamped: DatasetEntry = {
      entryKey: key(B),
      price: { state: 'not-yet-synced', reason: 'never-synced' },
      lastAttemptedAt: NOW,
    };
    const failure = new MalformedRequestError(key(B), 'search', 400, stamped);

    await expect(
      run(ports, (entry) =>
        key(entry) === key(B) ? Promise.reject(failure) : Promise.resolve({ kind: 'completed' }),
      ),
    ).rejects.toBe(failure);

    expect(await publishedOf(fs, X)).toEqual({ entryKey: key(X), price: { state: 'unresolvable' } });
    const report = await reportOf(fs);
    expect(report?.records).toEqual([
      { kind: 'unresolvable', entryKey: key(X), identifier: 'X', identifierKind: 'baseTypeId' },
      expect.objectContaining({ kind: 'run-failure', reason: 'trade-request-rejected', entryKey: key(B) }),
    ]);
  });

  it('repeat: the same miss two chunks running is one record', async () => {
    const X = raw('X');
    const { fs, ports } = harness([A, X], {}, withCatalogue('X'));

    await run(ports, scriptedStep().step);
    await run(ports, scriptedStep().step);

    const report = await reportOf(fs);
    expect(report?.records).toEqual([
      { kind: 'unresolvable', entryKey: key(X), identifier: 'X', identifierKind: 'baseTypeId' },
    ]);
  });
});

describe('runChunk: the league gate (Story 1.11)', () => {
  const ZERO = { 'tracked-list': 0, 'league-validation': 0, 'session-probe': 0 };
  const LEAGUES = {
    result: [
      { id: 'Forbidden Rites', realm: 'poe2', text: 'Forbidden Rites' },
      { id: 'Standard', realm: 'poe2', text: 'Standard' },
    ],
  };
  const SEARCH_URL = 'https://example.test/search';
  /** A valid dataset: it is loaded, before the gate, under the lock. */
  const PREVIOUS_DATASET = `${JSON.stringify(
    {
      schemaVersion: SUPPORTED_SCHEMA_VERSION,
      league: 'Old League',
      generatedAt: SEVEN_HOURS_AGO,
      entries: [{ entryKey: key(A), price: { state: 'no-listings' }, lastAttemptedAt: SEVEN_HOURS_AGO }],
      currencyRates: [],
    },
    null,
    2,
  )}\n`;
  const PREVIOUS_PROGRESS = progressText([key(A)]);

  /**
   * The real gate over a governed client whose port is counted as
   * `league-validation`, beside a step whose port is counted as
   * `tracked-list`: the composition every shell builds.
   */
  function gated(
    league: string,
    answer: HttpResponse,
    extra: Parameters<typeof createFakeFilesystemPort>[0] = {},
    reuse?: FakeFilesystemPort,
  ): {
    readonly fs: FakeFilesystemPort;
    readonly ports: TestPorts;
    readonly leaguesHttp: ReturnType<typeof createFakeHttpPort>;
    readonly visited: string[];
    readonly step: ChunkStep;
    readonly logs: readonly string[];
  } {
    const requests = createRequestCounter();
    const leaguesHttp = createFakeHttpPort({ [`GET ${TRADE_LEAGUES_URL}`]: answer });
    const stepHttp = requests.counted(
      createFakeHttpPort({ [`POST ${SEARCH_URL}`]: { status: 200, headers: {}, body: '{}' } }),
      'tracked-list',
    );
    const client = createTradeClient({
      http: requests.counted(leaguesHttp, 'league-validation'),
      clock: createFakeClockPort(NOW),
      wait: () => Promise.resolve(),
      userAgent: 'poe-crafting-base-price-checker/0.0.0 (contact: someone@example.test)',
    });
    const built = harness([A, B], extra, { requests, gate: createLeagueGate({ client, league }) });
    const fs = reuse ?? built.fs;
    const { visited, step } = scriptedStep();
    const pricing: ChunkStep = async (entry) => {
      await stepHttp.send({ method: 'POST', url: SEARCH_URL, headers: {} });
      return step(entry);
    };
    return { fs, ports: { ...built.ports, fs }, leaguesHttp, visited, step: pricing, logs: built.logs };
  }

  const ok = (body: unknown): HttpResponse => ({ status: 200, headers: {}, body: JSON.stringify(body) });

  it('match: the chunk runs, one league-validation request, no record', async () => {
    const { fs, ports, leaguesHttp, visited, step } = gated('Standard', ok(LEAGUES));

    const outcome = await run(ports, step);

    expect(outcome.kind).toBe('completed');
    expect(visited).toEqual([key(A), key(B)]);
    expect(leaguesHttp.requests).toHaveLength(1);
    const report = await reportOf(fs);
    expect(report?.figures.requestsBySource).toEqual({
      ...ZERO,
      'tracked-list': 2,
      'league-validation': 1,
      'session-probe': 0,
    });
    expect(report?.records).toEqual([]);
    expect(report?.runFinishedAt).toBe(NOW);
  });

  it('mismatch: a league-mismatch record, no dataset or progress write, lock released, no step', async () => {
    const { fs, ports, visited, step } = gated('Runes of Aldur', ok(LEAGUES), {
      [DATASET_PATH]: { contents: PREVIOUS_DATASET },
      [PROGRESS_PATH]: { contents: PREVIOUS_PROGRESS },
    });

    await expect(run(ports, step)).rejects.toBeInstanceOf(LeagueMismatchError);

    expect(visited).toEqual([]);
    expect(await fs.readTextFile(DATASET_PATH)).toBe(PREVIOUS_DATASET);
    expect(await fs.readTextFile(PROGRESS_PATH)).toBe(PREVIOUS_PROGRESS);
    expect(await fs.exists(LOCK_PATH)).toBe(false);
    const report = await reportOf(fs);
    expect(report?.records).toEqual([
      {
        kind: 'league-mismatch',
        configuredLeague: 'Runes of Aldur',
        availableLeagues: ['Forbidden Rites', 'Standard'],
      },
    ]);
    expect(report?.figures.requestsBySource).toEqual({ ...ZERO, 'league-validation': 1 });
    expect(report !== undefined && 'runFinishedAt' in report).toBe(false);
  });

  it('case or spacing: ids compare byte for byte, so "forbidden rites" is a mismatch', async () => {
    const { fs, ports, visited, step } = gated('forbidden rites', ok(LEAGUES));

    await expect(run(ports, step)).rejects.toBeInstanceOf(LeagueMismatchError);

    expect(visited).toEqual([]);
    const report = await reportOf(fs);
    expect(report?.records).toEqual([
      {
        kind: 'league-mismatch',
        configuredLeague: 'forbidden rites',
        availableLeagues: ['Forbidden Rites', 'Standard'],
      },
    ]);
  });

  it('empty list: a mismatch with no available leagues', async () => {
    const { fs, ports, step } = gated('Standard', ok({ result: [] }));

    await expect(run(ports, step)).rejects.toBeInstanceOf(LeagueMismatchError);

    const report = await reportOf(fs);
    expect(report?.records).toEqual([
      { kind: 'league-mismatch', configuredLeague: 'Standard', availableLeagues: [] },
    ]);
  });

  it('rejected: a 404 is a trade-request-rejected run-failure with the status and no entry key', async () => {
    const { fs, ports, visited, step } = gated('Standard', { status: 404, headers: {}, body: '' });

    await expect(run(ports, step)).rejects.toBeInstanceOf(LeagueRequestRejectedError);

    expect(visited).toEqual([]);
    // The order exists, so the throw publishes the marks. A gate 4xx would be
    // refused again on the next tick, so it writes the abort notBefore (§5.3).
    // With no previous dataset there is no earlier label, so the configured one is written.
    const published = DatasetFileSchema.parse(JSON.parse((await fs.readTextFile(DATASET_PATH)) ?? ''));
    expect(published.league).toBe('Standard');
    expect(await progressOf(fs)).toEqual({
      schemaVersion: SYNC_PROGRESS_SCHEMA_VERSION,
      completed: [],
      notBefore: '2026-09-26T18:00:00.000Z',
    });
    expect(await fs.exists(LOCK_PATH)).toBe(false);
    const report = await reportOf(fs);
    expect(report?.records).toEqual([
      {
        kind: 'run-failure',
        reason: 'trade-request-rejected',
        status: 404,
        message: 'the trade leagues request answered 404; the run is aborted',
      },
    ]);
  });

  it('rejected over a previous dataset labelled Old League: the publish keeps Old League', async () => {
    const { fs, ports, step } = gated(
      'Standard',
      { status: 404, headers: {}, body: '' },
      { [DATASET_PATH]: { contents: PREVIOUS_DATASET } },
    );

    await expect(run(ports, step)).rejects.toBeInstanceOf(LeagueRequestRejectedError);

    const published = DatasetFileSchema.parse(JSON.parse((await fs.readTextFile(DATASET_PATH)) ?? ''));
    expect(published.league).toBe('Old League');
  });

  it('malformed: a body that is not the payload shape is an unrecoverable-error run-failure', async () => {
    const { fs, ports, visited, step } = gated('Standard', ok({ leagues: ['Standard'] }));

    await expect(run(ports, step)).rejects.toThrow(/unexpected body/);

    expect(visited).toEqual([]);
    const report = await reportOf(fs);
    const records = report?.records ?? [];
    expect(records).toHaveLength(1);
    expect(records[0]).toMatchObject({ kind: 'run-failure', reason: 'unrecoverable-error' });
    expect(records[0] !== undefined && 'entryKey' in records[0]).toBe(false);
  });

  it('busy: a live lock means no leagues request at all', async () => {
    const { fs, ports, leaguesHttp, step } = gated('Standard', ok(LEAGUES), {
      [LOCK_PATH]: { contents: serialiseLock({ pid: 99, startedAt: FIVE_HOURS_AGO }) },
    });

    const outcome = await run(ports, step);
    expect(outcome.kind).toBe('busy');

    expect(leaguesHttp.requests).toEqual([]);
    expect(await fs.exists(REPORT_PATH)).toBe(false);
  });

  it('gate 429: the chunk yields, no step, the dataset published, progress remembers the penalty, report finished with no run-failure', async () => {
    const { fs, ports, leaguesHttp, visited, step, logs } = gated(
      'Standard',
      { status: 429, headers: { 'retry-after': '60' }, body: '' },
      {
        [DATASET_PATH]: { contents: PREVIOUS_DATASET },
        [PROGRESS_PATH]: { contents: PREVIOUS_PROGRESS },
      },
    );

    const outcome = await run(ports, step);

    expect(outcome).toEqual({ kind: 'yielded', completed: [], entries: [], records: [] });
    expect(logs).toEqual(['sync: the league check got no answer; the chunk yields with no entry attempted']);
    expect(visited).toEqual([]);
    expect(leaguesHttp.requests).toHaveLength(1);
    // A gate yield publishes like a yielded chunk: the previous entries and the marks (none here).
    const published = DatasetFileSchema.parse(JSON.parse((await fs.readTextFile(DATASET_PATH)) ?? ''));
    // The gate never confirmed the configured league, so the previous label stands.
    expect(published.league).toBe('Old League');
    expect(published.entries.map((entry) => entry.entryKey)).toEqual([key(A), key(B)]);
    expect(await progressOf(fs)).toEqual({
      schemaVersion: SYNC_PROGRESS_SCHEMA_VERSION,
      completed: [key(A)],
      notBefore: '2026-09-26T12:01:00.000Z',
    });
    expect(await fs.exists(LOCK_PATH)).toBe(false);
    const report = await reportOf(fs);
    expect(report?.runFinishedAt).toBe(NOW);
    expect(report?.figures.requestsBySource).toEqual({ ...ZERO, 'league-validation': 1 });
    // Every entry the order made eligible: B (A is complete in this pass).
    expect(report?.figures.notReachedCount).toBe(1);
    expect(report?.records).toEqual([]);
  });

  it('gate 429 with a two-hour Retry-After: notBefore is NOW + 2h, completed kept, the dataset published', async () => {
    const { fs, ports } = gated(
      'Standard',
      { status: 429, headers: { 'retry-after': '7200' }, body: '' },
      {
        [DATASET_PATH]: { contents: PREVIOUS_DATASET },
        [PROGRESS_PATH]: { contents: PREVIOUS_PROGRESS },
      },
    );

    const outcome = await run(ports, scriptedStep().step);
    expect(outcome.kind).toBe('yielded');

    expect(await progressOf(fs)).toEqual({
      schemaVersion: SYNC_PROGRESS_SCHEMA_VERSION,
      completed: [key(A)],
      notBefore: '2026-09-26T14:00:00.000Z',
    });
    const published = DatasetFileSchema.parse(JSON.parse((await fs.readTextFile(DATASET_PATH)) ?? ''));
    expect(published.league).toBe('Old League');
    expect(published.entries.map((entry) => entry.entryKey)).toEqual([key(A), key(B)]);
  });

  it('gate 429 over an unknown-major progress file: rejects, progress untouched, a run-failure reported', async () => {
    const unknown = JSON.stringify({ schemaVersion: '9.0.0', completed: [] });
    const { fs, ports } = gated(
      'Standard',
      { status: 429, headers: { 'retry-after': '60' }, body: '' },
      { [PROGRESS_PATH]: { contents: unknown } },
    );

    await expect(run(ports, scriptedStep().step)).rejects.toThrow(/9\.0\.0/);

    expect(await fs.readTextFile(PROGRESS_PATH)).toBe(unknown);
    const report = await reportOf(fs);
    expect(report?.records).toEqual([expect.objectContaining({ kind: 'run-failure' })]);
    expect(await fs.exists(LOCK_PATH)).toBe(false);
  });

  it('gate 5xx: the chunk yields, publishes the dataset, and writes progress with no notBefore', async () => {
    const { fs, ports } = gated(
      'Standard',
      { status: 503, headers: {}, body: '' },
      { [PROGRESS_PATH]: { contents: PREVIOUS_PROGRESS } },
    );

    const outcome = await run(ports, scriptedStep().step);
    expect(outcome.kind).toBe('yielded');

    expect(await progressOf(fs)).toEqual({ schemaVersion: SYNC_PROGRESS_SCHEMA_VERSION, completed: [key(A)] });
    expect(await fs.exists(DATASET_PATH)).toBe(true);
    const report = await reportOf(fs);
    expect(report?.figures.notReachedCount).toBe(1);
  });

  it('gate yield after the lock was taken over writes nothing and is dispossessed', async () => {
    const { fs, ports, step } = gated('Standard', ok(LEAGUES));
    const outcome = await run(
      {
        ...ports,
        gate: async () => {
          await fs.writeTextFile(LOCK_PATH, serialiseLock({ pid: 99, startedAt: NOW }));
          return { kind: 'yield' };
        },
      },
      step,
    );

    expect(outcome.kind).toBe('dispossessed');
    expect(await fs.exists(REPORT_PATH)).toBe(false);
    expect(await fs.exists(DATASET_PATH)).toBe(false);
    expect(await fs.exists(PROGRESS_PATH)).toBe(false);
    // The foreign lock is not this run's to release.
    expect(await fs.readTextFile(LOCK_PATH)).toBe(serialiseLock({ pid: 99, startedAt: NOW }));
  });

  it('repeat: a mismatch two runs running leaves one league-mismatch record', async () => {
    const first = gated('Runes of Aldur', ok(LEAGUES));
    await expect(run(first.ports, first.step)).rejects.toBeInstanceOf(LeagueMismatchError);
    const second = gated('Runes of Aldur', ok(LEAGUES), {}, first.fs);
    await expect(run(second.ports, second.step)).rejects.toBeInstanceOf(LeagueMismatchError);

    const report = await reportOf(first.fs);
    expect(report?.records).toEqual([
      {
        kind: 'league-mismatch',
        configuredLeague: 'Runes of Aldur',
        availableLeagues: ['Forbidden Rites', 'Standard'],
      },
    ]);
  });
});

/** A filesystem that records every path written through it. */
function recordingWrites(fs: FakeFilesystemPort): { readonly fs: FakeFilesystemPort; readonly writes: string[] } {
  const writes: string[] = [];
  return {
    writes,
    fs: {
      ...fs,
      writeTextFile: (path, contents) => {
        writes.push(path);
        return fs.writeTextFile(path, contents);
      },
    },
  };
}

/** The progress file of a previous chunk that ended on a penalty. */
function progressWithNotBefore(completed: readonly string[], notBefore: string): string {
  return JSON.stringify({ schemaVersion: SYNC_PROGRESS_SCHEMA_VERSION, completed, notBefore });
}

describe('runChunk: penalty memory across processes (AD-8, IMPLEMENTATION-NOTES.md §5.3)', () => {
  it('step 429: progress gets notBefore = NOW + the yield’s retry-after', async () => {
    const { fs, ports } = harness([A, B]);
    const { step } = scriptedStep((entry) =>
      key(entry) === key(B) ? { kind: 'yielded', retryAfterMs: 60_000 } : { kind: 'completed' },
    );

    const outcome = await run(ports, step);
    expect(outcome.kind).toBe('yielded');

    expect(await progressOf(fs)).toEqual({
      schemaVersion: SYNC_PROGRESS_SCHEMA_VERSION,
      completed: [key(A)],
      notBefore: '2026-09-26T12:01:00.000Z',
    });
  });

  it('huge Retry-After: notBefore is capped at NOW + staleLockAfter', async () => {
    const { fs, ports } = harness([A]);
    const { step } = scriptedStep(() => ({ kind: 'yielded', retryAfterMs: 86_400_000 }));

    await run(ports, step);

    expect(await progressOf(fs)).toMatchObject({ notBefore: '2026-09-26T18:00:00.000Z' });
  });

  it('a step yield with no retry-after (a 5xx, a timeout, the threshold) writes no notBefore', async () => {
    const { fs, ports } = harness([A], {
      [PROGRESS_PATH]: { contents: progressWithNotBefore([], '2026-09-26T11:00:00.000Z') },
    });
    const { step } = scriptedStep(() => ({ kind: 'yielded' }));

    const outcome = await run(ports, step);
    expect(outcome.kind).toBe('yielded');

    expect(await progressOf(fs)).toEqual({ schemaVersion: SYNC_PROGRESS_SCHEMA_VERSION, completed: [] });
  });

  it.each([
    ['completed', () => ({ kind: 'completed' }) as const],
    ['bounded', () => ({ kind: 'completed', searchRemaining: 0 }) as const],
  ])('clearing: a %s chunk over a past notBefore writes progress without the field', async (kind, script) => {
    const { fs, ports } = harness([A, B], {
      [PROGRESS_PATH]: { contents: progressWithNotBefore([], '2026-09-26T11:59:59.000Z') },
    });

    const outcome = await run(ports, scriptedStep(script).step);
    expect(outcome.kind).toBe(kind);

    const progress = await progressOf(fs);
    expect(progress).toBeDefined();
    expect(progress !== null && typeof progress === 'object' && 'notBefore' in progress).toBe(false);
  });

  it('deferred: now < notBefore releases the lock, sends nothing and writes nothing', async () => {
    const until = '2026-09-26T12:00:01.000Z';
    const progress = progressWithNotBefore([key(A)], until);
    const built = harness([A, B], { [PROGRESS_PATH]: { contents: progress } });
    const { fs, writes } = recordingWrites(built.fs);
    let isGateCalled = false;
    let isCatalogueCalled = false;
    let loads = 0;
    const { visited, step } = scriptedStep();

    const outcome = await run(
      {
        ...built.ports,
        fs,
        load: () => {
          loads += 1;
          return Promise.reject(new Error('load must not run on a deferred chunk'));
        },
        gate: () => {
          isGateCalled = true;
          return Promise.resolve({ kind: 'pass' });
        },
        catalogue: () => {
          isCatalogueCalled = true;
          return Promise.resolve({ ok: true, value: RESOLVES_ALL });
        },
      },
      step,
    );

    expect(outcome).toEqual({ kind: 'deferred', completed: [], entries: [], records: [], notBefore: until });
    expect(visited).toEqual([]);
    expect(isGateCalled).toBe(false);
    expect(isCatalogueCalled).toBe(false);
    expect(loads).toBe(0);
    // The lock is the only file touched, and it is gone again.
    expect(writes.filter((path) => path !== LOCK_PATH)).toEqual([]);
    expect(await fs.exists(LOCK_PATH)).toBe(false);
    expect(await fs.readTextFile(PROGRESS_PATH)).toBe(progress);
    expect(await fs.exists(REPORT_PATH)).toBe(false);
    expect(built.logs).toEqual([
      `sync: a previous chunk set a pause until ${until} (a 429 or a rejected request); nothing sent this invocation`,
    ]);
  });

  it('round trip: a step 429 chunk, then a second chunk at the same NOW is deferred with no step visited', async () => {
    const { fs, ports } = harness([A, B]);
    const first = scriptedStep((entry) =>
      key(entry) === key(B) ? { kind: 'yielded', retryAfterMs: 60_000 } : { kind: 'completed' },
    );
    const outcome = await run(ports, first.step);
    expect(outcome.kind).toBe('yielded');

    const second = scriptedStep();
    expect(await run(ports, second.step)).toMatchObject({
      kind: 'deferred',
      notBefore: '2026-09-26T12:01:00.000Z',
    });
    expect(second.visited).toEqual([]);
    expect(await fs.exists(LOCK_PATH)).toBe(false);
  });

  it('round trip: a malformed-request abort, then a second chunk at the same NOW is deferred with no step visited', async () => {
    const { fs, ports } = harness([A, B]);
    const stamped: DatasetEntry = {
      entryKey: key(B),
      price: { state: 'not-yet-synced', reason: 'never-synced' },
      lastAttemptedAt: NOW,
    };
    const failure = new MalformedRequestError(key(B), 'search', 400, stamped);
    await expect(
      run(ports, (entry) =>
        key(entry) === key(B) ? Promise.reject(failure) : Promise.resolve({ kind: 'completed' }),
      ),
    ).rejects.toBe(failure);

    const second = scriptedStep();
    expect(await run(ports, second.step)).toMatchObject({
      kind: 'deferred',
      notBefore: '2026-09-26T18:00:00.000Z',
    });
    expect(second.visited).toEqual([]);
    expect(await fs.exists(LOCK_PATH)).toBe(false);
  });

  it('now = notBefore does not defer: the pause has run out', async () => {
    const { ports } = harness([A], {
      [PROGRESS_PATH]: { contents: progressWithNotBefore([], NOW) },
    });

    const outcome = await run(ports, scriptedStep().step);
    expect(outcome.kind).toBe('completed');
  });

  it('deferred after breaking a stale lock: only sync-report.json is written, carrying stale-lock-broken', async () => {
    const stale = serialiseLock({ pid: 7, startedAt: SEVEN_HOURS_AGO });
    const progress = progressWithNotBefore([], '2026-09-26T13:00:00.000Z');
    const previousRecord: SyncRunRecord = { kind: 'weights-absent', uncheckableClassNames: [] };
    const previousReport = JSON.stringify({
      schemaVersion: '1.0.0',
      runStartedAt: SEVEN_HOURS_AGO,
      figures: {
        requestsBySource: { 'tracked-list': 3, 'league-validation': 1, 'catalogue-refresh': 0 },
        notReachedCount: 0,
      },
      records: [previousRecord],
    });
    const built = harness([A], {
      [LOCK_PATH]: { contents: stale },
      [PROGRESS_PATH]: { contents: progress },
      [REPORT_PATH]: { contents: previousReport },
    });
    const { fs, writes } = recordingWrites(built.fs);
    const { visited, step } = scriptedStep();

    const outcome = await run({ ...built.ports, fs }, step);

    expect(outcome.kind).toBe('deferred');
    expect(visited).toEqual([]);
    expect(writes.filter((path) => path !== LOCK_PATH && !path.endsWith('.break.lock'))).toEqual([REPORT_PATH]);
    expect(await fs.readTextFile(PROGRESS_PATH)).toBe(progress);
    expect(await fs.exists(DATASET_PATH)).toBe(false);
    const report = await reportOf(fs);
    expect(report).toEqual({
      runStartedAt: NOW,
      runFinishedAt: NOW,
      figures: { requestsBySource: { 'tracked-list': 0, 'league-validation': 0, 'session-probe': 0 }, notReachedCount: 0 },
      records: [previousRecord, { kind: 'stale-lock-broken', pid: 7, startedAt: SEVEN_HOURS_AGO }],
      schemaVersion: SYNC_REPORT_SCHEMA_VERSION,
    });
    expect(await fs.exists(LOCK_PATH)).toBe(false);
  });

  it('deferred after breaking a stale lock: the previous coverage pair is carried over unchanged', async () => {
    const previousReport = JSON.stringify({
      schemaVersion: '1.1.0',
      runStartedAt: SEVEN_HOURS_AGO,
      figures: {
        requestsBySource: { 'tracked-list': 3, 'league-validation': 1, 'session-probe': 0 },
        notReachedCount: 0,
        coverage: 0.75,
        rankableClassCount: 4,
      },
      records: [],
    });
    const built = harness([A], {
      [LOCK_PATH]: { contents: serialiseLock({ pid: 7, startedAt: SEVEN_HOURS_AGO }) },
      [PROGRESS_PATH]: { contents: progressWithNotBefore([], '2026-09-26T13:00:00.000Z') },
      [REPORT_PATH]: { contents: previousReport },
    });

    const outcome = await run(built.ports, scriptedStep().step);
    expect(outcome.kind).toBe('deferred');

    const report = await reportOf(built.fs);
    const figures = report?.figures;
    expect(figures?.coverage).toBe(0.75);
    expect(figures?.rankableClassCount).toBe(4);
  });

  it('growth: two starving chunks leave one pinned-starvation record, at its first position, carrying the latest allowance', async () => {
    const P1 = raw('P1', 'pinned');
    const P2 = raw('P2', 'pinned');
    const P3 = raw('P3', 'pinned');
    const entries = [P1, P2, P3, A];
    const earlier: SyncRunRecord = { kind: 'stale-lock-broken', pid: 7, startedAt: SEVEN_HOURS_AGO };
    const fsShared = createFakeFilesystemPort({
      [TRACKED_PATH]: { contents: trackedText(entries) },
      [WEIGHTS_PATH]: { contents: EMPTY_WEIGHTS },
      [REPORT_PATH]: {
        contents: JSON.stringify({
          schemaVersion: '1.1.0',
          runStartedAt: SEVEN_HOURS_AGO,
          figures: { requestsBySource: { 'tracked-list': 0, 'league-validation': 0, 'session-probe': 0 }, notReachedCount: 0 },
          records: [earlier],
        }),
      },
    });
    const chunk = (remaining: number) =>
      run(
        { fs: fsShared, clock: createFakeClockPort(NOW), pid: PID, ...shellPorts(), publication: PUBLICATION, log: () => {} },
        scriptedStep(() => ({ kind: 'completed', searchRemaining: remaining })).step,
      );

    // First chunk: allowance 3 (2 remaining after the first step). Second: 1 (0 remaining).
    const result = await chunk(2);
    expect(result.pinnedStarvation).toMatchObject({ discoveredAllowance: 3 });
    const second = await chunk(0);
    expect(second.pinnedStarvation).toMatchObject({ discoveredAllowance: 1 });

    const report = await reportOf(fsShared);
    const records = report?.records ?? [];
    expect(records.filter((record) => record.kind === 'pinned-starvation')).toHaveLength(1);
    expect(records[0]).toEqual(earlier);
    expect(records[1]).toMatchObject({ kind: 'pinned-starvation', discoveredAllowance: 1, pinnedCount: 3 });
  });

  it('new subject: a second chunk whose pinned set changed adds a second starvation record', async () => {
    const P1 = raw('P1', 'pinned');
    const P2 = raw('P2', 'pinned');
    const P3 = raw('P3', 'pinned');
    const fsShared = createFakeFilesystemPort({
      [TRACKED_PATH]: { contents: trackedText([P1, P2, P3, A]) },
      [WEIGHTS_PATH]: { contents: EMPTY_WEIGHTS },
    });
    const chunk = () =>
      run(
        { fs: fsShared, clock: createFakeClockPort(NOW), pid: PID, ...shellPorts(), publication: PUBLICATION, log: () => {} },
        scriptedStep(() => ({ kind: 'completed', searchRemaining: 0 })).step,
      );

    await chunk();
    // The player unpins one entry: the yardstick is unchanged, the pinned count is not.
    await fsShared.writeTextFile(TRACKED_PATH, trackedText([P1, P2, raw('P3'), A]));
    await chunk();

    const report = await reportOf(fsShared);
    const starvations = (report?.records ?? []).filter(
      (record): record is PinnedStarvationRecord => record.kind === 'pinned-starvation',
    );
    expect(starvations.map((record) => record.pinnedCount)).toEqual([3, 2]);
  });
});

async function datasetEntriesOf(fs: FakeFilesystemPort): Promise<readonly DatasetEntry[] | undefined> {
  const text = await fs.readTextFile(DATASET_PATH);
  return text === undefined ? undefined : DatasetFileSchema.parse(JSON.parse(text)).entries;
}

describe('runChunk: the AD-12 run-start sequence and the failure path', () => {
  const X = raw('X');
  const D = raw('D');
  const MISSING_X: Partial<TestPorts> = {
    catalogue: () => Promise.resolve({ ok: true, value: catalogueWithout('X') }),
  };
  const UNRESOLVABLE_X = { kind: 'unresolvable', entryKey: key(X), identifier: 'X', identifierKind: 'baseTypeId' };

  it('runs in cost order: progress, report, tracked, dataset, load, catalogue, weights, gate, then the step', async () => {
    const events: string[] = [];
    const { fs, ports } = harness([A]);
    const named: Readonly<Record<string, string>> = {
      [PROGRESS_PATH]: 'progress',
      [REPORT_PATH]: 'report',
      [TRACKED_PATH]: 'tracked',
      [DATASET_PATH]: 'dataset',
      [WEIGHTS_PATH]: 'weights',
    };
    const reading: FakeFilesystemPort = {
      ...fs,
      readTextFile: (path) => {
        const event = named[path];
        if (event !== undefined) {
          events.push(event);
        }
        return fs.readTextFile(path);
      },
    };
    const { publication = PUBLICATION, starvationRecord = DEFAULT_STARVATION, ...base } = ports;

    await runChunk({
      ...base,
      fs: reading,
      load: () => {
        events.push('load');
        return Promise.resolve({
          publication,
          starvationRecord,
          gate: () => {
            events.push('gate');
            return Promise.resolve({ kind: 'pass' });
          },
          step: () => {
            events.push('step');
            return Promise.resolve({ kind: 'completed' });
          },
        });
      },
      catalogue: () => {
        events.push('catalogue');
        return Promise.resolve({ ok: true, value: RESOLVES_ALL });
      },
    });

    expect(events).toEqual([
      'progress',
      'report',
      'tracked',
      'dataset',
      'load',
      'catalogue',
      'weights',
      'gate',
      'step',
    ]);
  });

  it('a catalogue refusal: no gate call, a run-failure, no dataset or progress, the lock released', async () => {
    let gateCalls = 0;
    const { fs, ports } = harness([A], {}, {
      catalogue: () =>
        Promise.resolve({
          ok: false,
          error: new DataFileError('data/catalogue/stats.json', 'absent', 'the file is absent'),
        }),
      gate: () => {
        gateCalls += 1;
        return Promise.resolve({ kind: 'pass' });
      },
    });

    await expect(run(ports, scriptedStep().step)).rejects.toBeInstanceOf(DataFileError);

    expect(gateCalls).toBe(0);
    expect(await fs.exists(DATASET_PATH)).toBe(false);
    expect(await fs.exists(PROGRESS_PATH)).toBe(false);
    expect(await fs.exists(LOCK_PATH)).toBe(false);
    const report = await reportOf(fs);
    expect(report?.records).toEqual([expect.objectContaining({ kind: 'run-failure' })]);
  });

  it('a pinned-cap excess from load: a run-failure naming data/tracked.json, nothing else written', async () => {
    const { fs, ports } = harness([A]);
    const excess = new PinnedCapExceededError({
      kind: 'pinned-cap-exceeded',
      pinnedCount: 2,
      pinnedLimit: 0.5,
      minChunkSearches: 1,
      message: 'data/tracked.json: 2 pinned entries exceed the cap of 0.5 (0.5 × minChunkSearches 1)',
    });
    let catalogueCalls = 0;

    await expect(
      runChunk({
        ...ports,
        load: () => Promise.reject(excess),
        catalogue: () => {
          catalogueCalls += 1;
          return Promise.resolve({ ok: true, value: RESOLVES_ALL });
        },
      }),
    ).rejects.toBe(excess);

    expect(catalogueCalls).toBe(0);
    expect(await fs.exists(DATASET_PATH)).toBe(false);
    expect(await fs.exists(PROGRESS_PATH)).toBe(false);
    const report = await reportOf(fs);
    const records = report?.records ?? [];
    expect(records).toEqual([expect.objectContaining({ kind: 'run-failure', reason: 'unrecoverable-error' })]);
    expect(records[0]).toHaveProperty('message', expect.stringContaining('data/tracked.json'));
  });

  it('gate 429 with one id missing and three eligible: yielded, the mark published, notBefore set, notReachedCount 3', async () => {
    const { fs, ports } = harness([A, B, C, X], {}, {
      ...MISSING_X,
      gate: () => Promise.resolve({ kind: 'yield', retryAfterMs: 60_000 }),
    });
    const { visited, step } = scriptedStep();

    const outcome = await run(ports, step);

    expect(outcome.kind).toBe('yielded');
    expect(visited).toEqual([]);
    const published = await datasetEntriesOf(fs);
    expect(published?.find((entry) => entry.entryKey === key(X))?.price).toEqual({ state: 'unresolvable' });
    expect(await progressOf(fs)).toEqual({
      schemaVersion: SYNC_PROGRESS_SCHEMA_VERSION,
      completed: [],
      notBefore: '2026-09-26T12:01:00.000Z',
    });
    const report = await reportOf(fs);
    expect(report?.figures.notReachedCount).toBe(3);
    expect(report?.records).toEqual([UNRESOLVABLE_X]);
    expect(report?.runFinishedAt).toBe(NOW);
  });

  it('gate 429 over a previous dataset labelled Old League keeps Old League', async () => {
    const previous = JSON.stringify({
      schemaVersion: SUPPORTED_SCHEMA_VERSION,
      league: 'Old League',
      generatedAt: SEVEN_HOURS_AGO,
      entries: [],
      currencyRates: [],
    });
    const { fs, ports } = harness([A], { [DATASET_PATH]: { contents: previous } }, {
      publication: { league: 'New League', currencyRates: [] },
      gate: () => Promise.resolve({ kind: 'yield', retryAfterMs: 60_000 }),
    });

    const outcome = await run(ports, scriptedStep().step);
    expect(outcome.kind).toBe('yielded');

    const text = await fs.readTextFile(DATASET_PATH);
    expect(DatasetFileSchema.parse(JSON.parse(text ?? '')).league).toBe('Old League');
  });

  it('gate 5xx or timeout yield: as a 429, with progress carrying no notBefore', async () => {
    const { fs, ports } = harness([A, B, C, X], {}, {
      ...MISSING_X,
      gate: () => Promise.resolve({ kind: 'yield' }),
    });

    const outcome = await run(ports, scriptedStep().step);
    expect(outcome.kind).toBe('yielded');

    const entries = await datasetEntriesOf(fs);
    expect(entries?.find((entry) => entry.entryKey === key(X))?.price).toEqual({
      state: 'unresolvable',
    });
    expect(await progressOf(fs)).toEqual({ schemaVersion: SYNC_PROGRESS_SCHEMA_VERSION, completed: [] });
    const report = await reportOf(fs);
    expect(report?.figures.notReachedCount).toBe(3);
    expect(report?.records).toEqual([UNRESOLVABLE_X]);
  });

  it('a league mismatch with one id missing: no dataset or progress write, the report carries the mismatch alone', async () => {
    const mismatch = new LeagueMismatchError('Nope', ['Standard']);
    const { fs, ports } = harness([A, X], { [PROGRESS_PATH]: { contents: progressText([]) } }, {
      ...MISSING_X,
      gate: () => Promise.reject(mismatch),
    });

    await expect(run(ports, scriptedStep().step)).rejects.toBe(mismatch);

    expect(await fs.exists(DATASET_PATH)).toBe(false);
    expect(await fs.readTextFile(PROGRESS_PATH)).toBe(progressText([]));
    const report = await reportOf(fs);
    expect(report?.records).toEqual([
      { kind: 'league-mismatch', configuredLeague: 'Nope', availableLeagues: ['Standard'] },
    ]);
    // The figure is the eligible count by the same AD-7 definition: A.
    expect(report?.figures.notReachedCount).toBe(1);
  });

  it('a league mismatch after a broken stale lock: the lock record and the mismatch', async () => {
    const mismatch = new LeagueMismatchError('Nope', ['Standard']);
    const { fs, ports } = harness(
      [A, X],
      { [LOCK_PATH]: { contents: serialiseLock({ pid: 7, startedAt: SEVEN_HOURS_AGO }) } },
      { ...MISSING_X, gate: () => Promise.reject(mismatch) },
    );

    await expect(run(ports, scriptedStep().step)).rejects.toBe(mismatch);

    const report = await reportOf(fs);
    expect(report?.records.map((record) => record.kind)).toEqual([
      'stale-lock-broken',
      'league-mismatch',
    ]);
  });

  it('a plain step throw on the third entry: the two entries and the mark published, no notBefore, the failure reported', async () => {
    const { fs, ports } = harness([A, B, D, X], {}, MISSING_X);
    const failure = new Error('step exploded');

    await expect(
      run(ports, (entry) =>
        key(entry) === key(D)
          ? Promise.reject(failure)
          : Promise.resolve({ kind: 'completed', entry: noListingsEntry(entry) }),
      ),
    ).rejects.toBe(failure);

    const published = await datasetEntriesOf(fs);
    expect(published?.find((entry) => entry.entryKey === key(A))).toEqual(noListingsEntry(A));
    expect(published?.find((entry) => entry.entryKey === key(B))).toEqual(noListingsEntry(B));
    expect(published?.find((entry) => entry.entryKey === key(X))?.price).toEqual({ state: 'unresolvable' });
    expect(await progressOf(fs)).toEqual({
      schemaVersion: SYNC_PROGRESS_SCHEMA_VERSION,
      completed: [key(A), key(B)].toSorted(compareCanonicalKeys),
    });
    const report = await reportOf(fs);
    expect(report?.records).toEqual([
      UNRESOLVABLE_X,
      { kind: 'run-failure', reason: 'unrecoverable-error', entryKey: key(D), message: 'step exploded' },
    ]);
  });

  it('a normal-path dataset write that fails is attempted once, and the report carries a run-failure', async () => {
    const { fs, ports } = harness([A]);
    let datasetWrites = 0;
    const faulty: FakeFilesystemPort = {
      ...fs,
      writeTextFile: (path, contents) => {
        if (path === DATASET_PATH) {
          datasetWrites += 1;
          return Promise.reject(new Error('disk full'));
        }
        return fs.writeTextFile(path, contents);
      },
    };

    await expect(run({ ...ports, fs: faulty }, scriptedStep().step)).rejects.toThrow('disk full');

    expect(datasetWrites).toBe(1);
    expect(await fs.exists(PROGRESS_PATH)).toBe(false);
    const finalReport = await reportOf(fs);
    expect(finalReport?.records).toEqual([
      { kind: 'run-failure', reason: 'unrecoverable-error', message: 'disk full' },
    ]);
  });
});

/** A gate that passes and counts its calls. */
function countingGate(): { readonly calls: number[]; readonly gate: NonNullable<ChunkSetup['gate']> } {
  const calls: number[] = [];
  return {
    calls,
    gate: () => {
      calls.push(1);
      return Promise.resolve({ kind: 'pass' });
    },
  };
}

describe('runChunk: under a session (ChunkPorts.session)', () => {
  it('maxEntries 1 with an entry left ends bounded by entries, and names the pass and the league', async () => {
    const { fs, ports } = harness([A, B]);
    const { visited, step } = scriptedStep();
    const { calls, gate } = countingGate();

    const outcome = await run({ ...ports, gate, session: { maxEntries: 1 } }, step);

    expect(outcome).toEqual({
      kind: 'bounded',
      bound: 'entries',
      completed: [key(A)],
      entries: [],
      records: [],
      newPass: false,
      confirmedLeague: 'Standard',
    });
    expect(visited).toEqual([key(A)]);
    expect(calls).toHaveLength(1);
    expect(await progressOf(fs)).toEqual({ schemaVersion: SYNC_PROGRESS_SCHEMA_VERSION, completed: [key(A)] });
  });

  it('maxEntries 1 on the last entry of the pass is completed', async () => {
    const { ports } = harness([A, B], { [PROGRESS_PATH]: { contents: progressText([key(A)]) } });
    const { visited, step } = scriptedStep();

    const outcome = await run({ ...ports, session: { maxEntries: 1 } }, step);

    expect(outcome).toMatchObject({ kind: 'completed', completed: [key(B)], newPass: false });
    expect(visited).toEqual([key(B)]);
  });

  it('skips the gate while the confirmed league holds in the same pass', async () => {
    const { ports } = harness([A, B], { [PROGRESS_PATH]: { contents: progressText([key(A)]) } });
    const { step } = scriptedStep();
    const { calls, gate } = countingGate();

    const outcome = await run(
      { ...ports, gate, session: { maxEntries: 1, confirmedLeague: 'Standard' } },
      step,
    );

    expect(calls).toEqual([]);
    expect(outcome).toMatchObject({ confirmedLeague: 'Standard', newPass: false });
  });

  it('runs the gate on a new pass, even with a confirmed league', async () => {
    const { ports } = harness([A, B], { [PROGRESS_PATH]: { contents: progressText([key(A), key(B)]) } });
    const { step } = scriptedStep();
    const { calls, gate } = countingGate();

    const outcome = await run(
      { ...ports, gate, session: { maxEntries: 1, confirmedLeague: 'Standard' } },
      step,
    );

    expect(calls).toHaveLength(1);
    expect(outcome).toMatchObject({ kind: 'bounded', bound: 'entries', newPass: true });
  });

  it('runs the gate when the configured league differs from the confirmed one', async () => {
    const { ports } = harness([A, B]);
    const { step } = scriptedStep();
    const { calls, gate } = countingGate();

    const outcome = await run(
      { ...ports, gate, session: { maxEntries: 1, confirmedLeague: 'Old League' } },
      step,
    );

    expect(calls).toHaveLength(1);
    expect(outcome).toMatchObject({ confirmedLeague: 'Standard' });
  });

  it('a gate yield names no confirmed league', async () => {
    const { ports } = harness([A, B]);
    const { step } = scriptedStep();

    const outcome = await run(
      { ...ports, gate: () => Promise.resolve({ kind: 'yield' }), session: { maxEntries: 1 } },
      step,
    );

    expect(outcome).toEqual({ kind: 'yielded', completed: [], entries: [], records: [], newPass: false });
  });

  it('counts the report figure from the pass start, and from its own start on a new pass', async () => {
    const passStart = { ...zeroRequests(), 'league-validation': 1, 'tracked-list': 1 };
    const counts = [
      { ...zeroRequests(), 'league-validation': 1, 'tracked-list': 3 },
      { ...zeroRequests(), 'league-validation': 1, 'tracked-list': 4 },
    ];
    let reads = 0;
    const requests = {
      snapshot: () => counts[Math.min(reads++, counts.length - 1)] ?? zeroRequests(),
    };

    const within = harness([A, B], {}, { requests });
    await run({ ...within.ports, session: { maxEntries: 1, requestsSince: passStart } }, scriptedStep().step);
    // 4 − 1 searches since the pass started, not 4 − 3 since this chunk did.
    const latestReport = await reportOf(within.fs);
    expect(latestReport?.figures.requestsBySource).toEqual({
      'league-validation': 0,
      'session-probe': 0,
      'tracked-list': 3,
    });

    reads = 0;
    const fresh = harness([A, B], { [PROGRESS_PATH]: { contents: progressText([key(A), key(B)]) } }, { requests });
    await run({ ...fresh.ports, session: { maxEntries: 1, requestsSince: passStart } }, scriptedStep().step);
    const finalReport = await reportOf(fresh.fs);
    expect(finalReport?.figures.requestsBySource).toEqual({
      'league-validation': 0,
      'session-probe': 0,
      'tracked-list': 1,
    });
  });

  it('keeps only stale pinned entries under pinnedMaxAgeMs', async () => {
    const pinned = raw('Pinned', 'pinned');
    const dataset: DatasetFile = {
      schemaVersion: SUPPORTED_SCHEMA_VERSION,
      league: 'Standard',
      generatedAt: NOW,
      entries: [
        { entryKey: key(pinned), price: { state: 'no-listings' }, lastAttemptedAt: '2026-09-26T11:00:00.000Z' },
      ],
      currencyRates: [],
    };
    const { ports } = harness([pinned, A], { [DATASET_PATH]: { contents: JSON.stringify(dataset) } });
    const { visited, step } = scriptedStep();

    await run({ ...ports, session: { maxEntries: 1, pinnedMaxAgeMs: 4 * 60 * 60 * 1000 } }, step);

    expect(visited).toEqual([key(A)]);
  });

  it('a batch chunk carries neither session field', async () => {
    const { ports } = harness([A]);

    const outcome = await run(ports, scriptedStep().step);

    expect(outcome).not.toHaveProperty('newPass');
    expect(outcome).not.toHaveProperty('confirmedLeague');
  });
});

const bow = (valueMin: number, valueMax: number): TrackedEntry => ({
  kind: 'crafted',
  categoryId: 'weapon.bow',
  className: 'Bows',
  itemLevelMin: 82,
  prefix: { kind: 'banded', statId: 'explicit.stat_1', valueMin, valueMax },
  suffix: { kind: 'banded', statId: 'explicit.stat_2', valueMin: 1, valueMax: 2 },
  status: 'active',
});

describe('runChunk: the cross-file gate (AD-12, AD-17)', () => {
  /** A Bows class whose one prefix tier derives to `[43, 56.5]`. */
  const BOWS_WEIGHTS = JSON.stringify({
    schemaVersion: WEIGHTS_SCHEMA_VERSION,
    gamePatch: '0.5.5',
    producer: { id: 'test', generatedAt: '2026-09-26T00:00:00Z' },
    bases: {
      'weapon.bow': {
        Bows: {
          prefix: {
            poolCoverage: 'complete',
            entries: [
              {
                sourceModifierId: 'p1',
                modGroup: 'P',
                itemLevelMin: 60,
                weight: 100,
                weightSource: 'published',
                lines: [{ statId: 'explicit.stat_1', ranges: [[43, 56.5]] }],
              },
            ],
          },
          suffix: {
            poolCoverage: 'complete',
            entries: [
              {
                sourceModifierId: 's1',
                modGroup: 'S',
                itemLevelMin: 1,
                weight: 100,
                weightSource: 'published',
                lines: [{ statId: 'explicit.stat_2', ranges: [[1, 2]] }],
              },
            ],
          },
        },
      },
    },
  });
  const PREVIOUS_PROGRESS = progressText([key(A)]);

  it('throws before the order on any failure: one record per failure, no publish, progress untouched', async () => {
    const sentinel = bow(0, 9999);
    const { fs, ports } = harness([A, sentinel], {
      [WEIGHTS_PATH]: { contents: BOWS_WEIGHTS },
      [PROGRESS_PATH]: { contents: PREVIOUS_PROGRESS },
    });
    const { visited, step } = scriptedStep();

    await expect(run(ports, step)).rejects.toBeInstanceOf(CrossFileGateError);

    expect(visited).toEqual([]);
    expect(await fs.exists(DATASET_PATH)).toBe(false);
    expect(await fs.readTextFile(PROGRESS_PATH)).toBe(PREVIOUS_PROGRESS);
    expect(await fs.exists(LOCK_PATH)).toBe(false);
    const report = await reportOf(fs);
    const records = report?.records ?? [];
    expect(records).toHaveLength(1);
    expect(records[0]).toMatchObject({ kind: 'cross-file-gate-failure', check: 'edge-alignment', entryKey: key(sentinel) });
  });

  it('keeps the run-start records and puts the gate records after them', async () => {
    const sentinel = bow(0, 9999);
    const { fs, ports } = harness(
      [A, sentinel],
      { [WEIGHTS_PATH]: { contents: BOWS_WEIGHTS } },
      { catalogue: () => Promise.resolve({ ok: true, value: catalogueWithout('A') }) },
    );

    await expect(run(ports, scriptedStep().step)).rejects.toBeInstanceOf(CrossFileGateError);

    const report = await reportOf(fs);
    const kinds = (report?.records ?? []).map((record) => record.kind);
    expect(kinds).toContain('unresolvable');
    expect(kinds.at(-1)).toBe('cross-file-gate-failure');
    expect(kinds.indexOf('unresolvable')).toBeLessThan(kinds.indexOf('cross-file-gate-failure'));
  });

  it('runs the chunk when every check passes', async () => {
    const { ports } = harness([A, bow(43, 56.5)], { [WEIGHTS_PATH]: { contents: BOWS_WEIGHTS } });
    const { visited, step } = scriptedStep();

    const outcome = await run(ports, step);

    expect(outcome.kind).toBe('completed');
    expect(visited).toContain(key(A));
  });

  it('skips the gate without a weights file', async () => {
    const { fs, ports } = harness([A, bow(0, 9999)]);
    await fs.deleteFile(WEIGHTS_PATH);

    const outcome = await run(ports, scriptedStep().step);
    expect(outcome.kind).toBe('completed');
  });

  it('keeps one record per (check, entry) across two failing runs', async () => {
    const sentinel = bow(0, 9999);
    const { fs, ports } = harness([sentinel], { [WEIGHTS_PATH]: { contents: BOWS_WEIGHTS } });
    await expect(run(ports, scriptedStep().step)).rejects.toBeInstanceOf(CrossFileGateError);
    await expect(run(ports, scriptedStep().step)).rejects.toBeInstanceOf(CrossFileGateError);

    const report = await reportOf(fs);
    const records = report?.records ?? [];
    expect(records.filter((record) => record.kind === 'cross-file-gate-failure')).toHaveLength(1);
  });
});

/** A step that latches the governor's penalty while it completes, as a probe 429 does. */
function latching(result: StepResult): { readonly step: ChunkStep; readonly latched: () => number | undefined } {
  let latchedMs: number | undefined;
  const { step } = scriptedStep(() => {
    latchedMs ??= 120_000;
    return result;
  });
  return { step, latched: () => latchedMs };
}

describe('runChunk: a latched probe 429 (IMPLEMENTATION-NOTES.md §13.3)', () => {
  it('the entry completes with no further request: the chunk yields and persists notBefore', async () => {
    const { fs, ports } = harness([A]);
    const { step, latched } = latching({ kind: 'completed' });

    const outcome = await run({ ...ports, latchedRetryAfterMs: latched }, step);

    expect(outcome.kind).toBe('yielded');
    // The entry the baseline answered keeps its result.
    expect(outcome.completed).toEqual([key(A)]);
    expect(await progressOf(fs)).toEqual({
      schemaVersion: SYNC_PROGRESS_SCHEMA_VERSION,
      completed: [key(A)],
      notBefore: '2026-09-26T12:02:00.000Z',
    });
  });

  it('a bound ended the chunk: the latch still makes it a 429 yield', async () => {
    const { fs, ports } = harness([A, B]);
    const { step, latched } = latching({ kind: 'completed', searchRemaining: 0 });

    const outcome = await run({ ...ports, latchedRetryAfterMs: latched }, step);

    expect(outcome.kind).toBe('yielded');
    expect(await progressOf(fs)).toMatchObject({ completed: [key(A)], notBefore: '2026-09-26T12:02:00.000Z' });
  });

  it('a session entries bound: the latch still makes it a 429 yield', async () => {
    const { fs, ports } = harness([A, B]);
    const { step, latched } = latching({ kind: 'completed' });

    const outcome = await run({ ...ports, latchedRetryAfterMs: latched, session: { maxEntries: 1 } }, step);

    expect(outcome.kind).toBe('yielded');
    expect(await progressOf(fs)).toMatchObject({ notBefore: '2026-09-26T12:02:00.000Z' });
  });

  it('no latch: the ending and the progress are unchanged', async () => {
    const { fs, ports } = harness([A]);
    const { step } = scriptedStep();

    const outcome = await run({ ...ports, latchedRetryAfterMs: () => {} }, step);

    expect(outcome.kind).toBe('completed');
    expect(await progressOf(fs)).toEqual({ schemaVersion: SYNC_PROGRESS_SCHEMA_VERSION, completed: [key(A)] });
  });
  it('the step throws after the latch (an unexpected baseline body): the failure path still persists notBefore', async () => {
    const { fs, ports } = harness([A]);
    let latchedMs: number | undefined;
    const stamped: DatasetEntry = {
      entryKey: key(A),
      price: { state: 'not-yet-synced', reason: 'never-synced' },
      lastAttemptedAt: NOW,
    };
    const failure = new UnexpectedTradeResponseError(key(A), 'search', 'no top-level `id` and `result`', stamped);
    const step: ChunkStep = () => {
      latchedMs = 120_000;
      return Promise.reject(failure);
    };

    await expect(run({ ...ports, latchedRetryAfterMs: () => latchedMs }, step)).rejects.toBe(failure);

    expect(await progressOf(fs)).toEqual({
      schemaVersion: SYNC_PROGRESS_SCHEMA_VERSION,
      completed: [],
      notBefore: '2026-09-26T12:02:00.000Z',
    });
  });
});

const progressWith = (fields: Record<string, unknown>) => ({
  [PROGRESS_PATH]: { contents: JSON.stringify({ schemaVersion: '1.1.0', completed: [], ...fields }) },
});

describe('runChunk: the session-cookie hold-off (AD-30, IMPLEMENTATION-NOTES.md §13.1, §13.3, §13.4)', () => {
  const HOLD_OFF = '2026-09-27T06:00:00.000Z';
  const NOW_PLUS_24H = '2026-09-27T12:00:00.000Z';

  /** A recording stand-in for the holder's two narrow ports. */
  function fakeAuth(pending?: 'write' | 'clear') {
    const calls: string[] = [];
    let action = pending;
    const auth: NonNullable<ChunkPorts['auth']> = {
      settleHeldOffIfDue: (until, now) => {
        calls.push(`settle ${String(until)} ${now}`);
      },
      pendingHoldOff: () => action,
      holdOffApplied: (applied) => {
        calls.push(`applied ${applied}`);
        if (action === applied) {
          action = undefined;
        }
      },
    };
    return { auth, calls, pending: () => action };
  }

  it('reads a 1.1.0 progress file and writes the current version', async () => {
    const { fs, ports } = harness([A], progressWith({}));
    await run(ports, scriptedStep().step);
    expect(await progressOf(fs)).toEqual({ schemaVersion: SYNC_PROGRESS_SCHEMA_VERSION, completed: [key(A)] });
  });

  it('after the lock and the notBefore check, hands the loaded hold-off and now to the settle port', async () => {
    const { auth, calls } = fakeAuth();
    const { ports } = harness([A], progressWith({ authHoldOffUntil: HOLD_OFF }), { auth });
    await run(ports, scriptedStep().step);
    expect(calls[0]).toBe(`settle ${HOLD_OFF} ${NOW}`);
  });

  it('a deferred run settles nothing and applies no pending action', async () => {
    const { auth, calls, pending } = fakeAuth('write');
    const seeded = progressWith({ notBefore: '2026-09-26T13:00:00.000Z', authHoldOffUntil: HOLD_OFF });
    const { fs, ports } = harness([A], seeded, { auth });
    const outcome = await run(ports, scriptedStep().step);
    expect(outcome.kind).toBe('deferred');
    expect(calls).toEqual([]);
    expect(pending()).toBe('write');
    // Untouched: the seeded 1.1.0 bytes, not a rewrite.
    expect(await fs.readTextFile(PROGRESS_PATH)).toBe(seeded[PROGRESS_PATH].contents);
  });

  it('a failed progress write applies nothing: the pending write survives for the next write', async () => {
    const { auth, calls, pending } = fakeAuth('write');
    const { fs, ports } = harness([A], progressWith({}), { auth });
    const faulty = {
      ...fs,
      writeTextFile: (path: string, contents: string) =>
        path === PROGRESS_PATH ? Promise.reject(new Error(`disk full: ${path}`)) : fs.writeTextFile(path, contents),
    };

    await expect(run({ ...ports, fs: faulty }, scriptedStep().step)).rejects.toThrow(`disk full: ${PROGRESS_PATH}`);

    expect(calls.some((call) => call.startsWith('applied'))).toBe(false);
    expect(pending()).toBe('write');
  });

  it('a busy run applies no pending action', async () => {
    const { auth, calls, pending } = fakeAuth('write');
    const { ports } = harness([A], { [LOCK_PATH]: { contents: serialiseLock({ pid: 7, startedAt: FIVE_HOURS_AGO }) } }, { auth });
    const outcome = await run(ports, scriptedStep().step);
    expect(outcome.kind).toBe('busy');
    expect(calls).toEqual([]);
    expect(pending()).toBe('write');
  });

  it('a pending write sets authHoldOffUntil = now + 24h in the chunk’s progress write, and is applied', async () => {
    const { auth, calls, pending } = fakeAuth('write');
    const { fs, ports } = harness([A], progressWith({}), { auth });
    await run(ports, scriptedStep().step);
    expect(await progressOf(fs)).toEqual({
      schemaVersion: SYNC_PROGRESS_SCHEMA_VERSION,
      completed: [key(A)],
      authHoldOffUntil: NOW_PLUS_24H,
    });
    expect(calls).toContain('applied write');
    expect(pending()).toBeUndefined();
  });

  it('a pending clear removes the field', async () => {
    const { auth, pending } = fakeAuth('clear');
    const { fs, ports } = harness([A], progressWith({ authHoldOffUntil: HOLD_OFF }), { auth });
    await run(ports, scriptedStep().step);
    expect(await progressOf(fs)).toEqual({ schemaVersion: SYNC_PROGRESS_SCHEMA_VERSION, completed: [key(A)] });
    expect(pending()).toBeUndefined();
  });

  it.each([
    ['no auth port', undefined],
    ['no pending action', fakeAuth().auth],
  ])('%s: the loaded value is carried forward', async (_label, auth) => {
    const { fs, ports } = harness([A], progressWith({ authHoldOffUntil: HOLD_OFF }), auth === undefined ? {} : { auth });
    await run(ports, scriptedStep().step);
    expect(await progressOf(fs)).toEqual({ schemaVersion: SYNC_PROGRESS_SCHEMA_VERSION, completed: [key(A)], authHoldOffUntil: HOLD_OFF });
  });

  it('a session-expired step yield: yielded with the signal, the entry stamped, no notBefore, the hold-off written', async () => {
    const { auth } = fakeAuth('write');
    const { fs, ports } = harness([A, B], progressWith({}), { auth });
    const stamped: DatasetEntry = {
      entryKey: key(A),
      price: { state: 'not-yet-synced', reason: 'never-synced' },
      lastAttemptedAt: NOW,
    };
    const { visited, step } = scriptedStep(() => ({ kind: 'yielded', entry: stamped, sessionExpired: true }));

    const outcome = await run(ports, step);

    expect(outcome).toMatchObject({ kind: 'yielded', sessionExpired: true, completed: [] });
    expect(visited).toEqual([key(A)]);
    expect(await progressOf(fs)).toEqual({ schemaVersion: SYNC_PROGRESS_SCHEMA_VERSION, completed: [], authHoldOffUntil: NOW_PLUS_24H });
    const dataset = DatasetFileSchema.parse(JSON.parse((await fs.readTextFile(DATASET_PATH)) ?? ''));
    expect(dataset.entries.find((entry) => entry.entryKey === key(A))?.lastAttemptedAt).toBe(NOW);
  });

  it('an ordinary yield carries no session-expired signal', async () => {
    const { ports } = harness([A], progressWith({}));
    const outcome = await run(ports, scriptedStep(() => ({ kind: 'yielded' })).step);
    expect(outcome.kind === 'yielded' && outcome.sessionExpired).toBeUndefined();
  });

  it('the failure path applies the pending action in its progress write', async () => {
    const { auth, pending } = fakeAuth('write');
    const { fs, ports } = harness([A], progressWith({}), { auth });
    await expect(
      run(ports, () => Promise.reject(new Error('boom'))),
    ).rejects.toThrow('boom');
    expect(await progressOf(fs)).toMatchObject({ authHoldOffUntil: NOW_PLUS_24H });
    expect(pending()).toBeUndefined();
  });
});
