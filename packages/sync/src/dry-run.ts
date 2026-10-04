/**
 * `pnpm sync:dry` — the chunk runner, in memory, against the recorded fixtures
 * (AGENT-WORKFLOW.md, NFR-1, NFR-3).
 *
 * It takes read-only snapshots of `data/tracked.json`, `data/dataset.json`
 * (when present), `data/config.json`, `data/currencies.json`,
 * `data/catalogue/{items,stats,filters}.json` and `data/weights.json` (when
 * present) into an in-memory fake filesystem, and runs **the same
 * composition** a live run uses (`./compose-chunk.ts`: the same `runChunk`,
 * the same pricing step, the same league gate and the same under-lock loads),
 * on a fixed pid, with no pacing wait. The
 * gate's GET is served the recorded `fixtures/trade-data-leagues.json` and
 * counted as `league-validation`. The step's requests go to an offline port
 * that serves the recorded `fixtures/trade-{search,fetch}-*.json` back by
 * request digest. The recorded searches cover a small fixed workload
 * (`FIXTURE_WORKLOAD_PATH`), not the whole tracked list, so an entry whose
 * search has no recorded fixture is skipped: it is visited with no request,
 * keeps its dataset state and is listed in `unrecorded`. Every other
 * unrecorded request, such as the fetch leg of a recorded search, fails
 * loudly — the run rejects, naming the missing fixture, and never yields. A
 * league mismatch rejects too. It prints `{outcome, completed, entries,
 * progress, dataset, records, report}` — plus `unrecorded` when an entry was
 * skipped, `pinnedStarvation` when the chunk truncated the pinned
 * set, and `notBefore` when the real `data/sync-progress.json` carries one —
 * as JSON to stdout and writes nothing to disk: the lock,
 * `sync-progress.json`, `dataset.json` and `sync-report.json` land in the
 * fake. `dataset` is the file as the chunk wrote it, with the active league
 * and the output rate set passed in. `report` is the Sync Report as the
 * chunk wrote it: the offline port's pricing requests are counted as
 * `tracked-list`, the git port is a fake with no history, and a snapshot of
 * `data/sync-report.json` (when present) supplies the records it carries
 * forward.
 *
 * **The clock.** By default the clock is the latest `lastAttemptedAt` across
 * the dataset snapshot's entries, so the run predicts the live run that
 * immediately follows the last one; with no such entry it falls back to the
 * fixed instant `DRY_RUN_INSTANT`. `--at <iso>` (or the `at` option) sets it
 * explicitly. The dry run never lets the real `data/sync-progress.json`'s
 * `notBefore` (AD-8's cross-run penalty) defer the simulated run — it is
 * read but never fed into the fake filesystem — and only surfaces it in the
 * printed report (AGENT-WORKFLOW.md).
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
import { parseArgs } from 'node:util';

import {
  canonicalKey,
  createFakeClockPort,
  createFakeFilesystemPort,
  createFakeGitPort,
  DatasetFileSchema,
  IsoTimestampSchema,
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
  TrackedEntry,
} from '@poe/contracts';

import { DATASET_PATH, PROGRESS_PATH, REPORT_PATH, TRACKED_PATH } from './chunk/run-chunk.ts';
import type { ChunkOutcomeKind, ChunkStarvation } from './chunk/run-chunk.ts';
import { CATALOGUE_FILTERS_PATH, CATALOGUE_STATS_PATH } from './catalogue/catalogue-ids.ts';
import { WEIGHTS_PATH } from './catalogue/weights-ids.ts';
import { composeChunk } from './compose-chunk.ts';
import type { StepContext } from './compose-chunk.ts';
import { CONFIG_PATH } from './load-config.ts';
import { loadDataFile } from './load-data-file.ts';
import type { DataFileResult } from './load-data-file.ts';
import { createFixtureHttpPort, readPricingFixtures } from './pricing/fixture-port.ts';
import type { PricingFixtures } from './pricing/fixture-port.ts';
import { CURRENCIES_PATH } from './pricing/load-currencies.ts';
import { searchFixtureName } from './pricing/fixture-names.ts';
import { CATALOGUE_ITEMS_PATH } from './pricing/load-item-types.ts';
import { UnknownClassBaseTypeError } from './pricing/search-body.ts';

/**
 * The clock's fallback when the dataset snapshot carries no `lastAttemptedAt`
 * and `--at` is absent. Fixed, so that case still prints the same bytes on
 * repeat; the default case's determinism instead comes from the snapshot's
 * own latest `lastAttemptedAt`.
 */
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
  /**
   * The entry keys the run skipped, in visiting order, because their search
   * has no recorded fixture. Present only when there is at least one.
   */
  readonly unrecorded?: readonly string[];
  /** Present only when the chunk truncated the pinned set (AD-7). */
  readonly pinnedStarvation?: ChunkStarvation;
  /**
   * The real `data/sync-progress.json`'s `notBefore` (AD-8), when the
   * snapshot carries one. The dry run never lets it defer the simulated run;
   * this is surfaced only so an agent can see a pending penalty.
   */
  readonly notBefore?: string;
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
  /**
   * The real `data/sync-progress.json`. Read only for its `notBefore`
   * (AD-8); never fed into the simulated run, so it cannot defer it.
   */
  readonly progress?: string | undefined;
  readonly fixtures: PricingFixtures;
}

/** Additional dry-run behaviour outside the file snapshot. */
export interface DryRunOptions {
  /** Overrides the default clock (the latest `lastAttemptedAt`, or `DRY_RUN_INSTANT`). */
  readonly at?: string | undefined;
}

function valueOf<T>(loaded: DataFileResult<T>): T {
  if (!loaded.ok) {
    throw loaded.error;
  }
  return loaded.value;
}

