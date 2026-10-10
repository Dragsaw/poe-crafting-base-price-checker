// `pnpm tracked:check`: read-only, exit 1 on any issue. A pass does not confirm a floor is the one
// The floor derives: a floor declared too high passes every mechanical check (AD-5).

import { fileURLToPath } from 'node:url';
import { parseArgs } from 'node:util';

import { canonicalKey, compareByCodeUnit, compareCanonicalKeys, parseEnvelope, RecipesFileSchema } from '@poe/contracts';
import type { ConfigFile, CraftedTrackedEntry, FilesystemPort, RecipesFile, TrackedEntry, WeightsFile } from '@poe/contracts';
import { craftedClassesOf, crossFileChecks, isPoolCheckable, poolOf, recipeReach, type Slot, type UnvalidatedMark } from '@poe/core';

import { loadCatalogueIds } from '../catalogue/catalogue-ids.ts';
import type { CatalogueIds } from '../catalogue/catalogue-ids.ts';
import { readWeightsIds } from '../catalogue/weights-ids.ts';
import { checkCatalogue } from '../chunk/catalogue-check.ts';
import { isInvokedDirectly } from '../entry/is-invoked-directly.ts';
import { TRACKED_PATH } from '../chunk/run-chunk.ts';
import { loadConfig } from '../load-config.ts';
import { DataFileError, describeVersionRefusal, explainTrackedVersion, loadDataFile, parseTrackedFile } from '../load-data-file.ts';
import type { DataFileResult } from '../load-data-file.ts';
import { checkPinnedCap } from '../pinned-cap.ts';
import { createNodeFilesystemPort } from '../shell.ts';

export type CheckName = 'schema' | 'pinned-cap' | 'catalogue' | 'cross-file' | 'recipe-reach';

export const RECIPES_PATH = 'data/recipes.json';

export interface CheckIssue {
  readonly check: CheckName;
  /** The issue's location inside `data/tracked.json`, such as `entries.3.prefix`, when it has one. */
  readonly path?: string;
  readonly message: string;
}

export interface CheckStatus {
  readonly check: CheckName;
  /**
   * `skipped` when the schema check failed, so there are no entries to check; for `cross-file`, when the weights file
   * is absent; for `recipe-reach`, when the recipes file is absent or the weights file is absent or refused.
   */
  readonly status: 'passed' | 'failed' | 'skipped';
}

/** A crafted entry no pool check covered, at its index when it has one. */
export interface CheckUnvalidated extends UnvalidatedMark {
  readonly path?: string;
}

/** One `(entry, recipe)` pair that AD-17 makes unreachable, once per slot that `recipeReach` names. */
export interface CheckUnreachable {
  readonly entryKey: string;
  readonly recipeId: string;
  readonly slot: Slot;
  readonly path?: string;
}

export interface TrackedCheckReport {
  /** Whether every check passed and nothing is unreachable. An unvalidated mark never makes it `false`. */
  readonly ok: boolean;
  readonly checks: readonly CheckStatus[];
  readonly issues: readonly CheckIssue[];
  /** One mark per unvalidated crafted entry, sorted by canonical key. Listed, never a failure. */
  readonly unvalidated: readonly CheckUnvalidated[];
  /** Every unreachable pair, by canonical key, then recipe, then slot. A non-empty list makes `ok` `false`. */
  readonly unreachable: readonly CheckUnreachable[];
}

