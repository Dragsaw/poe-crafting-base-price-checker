import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

import {
  canonicalKey,
  createFakeClockPort,
  createFakeFilesystemPort,
  SyncProgressFileSchema,
} from '@poe/contracts';
import type { FakeFilesystemPort, TrackedEntry } from '@poe/contracts';
import { describe, expect, it } from 'vitest';

import { LOCK_PATH, serialiseLock } from './lock.ts';
import { PROGRESS_PATH, runChunk, TRACKED_PATH } from './run-chunk.ts';
import type { ChunkPorts, ChunkStep, StepResult } from './run-chunk.ts';

const NOW = '2026-09-26T12:00:00.000Z';
/** Five hours before NOW: a live lock. */
const FIVE_HOURS_AGO = '2026-09-26T07:00:00.000Z';
/** Seven hours before NOW: a stale lock. */
const SEVEN_HOURS_AGO = '2026-09-26T05:00:00.000Z';
const PID = 1000;

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
  const ports: ChunkPorts = {
    fs,
    clock: createFakeClockPort(NOW),
    pid: PID,
    log: (line) => logs.push(line),
    ...overrides,
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

    expect(outcome).toEqual({ kind: 'completed', completed: [key(A), key(B), key(C)], records: [] });
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

    expect(outcome).toEqual({ kind: 'completed', completed: [key(A), key(B)], records: [] });
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

    expect(outcome).toEqual({ kind: 'yielded', completed: [key(A)], records: [] });
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

    const outcome = await runChunk({ fs, clock: createFakeClockPort(NOW), pid: PID }, step);

    expect(outcome).toEqual({ kind: 'completed', completed: [], records: [] });
    expect(visited).toEqual([]);
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

  it('serialises progress with the one artifact serialisation', async () => {
    const { fs, ports } = harness([A]);
    await runChunk(ports, scriptedStep().step);
    expect(await fs.readTextFile(PROGRESS_PATH)).toBe(
      `{\n  "schemaVersion": "1.0.0",\n  "completed": [\n    ${JSON.stringify(key(A))}\n  ]\n}\n`,
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

    expect(outcome).toEqual({ kind: 'busy', completed: [], records: [] });
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
      runChunk({ fs, clock, pid: 1, log: (line) => logs.push(line) }, first.step),
      runChunk({ fs, clock, pid: 2, log: (line) => logs.push(line) }, second.step),
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
      [1, 2, 3, 4].map((pid) => runChunk({ fs, clock, pid, log: () => undefined }, scriptedStep().step)),
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
      runChunk({ fs, clock: createFakeClockPort(NOW), pid: PID }, scriptedStep().step),
    ).rejects.toThrow(/tracked\.json/);
    expect(await fs.exists(LOCK_PATH)).toBe(false);
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
    }
  });
});
