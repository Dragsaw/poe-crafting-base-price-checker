/**
 * `pnpm sync:dry` — the chunk runner, in memory, against the recorded fixtures
 * (AGENT-WORKFLOW.md, NFR-1, NFR-3).
 *
 * It takes read-only snapshots of `data/tracked.json`, `data/dataset.json`
 * (when present), `data/config.json`, `data/currencies.json` and
 * `data/catalogue/items.json` into an in-memory fake filesystem, and runs **the
 * same `runChunk`** a live run uses with **the same pricing step**, on a fixed
 * clock and a fixed pid. The step's requests go to an offline port that serves
 * the recorded `fixtures/trade-{search,fetch}-*.json` back by request digest;
 * an unrecorded request fails loudly — the run rejects, naming the missing
 * fixture, and never yields. It prints
 * `{outcome, completed, entries, progress, records}` — plus `pinnedStarvation`
 * when the chunk truncated the pinned set — as JSON to stdout and writes
 * nothing to disk: the lock and `sync-progress.json` land in the fake.
 *
 * An absent tracked file is an empty workload, and an absent dataset means
 * every entry is never attempted. An absent or invalid config, currencies or
 * item catalogue is a typed refusal naming the file.
 */

import { realpathSync } from 'node:fs';
import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import {
  createFakeClockPort,
  createFakeFilesystemPort,
  DatasetFileSchema,
  parseEnvelope,
  SyncProgressFileSchema,
} from '@poe/contracts';
import type { DatasetEntry, SyncProgressFile, SyncRunRecord } from '@poe/contracts';

import { DATASET_PATH, PROGRESS_PATH, runChunk, TRACKED_PATH } from './chunk/run-chunk.ts';
import type { ChunkOutcomeKind, ChunkStarvation } from './chunk/run-chunk.ts';
import { CONFIG_PATH, loadActiveLeague } from './load-config.ts';
import { loadDataFile } from './load-data-file.ts';
import type { DataFileResult } from './load-data-file.ts';
import { createFixtureHttpPort, readPricingFixtures } from './pricing/fixture-port.ts';
import type { PricingFixtures } from './pricing/fixture-port.ts';
import { CURRENCIES_PATH, loadCurrencies } from './pricing/load-currencies.ts';
import { CATALOGUE_ITEMS_PATH, loadItemTypes } from './pricing/load-item-types.ts';
import { createPricingStep } from './pricing/price-entry.ts';
import { createTradeClient } from './trade/client.ts';

/** Fixed, so two dry runs over the same inputs print the same bytes. */
export const DRY_RUN_INSTANT = '2026-01-01T00:00:00.000Z';
export const DRY_RUN_PID = 0;
/** The offline client still refuses a blank contact, so the dry run names itself. */
const DRY_RUN_USER_AGENT = 'poe-crafting-base-price-checker sync:dry (offline, no contact)';

export interface DryRunReport {
  readonly outcome: ChunkOutcomeKind;
  readonly completed: readonly string[];
  /** The dataset entries the pricing step returned, in visiting order. */
  readonly entries: readonly DatasetEntry[];
  /** The progress file the chunk wrote into the fake, or `null` if none. */
  readonly progress: SyncProgressFile | null;
  readonly records: readonly SyncRunRecord[];
  /** Present only when the chunk truncated the pinned set (AD-7). */
  readonly pinnedStarvation?: ChunkStarvation;
}

/** Every input as text; an absent key is an absent file. */
export interface DryRunSnapshot {
  readonly tracked?: string | undefined;
  readonly dataset?: string | undefined;
  readonly config?: string | undefined;
  readonly currencies?: string | undefined;
  readonly items?: string | undefined;
  readonly fixtures: PricingFixtures;
}

function valueOf<T>(loaded: DataFileResult<T>): T {
  if (!loaded.ok) {
    throw loaded.error;
  }
  return loaded.value;
}

/** Pure apart from the fakes it builds: the snapshot in, the report out. */
export async function dryRun(snapshot: DryRunSnapshot): Promise<DryRunReport> {
  const files: [string, string | undefined][] = [
    [TRACKED_PATH, snapshot.tracked],
    [DATASET_PATH, snapshot.dataset],
    [CONFIG_PATH, snapshot.config],
    [CURRENCIES_PATH, snapshot.currencies],
    [CATALOGUE_ITEMS_PATH, snapshot.items],
  ];
  const fs = createFakeFilesystemPort(
    Object.fromEntries(
      files.flatMap(([path, contents]) => (contents === undefined ? [] : [[path, { contents }]])),
    ),
  );

  const league = valueOf(await loadActiveLeague(fs));
  const rates = valueOf(await loadCurrencies(fs));
  const itemTypes = valueOf(await loadItemTypes(fs));
  const dataset =
    snapshot.dataset === undefined
      ? []
      : valueOf(
          await loadDataFile(fs, DATASET_PATH, (data) => parseEnvelope(DatasetFileSchema, data)),
        ).entries;

  const clock = createFakeClockPort(DRY_RUN_INSTANT);
  const client = createTradeClient({
    http: createFixtureHttpPort(snapshot.fixtures),
    clock,
    wait: () => Promise.resolve(),
    userAgent: DRY_RUN_USER_AGENT,
  });
  const step = createPricingStep({ client, league, rates, itemTypes, dataset, clock });

  const outcome = await runChunk({ fs, clock, pid: DRY_RUN_PID }, step);
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
    entries: outcome.entries,
    progress,
    records: outcome.records,
    ...(outcome.pinnedStarvation === undefined ? {} : { pinnedStarvation: outcome.pinnedStarvation }),
  };
}

/** `packages/sync/src/` → the repository root and its `fixtures/`. */
const REPO_ROOT = fileURLToPath(new URL('../../../', import.meta.url));
const FIXTURES_DIR = fileURLToPath(new URL('../../../fixtures/', import.meta.url));

/** A read-only snapshot; an absent file is `undefined`. */
async function readSnapshot(path: string): Promise<string | undefined> {
  try {
    return await readFile(resolve(REPO_ROOT, path), { encoding: 'utf8' });
  } catch (error) {
    if (error instanceof Error && 'code' in error && error.code === 'ENOENT') {
      return undefined;
    }
    throw error;
  }
}

/** The repository's own inputs and recorded fixtures, read and never written. */
export async function readRepositorySnapshot(): Promise<DryRunSnapshot> {
  return {
    tracked: await readSnapshot(TRACKED_PATH),
    dataset: await readSnapshot(DATASET_PATH),
    config: await readSnapshot(CONFIG_PATH),
    currencies: await readSnapshot(CURRENCIES_PATH),
    items: await readSnapshot(CATALOGUE_ITEMS_PATH),
    fixtures: await readPricingFixtures(FIXTURES_DIR),
  };
}

async function main(): Promise<void> {
  const report = await dryRun(await readRepositorySnapshot());
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
