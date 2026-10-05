import { readdirSync, readFileSync } from 'node:fs';
import nodePath from 'node:path';
import { fileURLToPath } from 'node:url';

import {
  createFakeClockPort,
  createFakeFilesystemPort,
  SUPPORTED_SCHEMA_VERSION,
  SYNC_PROGRESS_SCHEMA_VERSION,
} from '@poe/contracts';
import type { DatasetEntry, TrackedEntry } from '@poe/contracts';
import { describe, expect, it } from 'vitest';

import { LOCK_PATH } from './lock.ts';
import {
  A,
  B,
  C,
  harness,
  key,
  NOW,
  PID,
  progressOf,
  PRUNED,
  PUBLICATION,
  run,
  scriptedStep,
  shellPorts,
} from './run-chunk/test-support.ts';

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

describe('runChunk: the declared yardstick is never a chunk bound', () => {
  it('runs an identical chunk whatever the player config declares, and never reads it', async () => {
    const outcomes = await Promise.all(
      [1, 3, 1000].map(async (declared) => {
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
        const outcome = await run({ ...ports, fs: reading }, scriptedStep().step);
        expect(reads).not.toContain('data/config.json');
        return outcome;
      }),
    );
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
      const text = readFileSync(nodePath.join(directory, name), 'utf8');
      expect(text, name).not.toMatch(/minChunkSearches/);
      expect(text, name).not.toMatch(/config\.json/);
      expect(text, name).not.toMatch(/currencies\.json/);
    }
  });
});
