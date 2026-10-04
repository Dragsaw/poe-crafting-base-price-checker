import { execFile } from 'node:child_process';
import { readdirSync, statSync } from 'node:fs';
import nodePath from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

const SCRIPT = fileURLToPath(new URL('../dry-run.ts', import.meta.url));
const DATA_DIR = fileURLToPath(new URL('../../../../data', import.meta.url));

interface Run {
  readonly code: number | null;
  readonly stdout: string;
  readonly stderr: string;
}

/** Spawns the script the way `pnpm sync:dry` does, with both streams piped. */
function runScript(arguments_: readonly string[] = []): Promise<Run> {
  return new Promise((resolve) => {
    const child = execFile(process.execPath, [SCRIPT, ...arguments_], { encoding: 'utf8' }, (_error, stdout, stderr) => {
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
    const path = nodePath.join(directory, name);
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
  // Over the live data/, whose content is the player's: only the write guard
  // is asserted here. The exit code and output are checked by pnpm test:data.
  it('writes nothing to disk', async () => {
    const before = snapshot(DATA_DIR);

    const runs = [await runScript(), await runScript(['--at', '2026-06-01T00:00:00.000Z'])];

    // The scripts ran to an exit: a guard over a script that never started proves nothing.
    expect(runs.map((run) => typeof run.code)).toEqual(['number', 'number']);
    expect(snapshot(DATA_DIR)).toEqual(before);
  });

  it('exits non-zero, naming the flag, on an unrecognised option', async () => {
    const run = await runScript(['--bogus']);
    expect(run.code).not.toBe(0);
    expect(run.stderr).toMatch(/--bogus/);
  });

  it('exits non-zero, naming --at, when --at is not an ISO-8601 instant', async () => {
    const run = await runScript(['--at', 'not-a-date']);
    expect(run.code).not.toBe(0);
    expect(run.stderr).toMatch(/--at/);
  });
});
