// `pnpm tracked:check`: read-only, exit 1 on any issue. A pass does not confirm a floor is the one
// IN §8 derives: a floor declared too high passes every mechanical check (AD-5).

import { fileURLToPath } from 'node:url';
import { parseArgs } from 'node:util';

import { canonicalKey } from '@poe/contracts';
import type { ConfigFile, FilesystemPort, TrackedEntry, WeightsFile } from '@poe/contracts';
import { crossFileChecks, type UnvalidatedMark } from '@poe/core';

import { loadCatalogueIds } from '../catalogue/catalogue-ids.ts';
import type { CatalogueIds } from '../catalogue/catalogue-ids.ts';
import { readWeightsIds } from '../catalogue/weights-ids.ts';
import { checkCatalogue } from '../chunk/catalogue-check.ts';
import { isInvokedDirectly } from '../entry/is-invoked-directly.ts';
import { TRACKED_PATH } from '../chunk/run-chunk.ts';
import { loadConfig } from '../load-config.ts';
import { DataFileError, describeVersionRefusal, explainTrackedVersion, parseTrackedFile } from '../load-data-file.ts';
import type { DataFileResult } from '../load-data-file.ts';
import { checkPinnedCap } from '../pinned-cap.ts';
import { createNodeFilesystemPort } from '../shell.ts';

export type CheckName = 'schema' | 'pinned-cap' | 'catalogue' | 'cross-file';

export interface CheckIssue {
  readonly check: CheckName;
  /** The issue's location inside `data/tracked.json`, such as `entries.3.prefix`, when it has one. */
  readonly path?: string;
  readonly message: string;
}

export interface CheckStatus {
  readonly check: CheckName;
  /** `skipped` when the schema check failed, so there are no entries to check, or, for `cross-file`, when the weights file is absent. */
  readonly status: 'passed' | 'failed' | 'skipped';
}

/** A crafted entry no pool check covered (IMPLEMENTATION-NOTES §2.8), at its index when it has one. */
export interface CheckUnvalidated extends UnvalidatedMark {
  readonly path?: string;
}

export interface TrackedCheckReport {
  /** Whether every check passed. An unvalidated mark never makes it `false`. */
  readonly ok: boolean;
  readonly checks: readonly CheckStatus[];
  readonly issues: readonly CheckIssue[];
  /** One mark per unvalidated crafted entry, sorted by canonical key. Listed, never a failure. */
  readonly unvalidated: readonly CheckUnvalidated[];
}

/** The inputs of one check, as loaded. */
export interface TrackedCheckInputs {
  /** The text of `data/tracked.json`; `undefined` when the file is absent. */
  readonly tracked: string | undefined;
  readonly config: DataFileResult<ConfigFile>;
  readonly catalogue: DataFileResult<CatalogueIds>;
  /** The parsed `data/weights.json`; `undefined` when the file is absent. */
  readonly weights: DataFileResult<WeightsFile | undefined>;
}

type SchemaResult =
  | { readonly ok: true; readonly entries: readonly TrackedEntry[] }
  | { readonly ok: false; readonly issues: CheckIssue[] };

function checkSchema(text: string | undefined): SchemaResult {
  if (text === undefined) {
    return { ok: false, issues: [{ check: 'schema', message: `${TRACKED_PATH}: the file is absent` }] };
  }
  let data: unknown;
  try {
    data = JSON.parse(text);
  } catch (error) {
    return {
      ok: false,
      issues: [{ check: 'schema', message: `${TRACKED_PATH}: not valid JSON: ${String(error)}` }],
    };
  }
  const result = parseTrackedFile(data);
  if (result.ok) {
    return { ok: true, entries: result.value.entries };
  }
  if (result.reason !== 'invalid') {
    return {
      ok: false,
      issues: [
        {
          check: 'schema',
          path: 'schemaVersion',
          message: `${TRACKED_PATH}: ${describeVersionRefusal(result, explainTrackedVersion)}`,
        },
      ],
    };
  }
  return {
    ok: false,
    issues: result.issues.map((issue) => ({
      check: 'schema',
      path: issue.path.map(String).join('.') || '(root)',
      message: issue.message,
    })),
  };
}

interface CheckOutcome {
  readonly status: CheckStatus['status'];
  readonly issues: readonly CheckIssue[];
}

type PathOf = (entryKey: string) => { readonly path?: string };

function entryPathLookup(entries: readonly TrackedEntry[] | undefined): PathOf {
  const indexByKey = new Map<string, number>();
  const list = entries ?? [];
  for (const [index, entry] of list.entries()) {
    indexByKey.set(canonicalKey(entry), index);
  }
  return (entryKey) => {
    const index = indexByKey.get(entryKey);
    return index === undefined ? {} : { path: `entries.${String(index)}` };
  };
}

function pinnedCapOutcome(
  config: TrackedCheckInputs['config'],
  entries: readonly TrackedEntry[] | undefined,
): CheckOutcome {
  if (!config.ok) {
    return { status: 'failed', issues: [{ check: 'pinned-cap', message: config.error.message }] };
  }
  if (entries === undefined) {
    return { status: 'skipped', issues: [] };
  }
  const cap = checkPinnedCap(entries, config.value);
  return cap.ok
    ? { status: 'passed', issues: [] }
    : { status: 'failed', issues: [{ check: 'pinned-cap', message: cap.error.message }] };
}

