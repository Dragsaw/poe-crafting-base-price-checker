import { execFile } from 'node:child_process';
import { readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { canonicalKey, createFakeClockPort, createFakeFilesystemPort } from '@poe/contracts';
import type { TrackedEntry } from '@poe/contracts';
import { describe, expect, it } from 'vitest';

import { DATASET_PATH, runChunk, TRACKED_PATH } from './chunk/run-chunk.ts';
import { DRY_RUN_INSTANT, dryRun } from './dry-run.ts';

const SCRIPT = fileURLToPath(new URL('./dry-run.ts', import.meta.url));
const DATA_DIR = fileURLToPath(new URL('../../../data', import.meta.url));

const entries: TrackedEntry[] = [
  { kind: 'raw', baseTypeId: 'Solar Amulet', itemLevelMin: 82, status: 'active' },
  { kind: 'raw', baseTypeId: 'Gold Amulet', itemLevelMin: 82, status: 'pinned' },
  { kind: 'raw', baseTypeId: 'Wide Belt', itemLevelMin: 82, status: 'pruned', prunedReason: 'x' },
];
const trackedText = JSON.stringify({ schemaVersion: '1.0.0', entries });

describe('dryRun', () => {
  it('runs the chunk in memory and reports what it completed and would record', async () => {
    const pinned = canonicalKey(entries[1] as TrackedEntry);
    const active = canonicalKey(entries[0] as TrackedEntry);

    expect(await dryRun(trackedText)).toEqual({
      outcome: 'completed',
      completed: [pinned, active],
      // Pinned entries are exempt from the pass, so only the active key is recorded.
      progress: { schemaVersion: '1.0.0', completed: [active] },
      records: [],
    });
  });

  it('treats an absent tracked file as an empty workload', async () => {
    expect(await dryRun(undefined)).toEqual({
      outcome: 'completed',
      completed: [],
      progress: { schemaVersion: '1.0.0', completed: [] },
      records: [],
    });
  });

  it('is deterministic for a given tracked list', async () => {
    expect(await dryRun(trackedText)).toEqual(await dryRun(trackedText));
  });

  it('refuses an invalid tracked file loudly', async () => {
    await expect(dryRun('{"schemaVersion":"9.0.0","entries":[]}')).rejects.toThrow(/9\.0\.0/);
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

  it('orders the rotation by the snapshot’s lastAttemptedAt', async () => {
    const report = await dryRun(rotationTracked, datasetText);
    expect(report.completed).toEqual([P, C, B, A].map(canonicalKey));
  });

  it('visits the same keys in the same order as runChunk on the same fake and clock', async () => {
    const fs = createFakeFilesystemPort({
      [TRACKED_PATH]: { contents: rotationTracked },
      [DATASET_PATH]: { contents: datasetText },
    });
    const visited: string[] = [];
    await runChunk({ fs, clock: createFakeClockPort(DRY_RUN_INSTANT), pid: 1, log: () => undefined }, (entry) => {
      visited.push(canonicalKey(entry));
      return Promise.resolve({ kind: 'completed' });
    });

    const report = await dryRun(rotationTracked, datasetText);
    expect(report.completed).toEqual(visited);
    expect(visited).toHaveLength(4);
  });

  it('is deterministic with a dataset', async () => {
    expect(await dryRun(rotationTracked, datasetText)).toEqual(await dryRun(rotationTracked, datasetText));
  });

  it('refuses an invalid dataset loudly', async () => {
    await expect(dryRun(rotationTracked, '{"schemaVersion":"9.0.0"}')).rejects.toThrow(/dataset\.json/);
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
    expect(Object.keys(report)).toEqual(['outcome', 'completed', 'progress', 'records']);
    expect(report['outcome']).toBe('completed');

    expect(snapshot(DATA_DIR)).toEqual(before);
  });
});
