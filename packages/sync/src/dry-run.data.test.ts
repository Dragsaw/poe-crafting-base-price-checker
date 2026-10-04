import { execFile } from 'node:child_process';
import { readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { DatasetFileSchema, SyncReportFileSchema } from '@poe/contracts';
import type { DatasetEntry, DatasetFile, SyncReportFile } from '@poe/contracts';
import { describe, expect, it } from 'vitest';

/**
 * The dry-run script over the live data/ (pnpm test:data). The copy in
 * dry-run.test.ts keeps only the "writes nothing" guard.
 */
const SCRIPT = fileURLToPath(new URL('dry-run.ts', import.meta.url));
const DATA_DIR = fileURLToPath(new URL('../../../data', import.meta.url));

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


describe('pnpm sync:dry over the live data/', () => {
  it('exits 0, prints the same parseable JSON twice, and writes nothing to disk', async () => {
    const before = snapshot(DATA_DIR);

    const first = await runScript();
    const second = await runScript();

    expect(first.code, first.stderr).toBe(0);
    expect(second.code, second.stderr).toBe(0);
    expect(second.stdout).toBe(first.stdout);
    expect(first.stderr).toBe('');

    const report = JSON.parse(first.stdout) as Record<string, unknown>;
    // The optional keys depend on the real data: `unrecorded` on an entry the
    // fixture workload does not cover, `notBefore` on a pending penalty in
    // `data/sync-progress.json`.
    expect(Object.keys(report)).toEqual([
      'outcome',
      'completed',
      'entries',
      'progress',
      'dataset',
      'records',
      'report',
      ...['unrecorded', 'pinnedStarvation', 'notBefore'].filter((key) => key in report),
    ]);
    expect(report['outcome']).toBe('completed');
    // Printed as written: the schema accepts it and its keys are in declared order.
    expect(DatasetFileSchema.safeParse(report['dataset']).success).toBe(true);
    expect(Object.keys(report['dataset'] as object)).toEqual([
      'schemaVersion',
      'league',
      'generatedAt',
      'entries',
      'currencyRates',
    ]);

    // The run-report assertion Story 1.5 left open: the schema accepts it, in
    // declared key order, with all three sources present.
    expect(SyncReportFileSchema.safeParse(report['report']).success).toBe(true);
    const printed = report['report'] as SyncReportFile;
    expect(Object.keys(printed)).toEqual(['runStartedAt', 'runFinishedAt', 'figures', 'records', 'schemaVersion']);
    expect(Object.keys(printed.figures.requestsBySource).toSorted()).toEqual([
      'league-validation',
      'session-probe',
      'tracked-list',
    ]);
    // The league gate ran once, against the recorded leagues fixture (Story 1.11).
    expect(printed.figures.requestsBySource['league-validation']).toBe(1);
    expect(printed.records.some((record) => record.kind === 'league-mismatch')).toBe(false);

    expect(snapshot(DATA_DIR)).toEqual(before);
  });

  it('--at sets the clock explicitly and writes nothing to disk', async () => {
    const before = snapshot(DATA_DIR);
    const at = '2026-06-01T00:00:00.000Z';

    const run = await runScript(['--at', at]);

    expect(run.code, run.stderr).toBe(0);
    const report = JSON.parse(run.stdout) as { entries: DatasetEntry[]; dataset: DatasetFile };
    // Only the entries this run priced are stamped; a skipped one keeps its stamp.
    const stamped = new Set(report.entries.map((entry) => entry.entryKey));
    for (const entry of report.dataset.entries.filter((published) => stamped.has(published.entryKey))) {
      expect(entry.lastAttemptedAt, entry.entryKey).toBe(at);
    }
    expect(snapshot(DATA_DIR)).toEqual(before);
  });
});
