import { compareCanonicalKeys, DatasetFileSchema, SUPPORTED_SCHEMA_VERSION } from '@poe/contracts';
import type { DatasetEntry, DatasetFile, FakeFilesystemPort, TrackedEntry } from '@poe/contracts';
import { describe, expect, it } from 'vitest';

import { InvalidArtifactError } from '../../write-artifact.ts';
import { LOCK_PATH, serialiseLock } from '../lock.ts';
import { DATASET_PATH, PROGRESS_PATH } from '../run-chunk.ts';
import type { ChunkPublication } from '../run-chunk.ts';
import {
  A,
  B,
  C,
  FIVE_HOURS_AGO,
  harness,
  key,
  NOW,
  PRUNED,
  raw,
  run,
  scriptedStep,
  SEVEN_HOURS_AGO,
} from './test-support.ts';

async function datasetOf(fs: FakeFilesystemPort): Promise<DatasetFile | undefined> {
  const text = await fs.readTextFile(DATASET_PATH);
  return text === undefined ? undefined : DatasetFileSchema.parse(JSON.parse(text));
}

function previousFile(entries: readonly DatasetEntry[]): string {
  return `${JSON.stringify(
    { schemaVersion: SUPPORTED_SCHEMA_VERSION, league: 'Old League', generatedAt: SEVEN_HOURS_AGO, entries, currencyRates: [] },
    undefined,
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
    const block = JSON.stringify(carried, undefined, 2).split('\n').map((line) => `    ${line}`).join('\n');
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
    const texts = await Promise.all(
      [0, 1].map(async () => {
        const { fs, ports } = harness(undefined, {}, { publication: PUBLISHING });
        await run(ports, scriptedStep((entry) => ({ kind: 'completed', entry: noListings(entry) })).step);
        return fs.readTextFile(DATASET_PATH);
      }),
    );
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
