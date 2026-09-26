/**
 * `pnpm sync:dry` — the chunk runner, in memory, against the recorded fixtures
 * (AGENT-WORKFLOW.md, NFR-1, NFR-3).
 *
 * It takes read-only snapshots of `data/tracked.json`, `data/dataset.json`
 * (when present), `data/config.json`, `data/currencies.json`,
 * `data/catalogue/{items,stats,filters}.json` and `data/weights.json` (when
 * present) into an in-memory fake filesystem, and runs **the
 * same `runChunk`** a live run uses with **the same pricing step**, on a fixed
 * clock and a fixed pid. The step's requests go to an offline port that serves
 * the recorded `fixtures/trade-{search,fetch}-*.json` back by request digest;
 * an unrecorded request fails loudly — the run rejects, naming the missing
 * fixture, and never yields. It prints
 * `{outcome, completed, entries, progress, dataset, records, report}` — plus
 * `pinnedStarvation` when the chunk truncated the pinned set — as JSON to
 * stdout and writes nothing to disk: the lock, `sync-progress.json`,
 * `dataset.json` and `sync-report.json` land in the fake. `dataset` is the
 * file as the chunk wrote it, with the active league and the output rate set
 * passed in. `report` is the Sync Report as the chunk wrote it: the offline
 * port's requests are counted as `tracked-list`, the git port is a fake with
 * no history, and a snapshot of `data/sync-report.json` (when present)
 * supplies the records it carries forward.
 *
 * An absent tracked file is an empty workload, and an absent dataset means
 * every entry is never attempted. An absent weights file is a `weights-absent`
 * record, as in a live run. An absent or invalid config, currencies or
 * catalogue file is a typed refusal naming the file.
 */

import { realpathSync } from 'node:fs';
import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import {
  createFakeClockPort,
  createFakeFilesystemPort,
  createFakeGitPort,
  DatasetFileSchema,
  parseEnvelope,
  SyncProgressFileSchema,
  SyncReportFileSchema,
} from '@poe/contracts';
import type {
  DatasetEntry,
  DatasetFile,
  FilesystemPort,
  SyncProgressFile,
  SyncReportFile,
  SyncRunRecord,
} from '@poe/contracts';

import {
  DATASET_PATH,
  PROGRESS_PATH,
  REPORT_PATH,
  runChunk,
  TRACKED_PATH,
} from './chunk/run-chunk.ts';
import type { ChunkOutcomeKind, ChunkStarvation } from './chunk/run-chunk.ts';
import {
  CATALOGUE_FILTERS_PATH,
  CATALOGUE_STATS_PATH,
  loadCatalogueIds,
} from './catalogue/catalogue-ids.ts';
import { WEIGHTS_PATH } from './catalogue/weights-ids.ts';
import { CONFIG_PATH, loadConfig } from './load-config.ts';
import { loadDataFile } from './load-data-file.ts';
import type { DataFileResult } from './load-data-file.ts';
import { pinnedStarvationRecord } from './pinned-cap.ts';
import { createFixtureHttpPort, readPricingFixtures } from './pricing/fixture-port.ts';
import type { PricingFixtures } from './pricing/fixture-port.ts';
import { CURRENCIES_PATH, loadCurrencies } from './pricing/load-currencies.ts';
import { outputRates } from './pricing/normalise.ts';
import { CATALOGUE_ITEMS_PATH, loadItemTypes } from './pricing/load-item-types.ts';
import { createPricingStep } from './pricing/price-entry.ts';
import { createRequestCounter } from './request-counter.ts';
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
  /** The dataset file the chunk wrote into the fake, or `null` if none. */
  readonly dataset: DatasetFile | null;
  readonly records: readonly SyncRunRecord[];
  /** The Sync Report the chunk wrote into the fake, or `null` if none. */
  readonly report: SyncReportFile | null;
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
  readonly stats?: string | undefined;
  readonly filters?: string | undefined;
  /** `data/weights.json`; absent is recorded, never refused. */
  readonly weights?: string | undefined;
  /** The previous Sync Report, whose records the chunk carries forward. */
  readonly report?: string | undefined;
  readonly fixtures: PricingFixtures;
}

function valueOf<T>(loaded: DataFileResult<T>): T {
  if (!loaded.ok) {
    throw loaded.error;
  }
  return loaded.value;
}

/** A file the chunk wrote into the fake, validated; `null` if it wrote none. */
async function readWritten<T>(
  fs: FilesystemPort,
  path: string,
  schema: { parse(data: unknown): T },
): Promise<T | null> {
  const text = await fs.readTextFile(path);
  return text === undefined ? null : schema.parse(JSON.parse(text));
}

/** Pure apart from the fakes it builds: the snapshot in, the report out. */
export async function dryRun(snapshot: DryRunSnapshot): Promise<DryRunReport> {
  const files: [string, string | undefined][] = [
    [TRACKED_PATH, snapshot.tracked],
    [DATASET_PATH, snapshot.dataset],
    [CONFIG_PATH, snapshot.config],
    [CURRENCIES_PATH, snapshot.currencies],
    [CATALOGUE_ITEMS_PATH, snapshot.items],
    [CATALOGUE_STATS_PATH, snapshot.stats],
    [CATALOGUE_FILTERS_PATH, snapshot.filters],
    [WEIGHTS_PATH, snapshot.weights],
    [REPORT_PATH, snapshot.report],
  ];
  const fs = createFakeFilesystemPort(
    Object.fromEntries(
      files.flatMap(([path, contents]) => (contents === undefined ? [] : [[path, { contents }]])),
    ),
  );

  const config = valueOf(await loadConfig(fs));
  const league = config.league;
  const rates = valueOf(await loadCurrencies(fs));
  const itemTypes = valueOf(await loadItemTypes(fs));
  const previous =
    snapshot.dataset === undefined
      ? []
      : valueOf(
          await loadDataFile(fs, DATASET_PATH, (data) => parseEnvelope(DatasetFileSchema, data)),
        ).entries;

  const clock = createFakeClockPort(DRY_RUN_INSTANT);
  const requests = createRequestCounter();
  const client = createTradeClient({
    http: requests.counted(createFixtureHttpPort(snapshot.fixtures), 'tracked-list'),
    clock,
    wait: () => Promise.resolve(),
    userAgent: DRY_RUN_USER_AGENT,
  });
  const step = createPricingStep({ client, league, rates, itemTypes, dataset: previous, clock });

  const outcome = await runChunk(
    {
      fs,
      clock,
      pid: DRY_RUN_PID,
      publication: { league, currencyRates: outputRates(rates) },
      git: createFakeGitPort(),
      requests,
      starvationRecord: (starvation) => pinnedStarvationRecord(starvation, config),
      catalogue: () => loadCatalogueIds(fs),
    },
    step,
  );
  // Each artifact was written in its schema's key order, so the parsed value
  // prints as written.
  const progress = await readWritten(fs, PROGRESS_PATH, SyncProgressFileSchema);
  const dataset = await readWritten(fs, DATASET_PATH, DatasetFileSchema);
  const report = await readWritten(fs, REPORT_PATH, SyncReportFileSchema);
  return {
    outcome: outcome.kind,
    completed: outcome.completed,
    entries: outcome.entries,
    progress,
    dataset,
    records: outcome.records,
    report,
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
    stats: await readSnapshot(CATALOGUE_STATS_PATH),
    filters: await readSnapshot(CATALOGUE_FILTERS_PATH),
    weights: await readSnapshot(WEIGHTS_PATH),
    report: await readSnapshot(REPORT_PATH),
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