/** The latest `lastAttemptedAt` among the entries, or `undefined` if none carry one. */
function latestAttemptedAt(entries: readonly DatasetEntry[]): string | undefined {
  let latest: string | undefined;
  for (const entry of entries) {
    if (
      entry.lastAttemptedAt !== undefined &&
      (latest === undefined || Date.parse(entry.lastAttemptedAt) > Date.parse(latest))
    ) {
      latest = entry.lastAttemptedAt;
    }
  }
  return latest;
}

/**
 * The real `data/sync-progress.json`'s `notBefore`, when the snapshot carries
 * one — a typed refusal naming the file, as every other input file gets.
 */
function readProgressNotBefore(text: string | undefined): string | undefined {
  if (text === undefined) {
    return undefined;
  }
  try {
    return SyncProgressFileSchema.parse(JSON.parse(text)).notBefore;
  } catch (error) {
    throw new Error(`${PROGRESS_PATH}: invalid: ${String(error)}`, { cause: error });
  }
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
/**
 * Whether `entry`'s search has a recorded fixture. An entry whose body cannot
 * be built counts as recorded, so the pricing step handles it as a live run
 * does, with no request.
 */
function hasRecordedSearch(fixtures: PricingFixtures, entry: TrackedEntry, context: StepContext): boolean {
  let name: string;
  try {
    name = searchFixtureName(entry, context.league, context.itemTypes);
  } catch (error) {
    if (error instanceof UnknownClassBaseTypeError) {
      return true;
    }
    throw error;
  }
  return fixtures.has(name);
}

export async function dryRun(snapshot: DryRunSnapshot, options: DryRunOptions = {}): Promise<DryRunReport> {
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

  // The snapshot's dataset is parsed here for the clock only; the chunk loads
  // its own copy under the lock.
  const previous =
    snapshot.dataset === undefined
      ? []
      : valueOf(
          await loadDataFile(fs, DATASET_PATH, (data) => parseEnvelope(DatasetFileSchema, data)),
        ).entries;

  const clock = createFakeClockPort(options.at ?? latestAttemptedAt(previous) ?? DRY_RUN_INSTANT);
  const notBefore = readProgressNotBefore(snapshot.progress);
  const unrecorded: string[] = [];
  // The same composition a live run uses, over the offline fixture port and
  // with no pacing wait (AD-8, AD-12).
  const outcome = await composeChunk({
    fs,
    clock,
    http: createFixtureHttpPort(snapshot.fixtures),
    git: createFakeGitPort(),
    wait: () => Promise.resolve(),
    userAgent: DRY_RUN_USER_AGENT,
    pid: DRY_RUN_PID,
    wrapStep: (step, context) => (entry) => {
      if (hasRecordedSearch(snapshot.fixtures, entry, context)) {
        return step(entry);
      }
      unrecorded.push(canonicalKey(entry));
      return Promise.resolve({ kind: 'completed' });
    },
  }).run();
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
    ...(!(unrecorded.length === 0) && { unrecorded }),
    ...(!(outcome.pinnedStarvation === undefined) && { pinnedStarvation: outcome.pinnedStarvation }),
    ...(!(notBefore === undefined) && { notBefore }),
  };
}

/** `packages/sync/src/` → the repository root and its `fixtures/`. */
const REPO_ROOT = fileURLToPath(new URL('../../../', import.meta.url));
const FIXTURES_DIR = fileURLToPath(new URL('../../../fixtures/', import.meta.url));

/** A read-only snapshot; an absent file is `undefined`. */
async function readSnapshot(path: string, dataDir?: string): Promise<string | undefined> {
  try {
    const location = dataDir === undefined ? resolve(REPO_ROOT, path) : resolve(dataDir, path.slice('data/'.length));
    return await readFile(location, { encoding: 'utf8' });
  } catch (error) {
    if (error instanceof Error && 'code' in error && error.code === 'ENOENT') {
      return undefined;
    }
    throw error;
  }
}

/**
 * The repository's own inputs and recorded fixtures, read and never written.
 * `dataDir` stands in for `data/`: a test passes the frozen fixture directory.
 */
export async function readRepositorySnapshot(dataDir?: string): Promise<DryRunSnapshot> {
  return {
    tracked: await readSnapshot(TRACKED_PATH, dataDir),
    dataset: await readSnapshot(DATASET_PATH, dataDir),
    config: await readSnapshot(CONFIG_PATH, dataDir),
    currencies: await readSnapshot(CURRENCIES_PATH, dataDir),
    items: await readSnapshot(CATALOGUE_ITEMS_PATH, dataDir),
    stats: await readSnapshot(CATALOGUE_STATS_PATH, dataDir),
    filters: await readSnapshot(CATALOGUE_FILTERS_PATH, dataDir),
    weights: await readSnapshot(WEIGHTS_PATH, dataDir),
    report: await readSnapshot(REPORT_PATH, dataDir),
    progress: await readSnapshot(PROGRESS_PATH, dataDir),
    fixtures: await readPricingFixtures(FIXTURES_DIR),
  };
}

/** `--at <iso>` overrides the default clock; every other argument is a usage error. */
function parseCliOptions(argv: readonly string[]): DryRunOptions {
  const { values } = parseArgs({ args: argv, options: { at: { type: 'string' } }, strict: true });
  if (values.at === undefined) {
    return {};
  }
  const parsed = IsoTimestampSchema.safeParse(values.at);
  if (!parsed.success) {
    throw new Error(`--at: not an ISO-8601 instant: ${values.at}`);
  }
  return { at: parsed.data };
}

async function main(): Promise<void> {
  const options = parseCliOptions(process.argv.slice(2));
  const report = await dryRun(await readRepositorySnapshot(), options);
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
