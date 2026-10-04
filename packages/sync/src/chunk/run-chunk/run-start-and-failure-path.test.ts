import {
  compareCanonicalKeys,
  DatasetFileSchema,
  SUPPORTED_SCHEMA_VERSION,
  SYNC_PROGRESS_SCHEMA_VERSION,
} from '@poe/contracts';
import type { DatasetEntry, FakeFilesystemPort } from '@poe/contracts';
import { describe, expect, it } from 'vitest';

import { WEIGHTS_PATH } from '../../catalogue/weights-ids.ts';
import { LeagueMismatchError } from '../../league/league-gate.ts';
import { DataFileError } from '../../load-data-file.ts';
import { PinnedCapExceededError } from '../../pinned-cap.ts';
import { LOCK_PATH, serialiseLock } from '../lock.ts';
import { DATASET_PATH, PROGRESS_PATH, REPORT_PATH, runChunk, TRACKED_PATH } from '../run-chunk.ts';
import {
  A,
  B,
  C,
  catalogueWithout,
  DEFAULT_STARVATION,
  harness,
  key,
  noListingsEntry,
  NOW,
  progressOf,
  progressText,
  PUBLICATION,
  raw,
  reportOf,
  RESOLVES_ALL,
  run,
  scriptedStep,
  SEVEN_HOURS_AGO,
} from './test-support.ts';
import type { TestPorts } from './test-support.ts';

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
