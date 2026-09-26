import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

import {
  canonicalKey,
  compareCanonicalKeys,
  createFakeClockPort,
  createFakeFilesystemPort,
  DatasetFileSchema,
  SyncProgressFileSchema,
} from '@poe/contracts';
import type { DatasetEntry, DatasetFile, FakeFilesystemPort, TrackedEntry } from '@poe/contracts';
import { describe, expect, it } from 'vitest';

import { MalformedRequestError } from '../pricing/price-entry.ts';
import { InvalidArtifactError } from '../write-artifact.ts';
import { LOCK_PATH, serialiseLock } from './lock.ts';
import { DATASET_PATH, PROGRESS_PATH, runChunk, TRACKED_PATH } from './run-chunk.ts';
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
    ...extra,
  });
  const logs: string[] = [];
  const { publication = PUBLICATION, ...rest } = overrides;
  const ports: ChunkPorts = {
    fs,
    clock: createFakeClockPort(NOW),
    pid: PID,
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
      { fs, clock: createFakeClockPort(NOW), pid: PID, publication: PUBLICATION },
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
      runChunk({ fs, clock, pid: 1, publication: PUBLICATION, log: (line) => logs.push(line) }, first.step),
      runChunk({ fs, clock, pid: 2, publication: PUBLICATION, log: (line) => logs.push(line) }, second.step),
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
          { fs, clock, pid, publication: PUBLICATION, log: () => undefined },
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
        { fs, clock: createFakeClockPort(NOW), pid: PID, publication: PUBLICATION },
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

    // C never attempted, then B, then A; U exactly 24 h old is due in row 3.
    expect(visited).toEqual([key(C), key(B), key(A), key(U)]);
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

  it('a due pinned + unresolvable entry is visited in row 3 and its key is written to progress', async () => {
    const PU = raw('PU', 'pinned');
    const { fs, ports } = harness([PU, A], {
      [DATASET_PATH]: {
        contents: datasetText([{ key: key(PU), at: '2026-09-25T11:00:00.000Z', unresolvable: true }]),
      },
    });
    const { visited, step } = scriptedStep();

    await runChunk(ports, step);

    expect(visited).toEqual([key(A), key(PU)]);
    expect(await progressOf(fs)).toEqual({ schemaVersion: '1.0.0', completed: [key(A), key(PU)] });
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
