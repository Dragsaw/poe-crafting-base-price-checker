// `pnpm sync:dry`: the live composition (`./compose-chunk.ts`) in memory over recorded fixtures,
// writing nothing to disk (AGENT-WORKFLOW.md, NFR-1, NFR-3). Its clock default and the `notBefore`
// it only prints are in AGENT-WORKFLOW.md. An entry with no recorded search lands in `unrecorded`.

import { readFile } from 'node:fs/promises';
import nodePath from 'node:path';
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
import { isInvokedDirectly } from './entry/is-invoked-directly.ts';
import { CONFIG_PATH } from './load-config.ts';
import { loadDataFile } from './load-data-file.ts';
import type { DataFileResult } from './load-data-file.ts';
import { createFixtureHttpPort, readPricingFixtures } from './pricing/fixture-port.ts';
import type { PricingFixtures } from './pricing/fixture-port.ts';
import { CURRENCIES_PATH } from './pricing/load-currencies.ts';
import { searchFixtureName } from './pricing/fixture-names.ts';
import { CATALOGUE_ITEMS_PATH } from './pricing/load-item-types.ts';
import { UnknownClassBaseTypeError } from './pricing/search-body.ts';

/** Fixed fallback clock when no `lastAttemptedAt` and no `--at` (AGENT-WORKFLOW.md). */
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
/** Entry keys skipped for want of a recorded search fixture, in visiting order; only when any. */
  readonly unrecorded?: readonly string[];
  /** Present only when the chunk truncated the pinned set (AD-7). */
  readonly pinnedStarvation?: ChunkStarvation;
/** The real `sync-progress.json`'s `notBefore` (AD-8), surfaced only; it never defers the run. */
  readonly notBefore?: string;
}

/** Every input as text; an absent key is an absent file. */
export interface DryRunSnapshot {
  readonly tracked?: string;
  readonly dataset?: string;
  readonly config?: string;
  readonly currencies?: string;
  readonly items?: string;
  readonly stats?: string;
  readonly filters?: string;
  /** `data/weights.json`; absent is recorded, never refused. */
  readonly weights?: string;
  /** The previous Sync Report, whose records the chunk carries forward. */
  readonly report?: string;
/** The real `sync-progress.json`, read only for `notBefore` (AD-8); never fed into the run. */
  readonly progress?: string;
  readonly fixtures: PricingFixtures;
}

/** Additional dry-run behaviour outside the file snapshot. */
export interface DryRunOptions {
  /** Overrides the default clock (the latest `lastAttemptedAt`, or `DRY_RUN_INSTANT`). */
  readonly at?: string;
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

/** The progress snapshot's `notBefore`, if any; invalid text is a typed refusal naming the file. */
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
  // eslint-disable-next-line unicorn/no-null -- boundary: the printed report keeps `null` for a file the chunk wrote none of, and `undefined` would drop the key from the JSON.
  return text === undefined ? null : schema.parse(JSON.parse(text));
}

// Whether `entry`'s search has a recorded fixture. An unbuildable body counts as recorded,
// so the pricing step handles it as a live run does, with no request.
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
    ...(unrecorded.length > 0 && { unrecorded }),
    ...(outcome.pinnedStarvation !== undefined && { pinnedStarvation: outcome.pinnedStarvation }),
    ...(notBefore !== undefined && { notBefore }),
  };
}

/** `packages/sync/src/` → the repository root and its `fixtures/`. */
const REPO_ROOT = fileURLToPath(new URL('../../../', import.meta.url));
const FIXTURES_DIR = fileURLToPath(new URL('../../../fixtures/', import.meta.url));

/** A read-only snapshot; an absent file is `undefined`. */
async function readSnapshot(path: string, dataDirectory?: string): Promise<string | undefined> {
  try {
    const location = dataDirectory === undefined ? nodePath.resolve(REPO_ROOT, path) : nodePath.resolve(dataDirectory, path.slice('data/'.length));
    return await readFile(location, { encoding: 'utf8' });
  } catch (error) {
    if (error instanceof Error && 'code' in error && error.code === 'ENOENT') {
      return undefined;
    }
    throw error;
  }
}

/** Inputs and recorded fixtures, read and never written; `dataDirectory` stands in for `data/`. */
export async function readRepositorySnapshot(dataDirectory?: string): Promise<DryRunSnapshot> {
  return {
    tracked: await readSnapshot(TRACKED_PATH, dataDirectory),
    dataset: await readSnapshot(DATASET_PATH, dataDirectory),
    config: await readSnapshot(CONFIG_PATH, dataDirectory),
    currencies: await readSnapshot(CURRENCIES_PATH, dataDirectory),
    items: await readSnapshot(CATALOGUE_ITEMS_PATH, dataDirectory),
    stats: await readSnapshot(CATALOGUE_STATS_PATH, dataDirectory),
    filters: await readSnapshot(CATALOGUE_FILTERS_PATH, dataDirectory),
    weights: await readSnapshot(WEIGHTS_PATH, dataDirectory),
    report: await readSnapshot(REPORT_PATH, dataDirectory),
    progress: await readSnapshot(PROGRESS_PATH, dataDirectory),
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
  process.stdout.write(`${JSON.stringify(report, undefined, 2)}\n`);
}

const isInvoked = isInvokedDirectly(import.meta.url);

if (isInvoked) {
  try {
    await main();
  } catch (error) {
    process.stderr.write(`pnpm sync:dry: ${String(error)}\n`);
    // `process.exitCode`, not `process.exit(1)`: an immediate exit truncates a
    // piped stderr write, and a pipe is how an agent runtime captures it.
    process.exitCode = 1;
  }
}
