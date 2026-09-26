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
  SyncReportFileSchema,
} from '@poe/contracts';
import type {
  DatasetEntry,
  DatasetFile,
  FakeFilesystemPort,
  HttpPort,
  PinnedStarvationRecord,
  SyncReportFile,
  SyncRunRecord,
  TrackedEntry,
} from '@poe/contracts';
import { describe, expect, it } from 'vitest';

import type { CatalogueIds } from '../catalogue/catalogue-ids.ts';
import { WEIGHTS_PATH } from '../catalogue/weights-ids.ts';
import { DataFileError } from '../load-data-file.ts';
import { pinnedStarvationRecord } from '../pinned-cap.ts';
import { MalformedRequestError } from '../pricing/price-entry.ts';
import { createRequestCounter } from '../request-counter.ts';
import { InvalidArtifactError } from '../write-artifact.ts';
import { LOCK_PATH, serialiseLock } from './lock.ts';
import { DATASET_PATH, PROGRESS_PATH, REPORT_PATH, runChunk, TRACKED_PATH } from './run-chunk.ts';
import type { ChunkPorts, ChunkPublication, ChunkStep, StepResult } from './run-chunk.ts';

const NOW = '2026-09-26T12:00:00.000Z';
/** Five hours before NOW: a live lock. */
const FIVE_HOURS_AGO = '2026-09-26T07:00:00.000Z';
/** Seven hours before NOW: a stale lock. */
const SEVEN_HOURS_AGO = '2026-09-26T05:00:00.000Z';
const PID = 1000;
const PUBLICATION: ChunkPublication = { league: 'Standard', currencyRates: [] };

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

