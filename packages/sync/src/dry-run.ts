/**
 * `pnpm sync:dry` — the chunk runner, in memory (AGENT-WORKFLOW.md).
 *
 * It takes read-only snapshots of `data/tracked.json` and, when present,
 * `data/dataset.json` into an in-memory fake filesystem and runs **the same
 * `runChunk`** a live run uses, with a fixed clock, a fixed pid and a step
 * that issues no request. It prints `{outcome, completed, progress, records}`
 * — plus `pinnedStarvation` when the chunk truncated the pinned set — as JSON
 * to stdout and writes nothing to disk: the lock and `sync-progress.json` land
 * in the fake.
 *
 * An absent tracked file is an empty workload, and an absent dataset means
 * every entry is never attempted; neither is a failure, so a clean checkout
 * runs this green. Later stories swap the step for fixture-backed
 * pricing and add the written dataset and the report to the printed outcome.
 */

import { realpathSync } from 'node:fs';
import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import { createFakeClockPort, createFakeFilesystemPort, SyncProgressFileSchema } from '@poe/contracts';
import type { SyncProgressFile, SyncRunRecord } from '@poe/contracts';

import { DATASET_PATH, PROGRESS_PATH, runChunk, TRACKED_PATH } from './chunk/run-chunk.ts';
import type { ChunkOutcomeKind, ChunkStarvation, ChunkStep } from './chunk/run-chunk.ts';

/** Fixed, so two dry runs over the same tracked list print the same bytes. */
export const DRY_RUN_INSTANT = '2026-01-01T00:00:00.000Z';
export const DRY_RUN_PID = 0;

export interface DryRunReport {
  readonly outcome: ChunkOutcomeKind;
  readonly completed: readonly string[];
  /** The progress file the chunk wrote into the fake, or `null` if none. */
  readonly progress: SyncProgressFile | null;
  readonly records: readonly SyncRunRecord[];
  /** Present only when the chunk truncated the pinned set (AD-7). */
  readonly pinnedStarvation?: ChunkStarvation;
}

/** Completes every entry it is given and issues nothing. */
const offlineStep: ChunkStep = () => Promise.resolve({ kind: 'completed' });

/**
 * Pure apart from the fake it builds: the tracked text and the dataset text
 * in, the report out. An `undefined` tracked text means the player has no
 * tracked file; an absent dataset text means no published dataset, so every
 * entry is never attempted.
 */
export async function dryRun(
  trackedText: string | undefined,
  datasetText?: string,
): Promise<DryRunReport> {
  const fs = createFakeFilesystemPort({
    ...(trackedText === undefined ? {} : { [TRACKED_PATH]: { contents: trackedText } }),
    ...(datasetText === undefined ? {} : { [DATASET_PATH]: { contents: datasetText } }),
  });
  const outcome = await runChunk(
    { fs, clock: createFakeClockPort(DRY_RUN_INSTANT), pid: DRY_RUN_PID },
    offlineStep,
  );
  const progressText = await fs.readTextFile(PROGRESS_PATH);
  let progress: SyncProgressFile | null = null;
  if (progressText !== undefined) {
    // Validated, then printed as written: the parse would reorder the keys.
    const written: unknown = JSON.parse(progressText);
    SyncProgressFileSchema.parse(written);
    progress = written as SyncProgressFile;
  }
  return {
    outcome: outcome.kind,
    completed: outcome.completed,
    progress,
    records: outcome.records,
    ...(outcome.pinnedStarvation === undefined ? {} : { pinnedStarvation: outcome.pinnedStarvation }),
  };
}

/** `packages/sync/src/` → the repository's `data/tracked.json` and `data/dataset.json`. */
const TRACKED_FILE = fileURLToPath(new URL('../../../data/tracked.json', import.meta.url));
const DATASET_FILE = fileURLToPath(new URL('../../../data/dataset.json', import.meta.url));

/** A read-only snapshot; an absent file is `undefined`. */
async function readSnapshot(path: string): Promise<string | undefined> {
  try {
    return await readFile(path, { encoding: 'utf8' });
  } catch (error) {
    if (error instanceof Error && 'code' in error && error.code === 'ENOENT') {
      return undefined;
    }
    throw error;
  }
}

async function main(): Promise<void> {
  const report = await dryRun(await readSnapshot(TRACKED_FILE), await readSnapshot(DATASET_FILE));
  process.stdout.write(`${JSON.stringify(report, null, 2)}\n`);
}

/**
 * Importing the module, as the co-located test does, runs nothing. Node
 * realpaths the main module's URL but not `argv[1]`, so the comparison
 * realpaths both sides; otherwise a junction or `subst` path prints nothing.
 */
function isInvokedDirectly(): boolean {
  const entry = process.argv[1];
  if (entry === undefined) {
    return false;
  }
  try {
    return realpathSync(resolve(entry)) === realpathSync(fileURLToPath(import.meta.url));
  } catch {
    return false;
  }
}

const invokedDirectly = isInvokedDirectly();

if (invokedDirectly) {
  main().catch((error: unknown) => {
    process.stderr.write(`pnpm sync:dry: ${String(error)}\n`);
    // `process.exitCode`, not `process.exit(1)`: an immediate exit truncates a
    // piped stderr write, and a pipe is how an agent runtime captures it.
    process.exitCode = 1;
  });
}
