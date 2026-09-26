import { execFile } from 'node:child_process';
import { readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { canonicalKey } from '@poe/contracts';
import type { TrackedEntry } from '@poe/contracts';
import { describe, expect, it } from 'vitest';

import { dryRun } from './dry-run.ts';

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
    const expected = [canonicalKey(entries[1] as TrackedEntry), canonicalKey(entries[0] as TrackedEntry)];

    expect(await dryRun(trackedText)).toEqual({
      outcome: 'completed',
      completed: expected,
      progress: { schemaVersion: '1.0.0', completed: expected },
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