function trackedText(entries: readonly TrackedEntry[]): string {
  return JSON.stringify({ schemaVersion: '1.0.0', entries });
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
function shellPorts(): Pick<ChunkPorts, 'git' | 'requests' | 'starvationRecord' | 'catalogue'> {
  return {
    git: createFakeGitPort(),
    requests: createRequestCounter(),
    starvationRecord: (starvation) => pinnedStarvationRecord(starvation, { minChunkSearches: 10 }),
    catalogue: () => Promise.resolve({ ok: true, value: RESOLVES_ALL }),
  };
}

/** A present weights file with no ids: no weights record arises. */
const EMPTY_WEIGHTS = JSON.stringify({ schemaVersion: '6.0.0', bases: {} });

interface Harness {
  readonly fs: FakeFilesystemPort;
  readonly ports: ChunkPorts;
  readonly logs: string[];
}

function harness(
  entries: readonly TrackedEntry[] = [A, B, C, PRUNED],
  extra: Parameters<typeof createFakeFilesystemPort>[0] = {},
  overrides: Partial<ChunkPorts> = {},
): Harness {
  const fs = createFakeFilesystemPort({
    [TRACKED_PATH]: { contents: trackedText(entries) },
    [WEIGHTS_PATH]: { contents: EMPTY_WEIGHTS },
    ...extra,
  });
  const logs: string[] = [];
  const { publication = PUBLICATION, ...rest } = overrides;
  const ports: ChunkPorts = {
    fs,
    clock: createFakeClockPort(NOW),
    pid: PID,
    ...shellPorts(),
    log: (line) => logs.push(line),
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

describe('runChunk: the three bounds and the yield', () => {
  it('workload bound: completes every non-pruned entry, writes progress, releases the lock', async () => {
    const { fs, ports } = harness();
    const { visited, step } = scriptedStep(() => ({
      kind: 'completed',
      searchRemaining: 10,
      fetchRemaining: 10,
    }));

    const outcome = await runChunk(ports, step);

    expect(outcome).toEqual({ kind: 'completed', completed: [key(A), key(B), key(C)], entries: [], records: [] });
    expect(visited).toEqual([key(A), key(B), key(C)]);
    expect(await progressOf(fs)).toEqual({
      schemaVersion: '1.0.0',
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

    const outcome = await runChunk(ports, step);

    expect(outcome).toMatchObject({ kind: 'bounded', bound: 'search', completed: [key(A), key(B)] });
    expect(visited).not.toContain(key(C));
    expect(await progressOf(fs)).toEqual({ schemaVersion: '1.0.0', completed: [key(A), key(B)] });
    expect(await fs.exists(LOCK_PATH)).toBe(false);
  });

  it('fetch bound: stops after the entry whose fetch allowance fell below 1', async () => {
    const { ports } = harness();
    const { visited, step } = scriptedStep((entry) => ({
      kind: 'completed',
      searchRemaining: 5,
      fetchRemaining: key(entry) === key(A) ? 0 : 5,
    }));

    const outcome = await runChunk(ports, step);

    expect(outcome).toMatchObject({ kind: 'bounded', bound: 'fetch', completed: [key(A)] });
    expect(visited).toEqual([key(A)]);
  });

  it('an allowance below 1 on the last entry is completed, not bounded: no work is left', async () => {
    const { fs, ports } = harness([A, B]);
    const { step } = scriptedStep((entry) => ({
      kind: 'completed',
      searchRemaining: key(entry) === key(B) ? 0 : 5,
    }));

    const outcome = await runChunk(ports, step);

    expect(outcome).toEqual({ kind: 'completed', completed: [key(A), key(B)], entries: [], records: [] });
    expect(await progressOf(fs)).toEqual({ schemaVersion: '1.0.0', completed: [key(A), key(B)] });
  });

  it('an allowance of exactly 1 does not bound', async () => {
    const { ports } = harness();
    const { visited, step } = scriptedStep(() => ({
      kind: 'completed',
      searchRemaining: 1,
      fetchRemaining: 1,
    }));

    const outcome = await runChunk(ports, step);

    expect(outcome.kind).toBe('completed');
    expect(visited).toEqual([key(A), key(B), key(C)]);
  });

  it('an absent allowance bounds nothing, because nothing was observed', async () => {
    const { ports } = harness();
    const outcome = await runChunk(ports, scriptedStep().step);
    expect(outcome.kind).toBe('completed');
    expect(outcome.completed).toHaveLength(3);
  });

  it('yield: the yielded entry is not completed, and the outcome is a value, not a throw', async () => {
    const { fs, ports } = harness();
    const { visited, step } = scriptedStep((entry) =>
      key(entry) === key(B) ? { kind: 'yielded' } : { kind: 'completed' },
    );

    const outcome = await runChunk(ports, step);

    expect(outcome).toEqual({ kind: 'yielded', completed: [key(A)], entries: [], records: [] });
    expect(visited).toEqual([key(A), key(B)]);
    expect(await progressOf(fs)).toEqual({ schemaVersion: '1.0.0', completed: [key(A)] });
    expect(await fs.exists(LOCK_PATH)).toBe(false);
  });

  it('never visits a pruned entry', async () => {
    const { ports } = harness();
    const { visited, step } = scriptedStep();
    await runChunk(ports, step);
    expect(visited).not.toContain(key(PRUNED));
  });

  it('treats an absent tracked list as an empty workload', async () => {
    const fs = createFakeFilesystemPort();
    const { visited, step } = scriptedStep();

    const outcome = await runChunk(
      { fs, clock: createFakeClockPort(NOW), pid: PID, ...shellPorts(), publication: PUBLICATION },
      step,
    );

    expect(outcome).toEqual({ kind: 'completed', completed: [], entries: [], records: [] });
    expect(visited).toEqual([]);
    expect(await fs.exists(LOCK_PATH)).toBe(false);
  });
});

describe('runChunk: the step entries', () => {
  function entryOf(tracked: TrackedEntry, state: 'no-listings' | 'never-synced'): DatasetEntry {
    return {
      entryKey: key(tracked),
      price:
        state === 'no-listings'
          ? { state: 'no-listings' }
          : { state: 'not-yet-synced', reason: 'never-synced' },
      lastAttemptedAt: NOW,
    };
  }

  it('collects completed and yielded entries on the outcome, in visiting order', async () => {
    const { ports } = harness();
    const { step } = scriptedStep((entry) =>
      key(entry) === key(B)
        ? { kind: 'yielded', entry: entryOf(entry, 'never-synced') }
        : { kind: 'completed', entry: entryOf(entry, 'no-listings') },
    );

    const outcome = await runChunk(ports, step);

    expect(outcome.kind).toBe('yielded');
    expect(outcome.completed).toEqual([key(A)]);
    expect(outcome.entries).toEqual([entryOf(A, 'no-listings'), entryOf(B, 'never-synced')]);
  });

  it('a step that returns no entry adds nothing', async () => {
    const { ports } = harness();
    const outcome = await runChunk(ports, scriptedStep().step);
    expect(outcome.entries).toEqual([]);
  });
});

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

  function noListings(tracked: TrackedEntry, at = NOW): DatasetEntry {
    return { entryKey: key(tracked), price: { state: 'no-listings' }, lastAttemptedAt: at };
  }

  function neverSynced(tracked: TrackedEntry): DatasetEntry {
    return { entryKey: key(tracked), price: { state: 'not-yet-synced', reason: 'never-synced' } };
  }

  function previousFile(entries: readonly DatasetEntry[]): string {
    return `${JSON.stringify(
      { schemaVersion: '1.0.0', league: 'Old League', generatedAt: SEVEN_HOURS_AGO, entries, currencyRates: [] },
      null,
      2,
    )}\n`;
  }

  async function datasetOf(fs: FakeFilesystemPort): Promise<DatasetFile | undefined> {
    const text = await fs.readTextFile(DATASET_PATH);
    return text === undefined ? undefined : DatasetFileSchema.parse(JSON.parse(text));
  }

  it('completed: one entry per tracked entry, pruned included, sorted, with the passed-in league and rates', async () => {
    const { fs, ports } = harness([C, A, B, PRUNED], {}, { publication: PUBLISHING });
    const step = scriptedStep((entry) =>
      key(entry) === key(B) ? { kind: 'completed', entry: noListings(entry) } : { kind: 'completed' },
    ).step;

    expect((await runChunk(ports, step)).kind).toBe('completed');

    const expectedKeys = [key(A), key(B), key(C), key(PRUNED)].toSorted(compareCanonicalKeys);
    expect(await datasetOf(fs)).toEqual({
      schemaVersion: '1.0.0',
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
    await runChunk(ports, scriptedStep().step);

    const text = (await fs.readTextFile(DATASET_PATH)) ?? '';
    expect(text.charCodeAt(0)).not.toBe(0xfeff);
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

    const outcome = await runChunk(ports, step);

    expect(outcome.kind).toBe('bounded');
    const written = (await fs.readTextFile(DATASET_PATH)) ?? '';
    const block = (entry: DatasetEntry): string =>
      JSON.stringify(entry, null, 2).split('\n').map((line) => `    ${line}`).join('\n');
    expect(previous).toContain(block(carried));
    expect(written).toContain(block(carried));
    expect((await datasetOf(fs))?.entries.map((entry) => entry.entryKey)).toEqual(
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
    await runChunk(ports, scriptedStep(() => ({ kind: 'completed', searchRemaining: 0 })).step);

    expect(await datasetOf(fs)).toMatchObject({ league: 'New League', entries: [priced] });
  });

  it('pruned: keeps its previous entry, or is never-synced', async () => {
    const PRUNED_TOO = raw('Q', 'pruned');
    const kept = noListings(PRUNED, SEVEN_HOURS_AGO);
    const { fs, ports } = harness([PRUNED, PRUNED_TOO], { [DATASET_PATH]: { contents: previousFile([kept]) } });

    await runChunk(ports, scriptedStep().step);

    expect((await datasetOf(fs))?.entries).toEqual(
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

    const outcome = await runChunk(ports, scriptedStep(() => ({ kind: 'yielded', entry: stamped })).step);

    expect(outcome.kind).toBe('yielded');
    expect((await datasetOf(fs))?.entries).toEqual([stamped]);
  });

  it('re-serialise: the same inputs write byte-identical files', async () => {
    const texts: (string | undefined)[] = [];
    for (let run = 0; run < 2; run += 1) {
      const { fs, ports } = harness(undefined, {}, { publication: PUBLISHING });
      await runChunk(ports, scriptedStep((entry) => ({ kind: 'completed', entry: noListings(entry) })).step);
      texts.push(await fs.readTextFile(DATASET_PATH));
    }
    expect(texts[0]).toBeDefined();
    expect(texts[1]).toBe(texts[0]);
  });

  it('busy: writes no dataset', async () => {
    const held = serialiseLock({ pid: 7, startedAt: FIVE_HOURS_AGO });
    const { fs, ports } = harness(undefined, { [LOCK_PATH]: { contents: held } });
    expect((await runChunk(ports, scriptedStep().step)).kind).toBe('busy');
    expect(await fs.exists(DATASET_PATH)).toBe(false);
  });

  it('dispossessed: writes no dataset', async () => {
    const { fs, ports } = harness();
    const outcome = await runChunk(ports, (entry) => {
      fs.setFile(LOCK_PATH, { contents: serialiseLock({ pid: 99, startedAt: NOW }) });
      return Promise.resolve({ kind: 'completed', entry: noListings(entry) });
    });
    expect(outcome.kind).toBe('dispossessed');
    expect(await fs.exists(DATASET_PATH)).toBe(false);
  });

  it('a step throw writes no dataset', async () => {
    const { fs, ports } = harness();
    await expect(
      runChunk(ports, (entry) =>
        key(entry) === key(B)
          ? Promise.reject(new Error('step exploded'))
          : Promise.resolve({ kind: 'completed', entry: noListings(entry) }),
      ),
    ).rejects.toThrow('step exploded');
    expect(await fs.exists(DATASET_PATH)).toBe(false);
  });

  it('an invalid artifact is refused: InvalidArtifactError, the file untouched, no progress, lock released', async () => {
    const previous = previousFile([noListings(A, SEVEN_HOURS_AGO)]);
    const { fs, ports } = harness([A], { [DATASET_PATH]: { contents: previous } });
    const invalid = { ...noListings(A), lastAttemptedAt: 'not a timestamp' };

    const failure = runChunk(ports, scriptedStep(() => ({ kind: 'completed', entry: invalid })).step);

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

    const outcome = await runChunk(ports, step);

    expect(visited).toEqual([key(B), key(C)]);
    expect(outcome.completed).toEqual([key(B), key(C)]);
    expect(await progressOf(fs)).toEqual({
      schemaVersion: '1.0.0',
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

    await runChunk(ports, step);

    expect(visited).toEqual([key(A)]);
    // The earlier pass's B and C are gone: only this pass's work is recorded.
    expect(await progressOf(fs)).toEqual({ schemaVersion: '1.0.0', completed: [key(A)] });
  });

  it('records completed entries only, never the planned ones', async () => {
    const { fs, ports } = harness();
    await runChunk(ports, scriptedStep(() => ({ kind: 'yielded' })).step);
    expect(await progressOf(fs)).toEqual({ schemaVersion: '1.0.0', completed: [] });
  });

  it('refuses a progress file of an unknown major and still releases the lock', async () => {
    const { fs, ports } = harness(undefined, {
      [PROGRESS_PATH]: { contents: JSON.stringify({ schemaVersion: '2.0.0', completed: [] }) },
    });
    await expect(runChunk(ports, scriptedStep().step)).rejects.toThrow(/2\.0\.0/);
    expect(await fs.exists(LOCK_PATH)).toBe(false);
  });

  it('serialises progress through writeArtifact: the schema’s key order, LF, one trailing newline', async () => {
    const { fs, ports } = harness([A]);
    await runChunk(ports, scriptedStep().step);
    // `SyncProgressFileSchema` extends the progress shape with `schemaVersion`,
    // so the declared order puts it last.
    expect(await fs.readTextFile(PROGRESS_PATH)).toBe(
      `{\n  "completed": [\n    ${JSON.stringify(key(A))}\n  ],\n  "schemaVersion": "1.0.0"\n}\n`,
    );
  });
});

describe('runChunk: the lock', () => {
  it('takes the lock as exactly {pid, startedAt} from the clock', async () => {
    const { fs, ports } = harness();
    let seen: string | undefined;
    await runChunk(ports, async () => {
      seen = await fs.readTextFile(LOCK_PATH);
      return { kind: 'completed' };
    });
    expect(seen).toBe(serialiseLock({ pid: PID, startedAt: NOW }));
    expect(JSON.parse(seen ?? '')).toEqual({ pid: PID, startedAt: NOW });
  });

  it('busy lock: writes nothing, leaves the lock untouched, logs one line', async () => {
    const held = serialiseLock({ pid: 7, startedAt: FIVE_HOURS_AGO });
    const { fs, ports, logs } = harness(undefined, { [LOCK_PATH]: { contents: held } });
    const { visited, step } = scriptedStep();

    const outcome = await runChunk(ports, step);

    expect(outcome).toEqual({ kind: 'busy', completed: [], entries: [], records: [] });
    expect(visited).toEqual([]);
    expect(await fs.readTextFile(LOCK_PATH)).toBe(held);
    expect(await fs.exists(PROGRESS_PATH)).toBe(false);
    expect(logs).toHaveLength(1);
    expect(logs[0]).toContain('pid 7');
  });

  it('treats a lock exactly at the threshold as live: staleness is strictly greater', async () => {
    const held = serialiseLock({ pid: 7, startedAt: '2026-09-26T06:00:00.000Z' });
    const { ports } = harness(undefined, { [LOCK_PATH]: { contents: held } });
    expect((await runChunk(ports, scriptedStep().step)).kind).toBe('busy');
  });

  it('judges staleness by time, never by pid: its own pid in a live lock is still busy', async () => {
    const held = serialiseLock({ pid: PID, startedAt: FIVE_HOURS_AGO });
    const { ports } = harness(undefined, { [LOCK_PATH]: { contents: held } });
    expect((await runChunk(ports, scriptedStep().step)).kind).toBe('busy');
  });

  it('stale lock: breaks and retakes it, runs the chunk, records the old pid and startedAt', async () => {
    const stale = serialiseLock({ pid: 7, startedAt: SEVEN_HOURS_AGO });
    const { fs, ports } = harness(undefined, { [LOCK_PATH]: { contents: stale } });
    let during: string | undefined;

    const outcome = await runChunk(ports, async () => {
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
    const logs: string[] = [];
    const first = scriptedStep();
    const second = scriptedStep();

    const outcomes = await Promise.all([
      runChunk({ fs, clock, pid: 1, ...shellPorts(), publication: PUBLICATION, log: (line) => logs.push(line) }, first.step),
      runChunk({ fs, clock, pid: 2, ...shellPorts(), publication: PUBLICATION, log: (line) => logs.push(line) }, second.step),
    ]);

    const kinds = outcomes.map((outcome) => outcome.kind).toSorted();
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
        runChunk(
          { fs, clock, pid, ...shellPorts(), publication: PUBLICATION, log: () => undefined },
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

    const outcome = await runChunk(ports, (entry) => {
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
      runChunk(ports, (entry) =>
        key(entry) === key(B) ? Promise.reject(failure) : Promise.resolve({ kind: 'completed' }),
      ),
    ).rejects.toBe(failure);

    expect(await fs.exists(LOCK_PATH)).toBe(false);
    expect(await fs.exists(PROGRESS_PATH)).toBe(false);
  });

  it('a MalformedRequestError from the step releases the lock and is rethrown', async () => {
    const { fs, ports } = harness();
    const failure = new MalformedRequestError(key(B), 'search', 400, {
      entryKey: key(B),
      price: { state: 'not-yet-synced', reason: 'never-synced' },
      lastAttemptedAt: NOW,
    });

    await expect(
      runChunk(ports, (entry) =>
        key(entry) === key(B) ? Promise.reject(failure) : Promise.resolve({ kind: 'completed' }),
      ),
    ).rejects.toBe(failure);

    expect(await fs.exists(LOCK_PATH)).toBe(false);
  });

  it('a throw from the gate releases the lock, is rethrown, and no step runs', async () => {
    const failure = new Error('gate refused');
    const { fs, ports } = harness(undefined, {}, { gate: () => Promise.reject(failure) });
    const { visited, step } = scriptedStep();

    await expect(runChunk(ports, step)).rejects.toBe(failure);

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
      },
    });

    await runChunk(ports, () => {
      order.push('step');
      return Promise.resolve({ kind: 'completed' });
    });

    expect(order).toEqual(['gate:1', 'step']);
    expect(lockDuringGate).toBe(true);
  });

  it('an invalid tracked list throws and still releases the lock', async () => {
    const fs = createFakeFilesystemPort({ [TRACKED_PATH]: { contents: '{not json' } });
    await expect(
      runChunk(
        { fs, clock: createFakeClockPort(NOW), pid: PID, ...shellPorts(), publication: PUBLICATION },
        scriptedStep().step,
      ),
    ).rejects.toThrow(/tracked\.json/);
    expect(await fs.exists(LOCK_PATH)).toBe(false);
  });
});

function datasetText(entries: readonly { key: string; at?: string; unresolvable?: boolean }[]): string {
  return JSON.stringify({
    schemaVersion: '1.0.0',
    league: 'Standard',
    generatedAt: NOW,
    entries: entries.map(({ key: entryKey, at, unresolvable }) => ({
      entryKey,
      price: { state: unresolvable === true ? 'unresolvable' : 'no-listings' },
      ...(at === undefined ? {} : { lastAttemptedAt: at }),
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

    await runChunk(ports, step);

    // C never attempted, then U, B, A oldest first. U's id resolves again, so
    // it is recovered into row 2 rather than waiting in row 3 (AD-7).
    expect(visited).toEqual([key(C), key(U), key(B), key(A)]);
    expect(await progressOf(fs)).toEqual({
      schemaVersion: '1.0.0',
      completed: [key(A), key(B), key(C), key(U)],
    });
  });

  it('an invalid dataset throws and still releases the lock', async () => {
    const { fs, ports } = harness(undefined, { [DATASET_PATH]: { contents: '{"schemaVersion":"2.0.0"}' } });
    await expect(runChunk(ports, scriptedStep().step)).rejects.toThrow(/dataset\.json/);
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

    const outcome = await runChunk(ports, step);

    expect(visited).toEqual([key(P1), key(P2), key(A), key(B)]);
    expect(outcome).toEqual({
      kind: 'completed',
      completed: [key(P1), key(P2), key(A), key(B)],
      entries: [],
      records: [],
      pinnedStarvation: { discoveredAllowance: 3, pinnedCount: 3, pinnedRefreshed: 2, activeRefreshed: 2 },
    });
    // Row 1 is exempt from the pass.
    expect(await progressOf(fs)).toEqual({ schemaVersion: '1.0.0', completed: [key(A), key(B)] });
  });

  it('starvation leaves the outcome kind unchanged: the reserved search still bounds the chunk', async () => {
    const { ports } = harness([P1, P2, P3, A, B]);
    let remaining = 3;
    const { visited, step } = scriptedStep(() => {
      remaining -= 1;
      return { kind: 'completed', searchRemaining: remaining };
    });

    const outcome = await runChunk(ports, step);

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

    const outcome = await runChunk(ports, step);

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

    const outcome = await runChunk(ports, step);

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
      entry.status === 'pinned'
        ? { kind: 'completed', searchRemaining: 5 }
        : { kind: 'completed', searchRemaining: 0 },
    );

    const outcome = await runChunk(ports, step);

    expect(visited).toEqual([key(P1), key(A)]);
    expect(outcome).toEqual({ kind: 'bounded', bound: 'search', completed: [key(P1), key(A)], entries: [], records: [] });
  });

  it('a yield in row 1 after a cut: kind yielded, the record still carried', async () => {
    const { fs, ports } = harness([P1, P2, P3, A, B]);
    const { visited, step } = scriptedStep((entry) =>
      key(entry) === key(P1) ? { kind: 'completed', searchRemaining: 2 } : { kind: 'yielded' },
    );

    const outcome = await runChunk(ports, step);

    expect(visited).toEqual([key(P1), key(P2)]);
    expect(outcome).toEqual({
      kind: 'yielded',
      completed: [key(P1)],
      entries: [],
      records: [],
      pinnedStarvation: { discoveredAllowance: 3, pinnedCount: 3, pinnedRefreshed: 1, activeRefreshed: 0 },
    });
    expect(await progressOf(fs)).toEqual({ schemaVersion: '1.0.0', completed: [] });
  });

  it('a recovered pinned + unresolvable entry rejoins row 1, exempt from the pass', async () => {
    const PU = raw('PU', 'pinned');
    const { fs, ports } = harness([PU, A], {
      [DATASET_PATH]: {
        contents: datasetText([{ key: key(PU), at: '2026-09-25T11:00:00.000Z', unresolvable: true }]),
      },
    });
    const { visited, step } = scriptedStep();

    await runChunk(ports, step);

    expect(visited).toEqual([key(PU), key(A)]);
    expect(await progressOf(fs)).toEqual({ schemaVersion: '1.0.0', completed: [key(A)] });
  });

  it('no rotation waiting: 3 pinned alone with R=1 are all visited, with no record', async () => {
    const { ports } = harness([P1, P2, P3, PRUNED]);
    const { visited, step } = scriptedStep(() => ({ kind: 'completed', searchRemaining: 1 }));

    const outcome = await runChunk(ports, step);

    expect(visited).toEqual([key(P1), key(P2), key(P3)]);
    expect(outcome).toEqual({ kind: 'completed', completed: visited, entries: [], records: [] });
    expect(outcome.pinnedStarvation).toBeUndefined();
  });

  it('no truncation when the allowance covers the pinned set plus one', async () => {
    const { ports } = harness([P1, P2, A]);
    const { visited, step } = scriptedStep(() => ({ kind: 'completed', searchRemaining: 5 }));
    const outcome = await runChunk(ports, step);
    expect(visited).toEqual([key(P1), key(P2), key(A)]);
    expect(outcome.pinnedStarvation).toBeUndefined();
  });

  it('pinned every chunk: a pinned key in progress is still visited first, and never written', async () => {
    const { fs, ports } = harness([P1, A, B], {
      [PROGRESS_PATH]: { contents: progressText([key(P1), key(A)]) },
    });
    const { visited, step } = scriptedStep();

    await runChunk(ports, step);

    expect(visited).toEqual([key(P1), key(B)]);
    expect(await progressOf(fs)).toEqual({ schemaVersion: '1.0.0', completed: [key(A), key(B)] });
  });
});

describe('runChunk: the declared yardstick is never a chunk bound', () => {
  it('runs an identical chunk whatever the player config declares, and never reads it', async () => {
    const outcomes = [];
    for (const declared of [1, 3, 1000]) {
      const { fs, ports } = harness(undefined, {
        'data/config.json': {
          contents: JSON.stringify({ schemaVersion: '1.0.0', league: 'L', minChunkSearches: declared }),
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
      outcomes.push(await runChunk({ ...ports, fs: reading }, scriptedStep().step));
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

describe('runChunk: the Sync Report', () => {
  const D = raw('D');
  const E = raw('E');
  const P1 = raw('P1', 'pinned');
  const P2 = raw('P2', 'pinned');
  const P3 = raw('P3', 'pinned');
  const ZERO = { 'tracked-list': 0, 'league-validation': 0, 'catalogue-refresh': 0 };
  const STARVED: PinnedStarvationRecord = {
    kind: 'pinned-starvation',
    discoveredAllowance: 3,
    declaredMinChunkSearches: 10,
    pinnedCount: 3,
    pinnedRefreshed: 2,
    activeRefreshed: 2,
  };
  const BROKEN: SyncRunRecord = { kind: 'stale-lock-broken', pid: 7, startedAt: SEVEN_HOURS_AGO };

  async function reportOf(fs: FakeFilesystemPort): Promise<SyncReportFile | undefined> {
    const text = await fs.readTextFile(REPORT_PATH);
    return text === undefined ? undefined : SyncReportFileSchema.parse(JSON.parse(text));
  }

  function reportText(records: readonly SyncRunRecord[], schemaVersion = '1.0.0'): string {
    return JSON.stringify({
      runStartedAt: SEVEN_HOURS_AGO,
      runFinishedAt: SEVEN_HOURS_AGO,
      figures: { requestsBySource: { ...ZERO, 'tracked-list': 40 }, notReachedCount: 9 },
      records,
      schemaVersion,
    });
  }

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

    await runChunk(ports, async () => {
      await http.send({ method: 'POST', url: SEARCH_URL, headers: {} });
      await http.send({ method: 'GET', url: FETCH_URL, headers: {} });
      return { kind: 'completed' };
    });

    expect(await reportOf(fs)).toEqual({
      runStartedAt: NOW,
      runFinishedAt: NOW,
      figures: { requestsBySource: { ...ZERO, 'tracked-list': 6 }, notReachedCount: 0 },
      records: [],
      schemaVersion: '1.0.0',
    });
  });

  it('counts only the requests sent after the lock was taken', async () => {
    const requests = createRequestCounter();
    const http = countedHttp(requests);
    await http.send({ method: 'GET', url: FETCH_URL, headers: {} });
    const { fs, ports } = harness([A], {}, { requests });

    await runChunk(ports, async () => {
      await http.send({ method: 'POST', url: SEARCH_URL, headers: {} });
      return { kind: 'completed' };
    });

    expect((await reportOf(fs))?.figures.requestsBySource).toEqual({ ...ZERO, 'tracked-list': 1 });
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

    await runChunk({ ...ports, fs: recording }, scriptedStep().step);

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

    await runChunk(ports, scriptedStep().step);

    const report = await reportOf(fs);
    expect(report?.records).toEqual([BROKEN]);
    expect(report?.figures).toEqual({ requestsBySource: ZERO, notReachedCount: 0 });
  });

  it('player cleared: a previous report with no records keeps only this chunk’s new records', async () => {
    const { fs, ports } = harness([A], {
      [REPORT_PATH]: { contents: reportText([]) },
      [LOCK_PATH]: { contents: serialiseLock({ pid: 7, startedAt: SEVEN_HOURS_AGO }) },
    });

    await runChunk(ports, scriptedStep().step);

    expect((await reportOf(fs))?.records).toEqual([BROKEN]);
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

    await runChunk(ports, starvingStep());
    expect((await reportOf(fs))?.records).toEqual([STARVED]);
    await runChunk(ports, starvingStep());
    expect((await reportOf(fs))?.records).toEqual([STARVED]);
  });

  it('not reached: 5 eligible, bounded after 2, reports 3', async () => {
    const { fs, ports } = harness([A, B, C, D, E]);
    let remaining = 2;
    const outcome = await runChunk(
      ports,
      scriptedStep(() => {
        remaining -= 1;
        return { kind: 'completed', searchRemaining: remaining };
      }).step,
    );
    expect(outcome).toMatchObject({ kind: 'bounded', completed: [key(A), key(B)] });
    expect((await reportOf(fs))?.figures.notReachedCount).toBe(3);
  });

  it('not reached: a yielded entry was attempted, so it is not counted', async () => {
    const { fs, ports } = harness([A, B, C]);
    await runChunk(
      ports,
      scriptedStep((entry) => (key(entry) === key(B) ? { kind: 'yielded' } : { kind: 'completed' })).step,
    );
    expect((await reportOf(fs))?.figures.notReachedCount).toBe(1);
  });

  it('not reached: a pinned entry cut by the cap counts', async () => {
    const { fs, ports } = harness([P1, P2, P3, A, B]);
    await runChunk(ports, starvingStep());
    // Five in rows 1–3, four attempted: P3 was cut.
    expect((await reportOf(fs))?.figures.notReachedCount).toBe(1);
  });

  it('excluded: a pruned entry and an entry the catalogue check marked never count', async () => {
    const U = raw('U');
    const { fs, ports } = harness([A, B, PRUNED, U], {}, {
      catalogue: () => Promise.resolve({ ok: true, value: catalogueWithout('U') }),
    });
    const { visited, step } = scriptedStep(() => ({ kind: 'completed', searchRemaining: 0 }));

    await runChunk(ports, step);

    expect(visited).toHaveLength(1);
    // A and B are eligible, one attempted.
    expect((await reportOf(fs))?.figures.notReachedCount).toBe(1);
  });

  it.each([
    ['committed', { [TRACKED_PATH]: SEVEN_HOURS_AGO }, FIVE_HOURS_AGO, { source: 'git-author-date', at: SEVEN_HOURS_AGO }],
    ['uncommitted-only', {}, FIVE_HOURS_AGO, { source: 'file-modified', at: FIVE_HOURS_AGO }],
    ['neither', {}, undefined, undefined],
  ] as const)('edit date: %s', async (_name, commits, modifiedAt, expected) => {
    const { fs, ports } = harness([A], {}, { git: createFakeGitPort(commits) });
    fs.setFile(TRACKED_PATH, {
      contents: trackedText([A]),
      ...(modifiedAt === undefined ? {} : { modifiedAt }),
    });

    await runChunk(ports, scriptedStep().step);

    const figures = (await reportOf(fs))?.figures;
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
    const done = (entry: TrackedEntry): DatasetEntry => ({
      entryKey: key(entry),
      price: { state: 'no-listings' },
      lastAttemptedAt: NOW,
    });

    await expect(
      runChunk(ports, (entry) =>
        key(entry) === key(C)
          ? Promise.reject(failure)
          : Promise.resolve({ kind: 'completed', entry: done(entry) }),
      ),
    ).rejects.toBe(failure);

    const dataset = DatasetFileSchema.parse(JSON.parse((await fs.readTextFile(DATASET_PATH)) ?? ''));
    const byKey = new Map(dataset.entries.map((entry) => [entry.entryKey, entry]));
    expect(byKey.get(key(A))).toEqual(done(A));
    expect(byKey.get(key(B))).toEqual(done(B));
    expect(byKey.get(key(C))).toEqual(stamped);
    expect(byKey.get(key(D))).toEqual({
      entryKey: key(D),
      price: { state: 'not-yet-synced', reason: 'never-synced' },
    });
    expect(await progressOf(fs)).toEqual({ schemaVersion: '1.0.0', completed: [key(A), key(B)] });

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
      schemaVersion: '1.0.0',
    });
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
      runChunk({ ...ports, fs: faulty }, (entry) =>
        key(entry) === key(B) ? Promise.reject(failure) : Promise.resolve({ kind: 'completed' }),
      ),
    ).rejects.toBe(failure);

    expect(logs.some((line) => line.includes(`disk full: ${failing}`))).toBe(true);
    // A failed publication does not stop the report.
    if (failing === PROGRESS_PATH) {
      expect((await reportOf(fs))?.records).toEqual([
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

    await expect(runChunk({ ...ports, git: flaky }, scriptedStep().step)).rejects.toThrow('git broke');

    expect((await reportOf(fs))?.records).toEqual([
      { kind: 'run-failure', reason: 'unrecoverable-error', message: 'git broke' },
    ]);
  });

  it('other throw: an unrecoverable-error record naming the entry, and no dataset or progress write', async () => {
    const { fs, ports } = harness([A, B, C]);
    const failure = new Error('step exploded');

    await expect(
      runChunk(ports, (entry) =>
        key(entry) === key(B) ? Promise.reject(failure) : Promise.resolve({ kind: 'completed' }),
      ),
    ).rejects.toBe(failure);

    expect(await fs.exists(DATASET_PATH)).toBe(false);
    expect(await fs.exists(PROGRESS_PATH)).toBe(false);
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

    await expect(runChunk(ports, scriptedStep().step)).rejects.toBe(failure);

    expect((await reportOf(fs))?.records).toEqual([
      { kind: 'run-failure', reason: 'unrecoverable-error', message: 'gate refused' },
    ]);
    expect(await fs.exists(DATASET_PATH)).toBe(false);
  });

  it('a failure record follows the records carried from the previous report', async () => {
    const { fs, ports } = harness([A], { [REPORT_PATH]: { contents: reportText([BROKEN]) } });

    await expect(runChunk(ports, () => Promise.reject(new Error('boom')))).rejects.toThrow('boom');

    expect((await reportOf(fs))?.records).toEqual([
      BROKEN,
      { kind: 'run-failure', reason: 'unrecoverable-error', entryKey: key(A), message: 'boom' },
    ]);
  });

  it('busy: no report write', async () => {
    const { fs, ports } = harness([A], {
      [LOCK_PATH]: { contents: serialiseLock({ pid: 99, startedAt: FIVE_HOURS_AGO }) },
    });
    expect((await runChunk(ports, scriptedStep().step)).kind).toBe('busy');
    expect(await fs.exists(REPORT_PATH)).toBe(false);
  });

  it('dispossessed: no report write, on a normal finish or on a throw', async () => {
    for (const throws of [false, true]) {
      const { fs, ports } = harness([A, B]);
      const successor = serialiseLock({ pid: 99, startedAt: NOW });
      const run = runChunk(ports, (entry) => {
        fs.setFile(LOCK_PATH, { contents: successor });
        return throws && key(entry) === key(B)
          ? Promise.reject(new Error('late'))
          : Promise.resolve({ kind: 'completed' });
      });
      if (throws) {
        await expect(run).rejects.toThrow('late');
      } else {
        expect((await run).kind).toBe('dispossessed');
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

    await expect(runChunk(ports, step)).rejects.toThrow(/sync-report\.json.*9\.0\.0/);

    expect(visited).toEqual([]);
    expect(await fs.readTextFile(REPORT_PATH)).toBe(previous);
    expect(await fs.exists(DATASET_PATH)).toBe(false);
    expect(await fs.exists(PROGRESS_PATH)).toBe(false);
    expect(await fs.exists(LOCK_PATH)).toBe(false);
  });
});

describe('runChunk: unresolvable ids, detected offline (Story 1.10)', () => {
  const STAT_GONE = 'explicit.gone';

  function craftedEntry(
    categoryId: string,
    prefix: string,
    className = 'Bows',
    status: TrackedEntry['status'] = 'active',
  ): TrackedEntry {
    const base = { kind: 'crafted', categoryId, className, itemLevelMin: 75, prefix: { kind: 'valueless', statId: prefix } } as const;
    return status === 'pruned' ? { ...base, status, prunedReason: 'no market' } : { ...base, status };
  }

  const withCatalogue = (...missing: string[]): Partial<ChunkPorts> => ({
    catalogue: () => Promise.resolve({ ok: true, value: catalogueWithout(...missing) }),
  });

  async function reportOf(fs: FakeFilesystemPort): Promise<SyncReportFile | undefined> {
    const text = await fs.readTextFile(REPORT_PATH);
    return text === undefined ? undefined : SyncReportFileSchema.parse(JSON.parse(text));
  }

  async function publishedOf(fs: FakeFilesystemPort, entry: TrackedEntry): Promise<DatasetEntry | undefined> {
    const text = await fs.readTextFile(DATASET_PATH);
    const file = text === undefined ? undefined : DatasetFileSchema.parse(JSON.parse(text));
    return file?.entries.find((published) => published.entryKey === key(entry));
  }

  const noListingsOf = (entry: TrackedEntry): DatasetEntry => ({
    entryKey: key(entry),
    price: { state: 'no-listings' },
    lastAttemptedAt: NOW,
  });

  it('unknown stat: marked unresolvable and recorded, never searched, and the others are priced', async () => {
    const X = craftedEntry('weapon.bow', STAT_GONE);
    const { fs, ports } = harness([A, X, B], {}, withCatalogue(STAT_GONE));
    const { visited, step } = scriptedStep((entry) => ({ kind: 'completed', entry: noListingsOf(entry) }));

    const outcome = await runChunk(ports, step);

    expect(outcome.kind).toBe('completed');
    expect(visited).toEqual([key(A), key(B)]);
    expect(await publishedOf(fs, X)).toEqual({ entryKey: key(X), price: { state: 'unresolvable' } });
    expect(await publishedOf(fs, A)).toEqual(noListingsOf(A));
    expect((await reportOf(fs))?.records).toEqual([
      { kind: 'unresolvable', entryKey: key(X), identifier: STAT_GONE, identifierKind: 'statId' },
    ]);
  });

  it('unknown base type and unknown category: the same, with their own identifier kinds', async () => {
    const RAW_GONE = raw('Gone Base');
    const CAT_GONE = craftedEntry('weapon.gone', 'explicit.ok');
    const { fs, ports } = harness([RAW_GONE, CAT_GONE, A], {}, withCatalogue('Gone Base', 'weapon.gone'));
    const { visited, step } = scriptedStep();

    await runChunk(ports, step);

    expect(visited).toEqual([key(A)]);
    expect((await reportOf(fs))?.records).toEqual([
      { kind: 'unresolvable', entryKey: key(RAW_GONE), identifier: 'Gone Base', identifierKind: 'baseTypeId' },
      { kind: 'unresolvable', entryKey: key(CAT_GONE), identifier: 'weapon.gone', identifierKind: 'categoryId' },
    ]);
    expect((await publishedOf(fs, RAW_GONE))?.price).toEqual({ state: 'unresolvable' });
    expect((await publishedOf(fs, CAT_GONE))?.price).toEqual({ state: 'unresolvable' });
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
      schemaVersion: '1.0.0',
      league: 'Standard',
      generatedAt: FIVE_HOURS_AGO,
      entries: [priced],
      currencyRates: [],
    });
    const { fs, ports } = harness([X], { [DATASET_PATH]: { contents: dataset } }, withCatalogue('X'));

    await runChunk(ports, scriptedStep().step);

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

    const outcome = await runChunk(ports, step);

    expect(outcome).toMatchObject({ kind: 'bounded', bound: 'search' });
    expect(visited).toHaveLength(1);
    expect((await reportOf(fs))?.figures.notReachedCount).toBe(1);
  });

  it('pruned: a pruned entry with a missing id is not checked, marked or recorded', async () => {
    const PX = craftedEntry('weapon.gone', STAT_GONE, 'Bows', 'pruned');
    const { fs, ports } = harness([A, PX], {}, withCatalogue('weapon.gone', STAT_GONE));

    await runChunk(ports, scriptedStep().step);

    expect(await publishedOf(fs, PX)).toEqual({
      entryKey: key(PX),
      price: { state: 'not-yet-synced', reason: 'never-synced' },
    });
    expect((await reportOf(fs))?.records).toEqual([]);
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

    await runChunk(ports, step);

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

    await runChunk(ports, step);

    expect(visited).toEqual([key(A)]);
    expect(await publishedOf(fs, U)).toEqual({
      entryKey: key(U),
      price: { state: 'unresolvable' },
      lastAttemptedAt: FIVE_HOURS_AGO,
    });
    expect((await reportOf(fs))?.records).toEqual([]);
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

    const outcome = await runChunk(ports, step);

    expect(outcome.kind).toBe('completed');
    expect(visited).toHaveLength(2);
    expect(await publishedOf(fs, J)).toEqual(mark);
    expect((await reportOf(fs))?.records).toEqual([record]);
  });

  it('empty search: zero results stay no-listings, never unresolvable', async () => {
    const { fs, ports } = harness([A]);

    await runChunk(ports, scriptedStep((entry) => ({ kind: 'completed', entry: noListingsOf(entry) })).step);

    expect((await publishedOf(fs, A))?.price).toEqual({ state: 'no-listings' });
    expect((await reportOf(fs))?.records).toEqual([]);
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

    await runChunk(present.ports, presentRun.step);
    await runChunk(absent.ports, absentRun.step);

    expect(absentRun.visited).toEqual(presentRun.visited);
    expect(await absent.fs.readTextFile(DATASET_PATH)).toBe(await present.fs.readTextFile(DATASET_PATH));
    expect((await reportOf(absent.fs))?.records).toEqual([
      { kind: 'weights-absent', uncheckableClassNames: ['Body_Armours_str', 'Bows'] },
    ]);
    // Weights present: no weights-absent record.
    expect((await reportOf(present.fs))?.records).toEqual([]);
  });

  it('weights miss: one record per distinct uncatalogued id, nulls skipped, and the run continues', async () => {
    const lineOf = (statId: string | null): unknown => ({ statId, ranges: [] });
    const weights = JSON.stringify({
      schemaVersion: '6.0.0',
      bases: {
        'weapon.bow': {
          Bows: {
            prefix: { entries: [{ lines: [lineOf('explicit.w1'), lineOf(null)] }] },
            suffix: { entries: [{ lines: [lineOf('explicit.w1')] }, { lines: [lineOf('explicit.ok')] }] },
          },
        },
        'weapon.gone': { Gone: { prefix: { entries: [] }, suffix: { entries: [] } } },
      },
    });
    const { fs, ports } = harness(
      [A],
      { [WEIGHTS_PATH]: { contents: weights } },
      withCatalogue('explicit.w1', 'weapon.gone'),
    );
    const { visited, step } = scriptedStep();

    const outcome = await runChunk(ports, step);

    expect(outcome.kind).toBe('completed');
    expect(visited).toEqual([key(A)]);
    expect((await reportOf(fs))?.records).toEqual([
      { kind: 'uncatalogued-weights-id', identifier: 'weapon.gone', identifierKind: 'categoryId' },
      { kind: 'uncatalogued-weights-id', identifier: 'explicit.w1', identifierKind: 'statId' },
    ]);
    // The file is never rewritten.
    expect(await fs.readTextFile(WEIGHTS_PATH)).toBe(weights);
  });

  it('weights bad major: a run-failure record, the error rethrown, nothing searched', async () => {
    const { fs, ports } = harness([A], {
      [WEIGHTS_PATH]: { contents: JSON.stringify({ schemaVersion: '5.1.0', bases: {} }) },
    });
    const { visited, step } = scriptedStep();

    await expect(runChunk(ports, step)).rejects.toThrow(/weights\.json.*5\.1\.0/);

    expect(visited).toEqual([]);
    const report = await reportOf(fs);
    expect(report?.runFinishedAt).toBeUndefined();
    expect(report?.records).toEqual([
      expect.objectContaining({ kind: 'run-failure', reason: 'unrecoverable-error' }),
    ]);
    expect(await fs.exists(LOCK_PATH)).toBe(false);
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

    await expect(runChunk(ports, step)).rejects.toThrow(/stats\.json/);

    expect(visited).toEqual([]);
    expect((await reportOf(fs))?.records).toEqual([
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

    expect((await runChunk(ports, scriptedStep().step)).kind).toBe('busy');
    expect(loads).toBe(0);
  });

  it('jewel: a published-unresolvable jewel entry whose ids resolve is not recovered, and waits in row 3', async () => {
    const J = craftedEntry('jewel', 'explicit.ok', 'Emerld');
    const { ports } = harness([J, A], {
      [DATASET_PATH]: { contents: datasetText([{ key: key(J), at: FIVE_HOURS_AGO, unresolvable: true }]) },
    });
    const { visited, step } = scriptedStep();

    await runChunk(ports, step);

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
      runChunk(ports, (entry) =>
        key(entry) === key(B) ? Promise.reject(failure) : Promise.resolve({ kind: 'completed' }),
      ),
    ).rejects.toBe(failure);

    expect(await publishedOf(fs, X)).toEqual({ entryKey: key(X), price: { state: 'unresolvable' } });
    expect((await reportOf(fs))?.records).toEqual([
      { kind: 'unresolvable', entryKey: key(X), identifier: 'X', identifierKind: 'baseTypeId' },
      expect.objectContaining({ kind: 'run-failure', reason: 'trade-request-rejected', entryKey: key(B) }),
    ]);
  });

  it('repeat: the same miss two chunks running is one record', async () => {
    const X = raw('X');
    const { fs, ports } = harness([A, X], {}, withCatalogue('X'));

    await runChunk(ports, scriptedStep().step);
    await runChunk(ports, scriptedStep().step);

    expect((await reportOf(fs))?.records).toEqual([
      { kind: 'unresolvable', entryKey: key(X), identifier: 'X', identifierKind: 'baseTypeId' },
    ]);
  });
});