function catalogueOutcome(
  catalogue: TrackedCheckInputs['catalogue'],
  entries: readonly TrackedEntry[] | undefined,
  pathOf: PathOf,
): CheckOutcome {
  if (!catalogue.ok) {
    return { status: 'failed', issues: [{ check: 'catalogue', message: catalogue.error.message }] };
  }
  if (entries === undefined) {
    return { status: 'skipped', issues: [] };
  }
  const { records } = checkCatalogue(entries, [], catalogue.value);
  return {
    status: records.length === 0 ? 'passed' : 'failed',
    issues: records.map((record) => ({
      check: 'catalogue',
      ...pathOf(record.entryKey),
      message:
        `${record.identifierKind} ${record.identifier} is absent from the committed catalogue ` +
        `(entry ${record.entryKey})`,
    })),
  };
}

function markedAt(marks: readonly UnvalidatedMark[], pathOf: PathOf): CheckUnvalidated[] {
  return marks.map((mark) => ({ ...mark, ...pathOf(mark.entryKey) }));
}

function crossFileOutcome(
  weights: TrackedCheckInputs['weights'],
  entries: readonly TrackedEntry[] | undefined,
  pathOf: PathOf,
): CheckOutcome & { readonly unvalidated: readonly CheckUnvalidated[] } {
  if (!weights.ok) {
    return { status: 'failed', issues: [{ check: 'cross-file', message: weights.error.message }], unvalidated: [] };
  }
  if (entries === undefined) {
    return { status: 'skipped', issues: [], unvalidated: [] };
  }
  if (weights.value === undefined) {
    // No check runs without the weights file, but each crafted entry is marked (§2.8).
    return { status: 'skipped', issues: [], unvalidated: markedAt(crossFileChecks(entries, undefined).unvalidated, pathOf) };
  }
  const { failures, unvalidated } = crossFileChecks(entries, weights.value);
  return {
    status: failures.length === 0 ? 'passed' : 'failed',
    issues: failures.map((failure) => ({
      check: 'cross-file',
      ...pathOf(failure.entryKey),
      message: `${failure.check}: ${failure.detail} (entry ${failure.entryKey})`,
    })),
    unvalidated: markedAt(unvalidated, pathOf),
  };
}

/** Pure: the loaded inputs in, the report out. */
export function checkTracked(loaded: TrackedCheckInputs): TrackedCheckReport {
  const schema = checkSchema(loaded.tracked);
  const entries = schema.ok ? schema.entries : undefined;
  const pathOf = entryPathLookup(entries);
  const schemaOutcome: CheckOutcome = schema.ok
    ? { status: 'passed', issues: [] }
    : { status: 'failed', issues: schema.issues };
  const cap = pinnedCapOutcome(loaded.config, entries);
  const catalogue = catalogueOutcome(loaded.catalogue, entries, pathOf);
  const crossFile = crossFileOutcome(loaded.weights, entries, pathOf);

  const outcomes: readonly (readonly [CheckName, CheckOutcome])[] = [
    ['schema', schemaOutcome],
    ['pinned-cap', cap],
    ['catalogue', catalogue],
    ['cross-file', crossFile],
  ];
  const issues = outcomes.flatMap(([, outcome]) => outcome.issues);
  // A mark never moves `ok` (IMPLEMENTATION-NOTES §2.8).
  return {
    ok: issues.length === 0,
    checks: outcomes.map(([check, outcome]) => ({ check, status: outcome.status })),
    issues,
    unvalidated: crossFile.unvalidated,
  };
}

/** The weights file as a value: absent is `undefined`, a refusal is carried rather than thrown. */
async function loadWeights(fs: FilesystemPort): Promise<DataFileResult<WeightsFile | undefined>> {
  try {
    const weights = await readWeightsIds(fs);
    return { ok: true, value: weights.kind === 'present' ? weights.file : undefined };
  } catch (error) {
    if (error instanceof DataFileError) {
      return { ok: false, error };
    }
    throw error;
  }
}

/** Reads the four inputs through `fs`. Reads only; a refusal is carried as a value. */
export async function loadTrackedCheckInputs(fs: FilesystemPort): Promise<TrackedCheckInputs> {
  return {
    tracked: await fs.readTextFile(TRACKED_PATH),
    config: await loadConfig(fs),
    catalogue: await loadCatalogueIds(fs),
    weights: await loadWeights(fs),
  };
}

/** `packages/sync/src/curation/` → the repository root. */
const REPO_ROOT = fileURLToPath(new URL('../../../../', import.meta.url));

/** Prints the report to `out`, returns the exit code; a usage error goes to `err`, exit 1. */
export async function main(
  argv: readonly string[],
  fs: FilesystemPort,
  out: { write(text: string): unknown },
  error_: { write(text: string): unknown },
): Promise<number> {
  try {
    // No arguments: any argument is a usage error.
    parseArgs({ args: [...argv], options: {}, strict: true, allowPositionals: false });
  } catch (error) {
    error_.write(`pnpm tracked:check: ${String(error)}\nusage: pnpm tracked:check\n`);
    return 1;
  }
  const report = checkTracked(await loadTrackedCheckInputs(fs));
  out.write(`${JSON.stringify(report, undefined, 2)}\n`);
  return report.ok ? 0 : 1;
}

if (isInvokedDirectly(import.meta.url)) {
  // `process.exitCode`, not `process.exit(1)`: an immediate exit truncates a
  // piped write.
  try {
    process.exitCode = await main(process.argv.slice(2), createNodeFilesystemPort(REPO_ROOT), process.stdout, process.stderr);
  } catch (error) {
    process.stderr.write(`pnpm tracked:check: ${String(error)}\n`);
    process.exitCode = 1;
  }
}
