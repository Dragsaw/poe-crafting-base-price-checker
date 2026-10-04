import { DatasetFileSchema, SUPPORTED_SCHEMA_VERSION } from '@poe/contracts';
import type { DatasetEntry, FakeFilesystemPort, SyncRunRecord, TrackedEntry } from '@poe/contracts';
import { describe, expect, it } from 'vitest';

import { DataFileError } from '../../../load-data-file.ts';
import { MalformedRequestError } from '../../../pricing/price-entry.ts';
import { LOCK_PATH, serialiseLock } from '../../lock.ts';
import { DATASET_PATH } from '../../run-chunk.ts';
import {
  A,
  B,
  catalogueWithout,
  datasetText,
  FIVE_HOURS_AGO,
  harness,
  key,
  noListingsEntry,
  NOW,
  raw,
  reportOf,
  run,
  scriptedStep,
  SEVEN_HOURS_AGO,
} from '../test-support.ts';
import { craftedEntry, withCatalogue } from './test-support.ts';

async function publishedOf(fs: FakeFilesystemPort, entry: TrackedEntry): Promise<DatasetEntry | undefined> {
  const text = await fs.readTextFile(DATASET_PATH);
  const file = text === undefined ? undefined : DatasetFileSchema.parse(JSON.parse(text));
  return file?.entries.find((published) => published.entryKey === key(entry));
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