/** The inputs of one check, as loaded. */
export interface TrackedCheckInputs {
  /** The text of `data/tracked.json`; `undefined` when the file is absent. */
  readonly tracked: string | undefined;
  readonly config: DataFileResult<ConfigFile>;
  readonly catalogue: DataFileResult<CatalogueIds>;
  /** The parsed `data/weights.json`; `undefined` when the file is absent. */
  readonly weights: DataFileResult<WeightsFile | undefined>;
  /** The parsed `data/recipes.json`; `undefined` when the file is absent. */
  readonly recipes: DataFileResult<RecipesFile | undefined>;
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
    // No check runs without the weights file, but each crafted entry is marked.
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

function classUnreachable(members: readonly CraftedTrackedEntry[], weights: WeightsFile, recipes: RecipesFile, pathOf: PathOf): CheckUnreachable[] {
  const [first] = members;
  const lookup = first === undefined ? undefined : poolOf(weights, first.categoryId, first.className);
  // An absent class or a partial pool is an unvalidated mark already; containment is not defined there.
  if (lookup?.ok !== true || !isPoolCheckable(lookup.pools)) {
    return [];
  }
  const found: CheckUnreachable[] = [];
  for (const entry of members) {
    const entryKey = canonicalKey(entry);
    for (const recipe of recipes.recipes) {
      const reach = recipeReach(lookup.pools, entry, recipe.modifierLevelMin);
      if (!reach.reached) {
        found.push(...reach.slots.map((slot) => ({ entryKey, recipeId: recipe.id, slot, ...pathOf(entryKey) })));
      }
    }
  }
  return found;
}

function unreachableOf(
  entries: readonly TrackedEntry[],
  weights: WeightsFile,
  recipes: RecipesFile,
  pathOf: PathOf,
): CheckUnreachable[] {
  return craftedClassesOf(entries)
    .values()
    .flatMap((members) => classUnreachable(members, weights, recipes, pathOf))
    .toArray()
    .toSorted(
      (left, right) =>
        compareCanonicalKeys(left.entryKey, right.entryKey) ||
        compareByCodeUnit(left.recipeId, right.recipeId) ||
        compareByCodeUnit(left.slot, right.slot),
    );
}

function recipeReachOutcome(
  loaded: Pick<TrackedCheckInputs, 'recipes' | 'weights'>,
  entries: readonly TrackedEntry[] | undefined,
  pathOf: PathOf,
): CheckOutcome & { readonly unreachable: readonly CheckUnreachable[] } {
  const { recipes, weights } = loaded;
  if (!recipes.ok) {
    return { status: 'failed', issues: [{ check: 'recipe-reach', message: recipes.error.message }], unreachable: [] };
  }
  if (entries === undefined || recipes.value === undefined || !weights.ok || weights.value === undefined) {
    return { status: 'skipped', issues: [], unreachable: [] };
  }
  const unreachable = unreachableOf(entries, weights.value, recipes.value, pathOf);
  return { status: unreachable.length === 0 ? 'passed' : 'failed', issues: [], unreachable };
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
  const reach = recipeReachOutcome(loaded, entries, pathOf);

  const outcomes: readonly (readonly [CheckName, CheckOutcome])[] = [
    ['schema', schemaOutcome],
    ['pinned-cap', cap],
    ['catalogue', catalogue],
    ['cross-file', crossFile],
    ['recipe-reach', reach],
  ];
  const issues = outcomes.flatMap(([, outcome]) => outcome.issues);
  // An `unvalidated` mark never moves `ok`.
  return {
    ok: issues.length === 0 && reach.unreachable.length === 0,
    checks: outcomes.map(([check, outcome]) => ({ check, status: outcome.status })),
    issues,
    unvalidated: crossFile.unvalidated,
    unreachable: reach.unreachable,
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

/** The recipes file as a value: absent is `undefined`, a refusal is carried. */
async function loadRecipes(fs: FilesystemPort): Promise<DataFileResult<RecipesFile | undefined>> {
  const result = await loadDataFile(fs, RECIPES_PATH, (data) => parseEnvelope(RecipesFileSchema, data));
  return !result.ok && result.error.reason === 'absent' ? { ok: true, value: undefined } : result;
}

/** Reads the five inputs through `fs`. Reads only; a refusal is carried as a value. */
export async function loadTrackedCheckInputs(fs: FilesystemPort): Promise<TrackedCheckInputs> {
  const [tracked, config, catalogue, weights, recipes] = await Promise.all([
    fs.readTextFile(TRACKED_PATH),
    loadConfig(fs),
    loadCatalogueIds(fs),
    loadWeights(fs),
    loadRecipes(fs),
  ]);
  return { tracked, config, catalogue, weights, recipes };
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
