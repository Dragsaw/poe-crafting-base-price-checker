/**
 * `pnpm tracked:lookup stat|base|class|mods|tiers <query>` — the lookup half
 * of the tracked-json skill's loop (lookup → edit → check).
 *
 * Read-only convenience tooling. It reads `data/catalogue/{stats,items,filters}.json`
 * as plain JSON and parses `data/weights.json` with `WeightsFileSchema` from
 * `@poe/contracts`, so the typed weights tree is the contract's own. It prints
 * JSON to stdout, and never writes a file or touches the network.
 *
 * It derives no interval and no floor: `tiers` and `mods` print the weights data
 * verbatim. The interval derivation is `core`'s alone (IMPLEMENTATION-NOTES.md §1),
 * and a second copy here is forbidden. The line set and the null-line verdict are
 * `core`'s too (`lineSet`, `untrackableReason`); `mods` and `tiers` call them and
 * keep no copy.
 *
 * - A lookup error (an absent or unreadable file, a weights file that fails
 *   the schema, an unknown or ambiguous class) prints `{error}` to stdout and exits 1.
 * - A usage error prints the usage text to stderr and exits 1.
 * - Zero matches is not an error.
 */

import { readFileSync, realpathSync } from 'node:fs';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { parseArgs } from 'node:util';

import { type ModifierWeight, type WeightsClassPools, type WeightsFile, WeightsFileSchema } from '@poe/contracts';
import { lineSet, type UntrackableReason, untrackableReason } from '@poe/core';

export const STATS_PATH = 'data/catalogue/stats.json';
export const ITEMS_PATH = 'data/catalogue/items.json';
export const FILTERS_PATH = 'data/catalogue/filters.json';
export const WEIGHTS_PATH = 'data/weights.json';

/** The most matches `stat` and `base` print; the rest are counted in `truncated`. */
export const MATCH_CAP = 50;

export const SLOTS = ['prefix', 'suffix'] as const;
export type Slot = (typeof SLOTS)[number];

/** A fault in the data or the query. Printed as `{error}` on stdout, exit 1. */
export class LookupError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'LookupError';
  }
}

/** A malformed command line. Printed with the usage text on stderr, exit 1. */
export class UsageError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'UsageError';
  }
}

export const USAGE = [
  'usage: pnpm tracked:lookup <subcommand> ...',
  '  stat <query>                                   stat ids whose text or id contains <query>',
  '  base <query>                                   base types whose name contains <query>',
  '  class <query>                                  item classes whose className, categoryId or category text contains <query>',
  '  mods --class <className> [--slot prefix|suffix] [--category <categoryId>]',
  '                                                 the mod groups of one class, per slot',
  '  tiers <statId> --class <className> [--category <categoryId>]',
  '                                                 every tier of one class that carries <statId>, verbatim',
].join('\n');

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function arrayAt(value: unknown, key: string): readonly unknown[] {
  if (!isRecord(value)) {
    return [];
  }
  const found = value[key];
  return Array.isArray(found) ? found : [];
}

function stringAt(value: Record<string, unknown>, key: string): string | undefined {
  const found = value[key];
  return typeof found === 'string' ? found : undefined;
}

function contains(haystack: string, needle: string): boolean {
  return haystack.toLowerCase().includes(needle.toLowerCase());
}

function capped<T>(all: readonly T[]): { matches: T[]; truncated: number } {
  return { matches: all.slice(0, MATCH_CAP), truncated: Math.max(0, all.length - MATCH_CAP) };
}

// --- stat ---------------------------------------------------------------------

export interface StatMatch {
  readonly id: string;
  readonly text: string;
  readonly type: string;
}

/** A case-insensitive substring match on each stat's text or id, over every stats group. */
export function lookupStat(stats: unknown, query: string): { matches: StatMatch[]; truncated: number } {
  const found: StatMatch[] = [];
  for (const group of arrayAt(stats, 'result')) {
    for (const entry of arrayAt(group, 'entries')) {
      if (!isRecord(entry)) {
        continue;
      }
      const id = stringAt(entry, 'id');
      const text = stringAt(entry, 'text') ?? '';
      if (id === undefined || !(contains(text, query) || contains(id, query))) {
        continue;
      }
      found.push({ id, text, type: stringAt(entry, 'type') ?? '' });
    }
  }
  return capped(found);
}

// --- base ---------------------------------------------------------------------

export interface BaseMatch {
  readonly type: string;
  readonly group: string;
}

/** Base types: `items.json` entries without a `name` (a named entry is a unique). */
export function lookupBase(items: unknown, query: string): { matches: BaseMatch[]; truncated: number } {
  const found: BaseMatch[] = [];
  const seen = new Set<string>();
  for (const group of arrayAt(items, 'result')) {
    const groupId = isRecord(group) ? (stringAt(group, 'id') ?? '') : '';
    for (const entry of arrayAt(group, 'entries')) {
      if (!isRecord(entry) || entry['name'] !== undefined) {
        continue;
      }
      const type = stringAt(entry, 'type');
      const key = `${groupId}\0${type ?? ''}`;
      if (type === undefined || !contains(type, query) || seen.has(key)) {
        continue;
      }
      seen.add(key);
      found.push({ type, group: groupId });
    }
  }
  return capped(found);
}

// --- class --------------------------------------------------------------------

export interface ClassMatch {
  readonly categoryId: string;
  /** The `category` filter option's text in `filters.json`, or `null` when it has none. */
  readonly categoryText: string | null;
  readonly className: string;
}

/** Parses the weights file with the contract schema. A failure throws `LookupError` naming the file and the first issue. */
export function loadWeights(read: ReadJson): WeightsFile {
  const parsed = WeightsFileSchema.safeParse(read(WEIGHTS_PATH));
  if (parsed.success) {
    return parsed.data;
  }
  const [issue] = parsed.error.issues;
  const where = issue === undefined || issue.path.length === 0 ? '(root)' : issue.path.map(String).join('.');
  throw new LookupError(`${WEIGHTS_PATH}: ${where}: ${issue?.message ?? 'invalid'}`);
}

function categoryTexts(filters: unknown): Map<string, string> {
  const texts = new Map<string, string>();
  for (const group of arrayAt(filters, 'result')) {
    for (const filter of arrayAt(group, 'filters')) {
      if (!isRecord(filter) || filter['id'] !== 'category') {
        continue;
      }
      for (const option of arrayAt(filter['option'], 'options')) {
        if (!isRecord(option)) {
          continue;
        }

        const id = stringAt(option, 'id');
        const text = stringAt(option, 'text');
        if (id !== undefined && text !== undefined) {
          texts.set(id, text);
        }
      }
    }
  }
  return texts;
}

/** The item classes of the weights `bases`, matched on className, categoryId or category text. */
export function lookupClass(weights: WeightsFile, filters: unknown, query: string): { matches: ClassMatch[] } {
  const texts = categoryTexts(filters);
  const matches: ClassMatch[] = [];
  for (const [categoryId, classes] of Object.entries(weights.bases)) {
    const categoryText = texts.get(categoryId) ?? null;
    for (const className of Object.keys(classes)) {
      if (contains(className, query) || contains(categoryId, query) || contains(categoryText ?? '', query)) {
        matches.push({ categoryId, categoryText, className });
      }
    }
  }
  return { matches };
}

// --- mods and tiers -------------------------------------------------------------

export interface ClassSelector {
  readonly className: string;
  readonly category?: string | undefined;
}

interface ResolvedClass {
  readonly categoryId: string;
  readonly className: string;
  readonly pools: WeightsClassPools;
}

/** One class's pools. An unknown class, or one in several categories without `category`, throws. */
export function resolveClass(weights: WeightsFile, selector: ClassSelector): ResolvedClass {
  const found: ResolvedClass[] = [];
  for (const [categoryId, classes] of Object.entries(weights.bases)) {
    if (selector.category !== undefined && categoryId !== selector.category) {
      continue;
    }
    const pools = Object.hasOwn(classes, selector.className) ? classes[selector.className] : undefined;
    if (pools !== undefined) {
      found.push({ categoryId, className: selector.className, pools });
    }
  }
  const [only, ...others] = found;
  if (only === undefined) {
    const where = selector.category === undefined ? '' : ` in category ${selector.category}`;
    throw new LookupError(`${WEIGHTS_PATH}: unknown class ${selector.className}${where}`);
  }
  if (others.length > 0) {
    throw new LookupError(
      `${WEIGHTS_PATH}: class ${selector.className} appears in categories ` +
        `${found.map((each) => each.categoryId).join(', ')}; pass --category`,
    );
  }
  return only;
}

function byItemLevel(left: ModifierWeight, right: ModifierWeight): number {
  return left.itemLevelMin - right.itemLevelMin;
}

export interface ModRow {
  readonly slot: Slot;
  readonly modGroup: string;
  readonly text: string;
  /**
   * The family's line set (`core`'s `lineSet`, IMPLEMENTATION-NOTES.md §1): the non-null `statId`s of
   * its tiers, sorted. More than one means a hybrid. Empty when the tiers carry only `null` lines.
   */
  readonly statIds: string[];
  /** False when any tier of the family is untrackable (the null-line rule); the tiers are in `untrackable`. */
  readonly trackable: boolean;
  /** Each untrackable tier of the family, with `core`'s reason. Empty when `trackable`. */
  readonly untrackable: { readonly tierLabel: unknown; readonly itemLevelMin: number; readonly sourceModifierId: string; readonly reason: UntrackableReason }[];
  readonly tierCount: number;
  readonly itemLevelMin: { readonly min: number; readonly max: number };
  /** The tier labels, in ascending `itemLevelMin` order. */
  readonly tierLabels: unknown[];
}

/** One row per mod family (a modGroup and one statId set) of the class and slot (both slots when `slot` is absent). */
export function lookupMods(
  weights: WeightsFile,
  selector: ClassSelector & { readonly slot?: Slot | undefined },
): { categoryId: string; className: string; mods: ModRow[] } {
  const resolved = resolveClass(weights, selector);
  const mods: ModRow[] = [];
  for (const slot of selector.slot === undefined ? SLOTS : [selector.slot]) {
    const pool = resolved.pools[slot];
    // A family is (modGroup, line set): a modGroup can hold several mod families, so a hybrid
    // is one row and two families of one modGroup are two rows. `core` owns the line set and
    // the null-line rule; nothing here re-derives either.
    const families = new Map<string, { modGroup: string; statIds: string[]; tiers: ModifierWeight[] }>();
    for (const entry of pool.entries) {
      const statIds = [...lineSet(entry)];
      const key = JSON.stringify([entry.modGroup, statIds]);
      const family = families.get(key);
      if (family === undefined) {
        families.set(key, { modGroup: entry.modGroup, statIds, tiers: [entry] });
      } else {
        family.tiers.push(entry);
      }
    }
    for (const { modGroup, statIds, tiers: unsorted } of families.values()) {
      const tiers = unsorted.toSorted(byItemLevel);
      const first = tiers[0];
      const last = tiers.at(-1);
      const untrackable = tiers.flatMap((entry) => {
        const reason = untrackableReason(entry, pool);
        return reason === undefined
          ? []
          : [
              {
                tierLabel: entry.tierLabel ?? null,
                itemLevelMin: entry.itemLevelMin,
                sourceModifierId: entry.sourceModifierId,
                reason,
              },
            ];
      });
      mods.push({
        slot,
        modGroup,
        text: first?.modGroup ?? '',
        statIds,
        trackable: untrackable.length === 0,
        untrackable,
        tierCount: tiers.length,
        itemLevelMin: { min: first?.itemLevelMin ?? 0, max: last?.itemLevelMin ?? 0 },
        tierLabels: tiers.map((entry) => entry.tierLabel ?? null),
      });
    }
  }
  return { categoryId: resolved.categoryId, className: resolved.className, mods };
}

export interface TierRow {
  readonly slot: Slot;
  readonly tierLabel: unknown;
  readonly itemLevelMin: number;
  readonly weight: unknown;
  readonly weightSource: unknown;
  readonly modGroup: string;
  /** The entry's lines, verbatim: each `statId` with its `ranges`. */
  readonly lines: readonly unknown[];
  /** `core`'s line set of the entry: its non-null `statId`s, sorted. */
  readonly lineSet: readonly string[];
  /** `core`'s null-line verdict: the reason the tier is untrackable, or `null` when it is trackable. */
  readonly untrackable: UntrackableReason | null;
}

/** Per slot, every tier of the class with a line carrying `statId`, in ascending `itemLevelMin`. */
export function lookupTiers(
  weights: WeightsFile,
  statId: string,
  selector: ClassSelector,
): { categoryId: string; className: string; statId: string; tiers: TierRow[] } {
  const resolved = resolveClass(weights, selector);
  const tiers: TierRow[] = [];
  for (const slot of SLOTS) {
    const pool = resolved.pools[slot];
    const carrying = pool.entries.filter((entry) => entry.lines.some((line) => line.statId === statId));
    for (const entry of carrying.toSorted(byItemLevel)) {
      tiers.push({
        slot,
        tierLabel: entry.tierLabel ?? null,
        itemLevelMin: entry.itemLevelMin,
        weight: entry.weight,
        weightSource: entry.weightSource,
        modGroup: entry.modGroup,
        lines: entry.lines,
        lineSet: lineSet(entry),
        untrackable: untrackableReason(entry, pool) ?? null,
      });
    }
  }
  return { categoryId: resolved.categoryId, className: resolved.className, statId, tiers };
}

// --- the command line -----------------------------------------------------------

export type Command =
  | { readonly kind: 'stat' | 'base' | 'class'; readonly query: string }
  | { readonly kind: 'mods'; readonly className: string; readonly slot?: Slot; readonly category?: string }
  | { readonly kind: 'tiers'; readonly statId: string; readonly className: string; readonly category?: string };

/** Parses the arguments after the script name. Throws `UsageError`. */
export function parseCommand(argv: readonly string[]): Command {
  let parsed;
  try {
    parsed = parseArgs({
      args: [...argv],
      allowPositionals: true,
      strict: true,
      options: {
        class: { type: 'string' },
        slot: { type: 'string' },
        category: { type: 'string' },
      },
    });
  } catch (error) {
    throw new UsageError(error instanceof Error ? error.message : String(error));
  }
  const { positionals, values } = parsed;
  const [kind, query, ...extra] = positionals;
  if (extra.length > 0) {
    throw new UsageError(`unexpected argument ${extra.join(' ')}`);
  }
  const category = values.category;
  switch (kind) {
    case 'stat':
    case 'base':
    case 'class': {
      if (query === undefined) {
        throw new UsageError(`${kind}: missing <query>`);
      }
      if (values.class !== undefined || values.slot !== undefined || category !== undefined) {
        throw new UsageError(`${kind}: takes no options`);
      }
      return { kind, query };
    }
    case 'mods': {
      if (query !== undefined) {
        throw new UsageError(`mods: unexpected argument ${query}`);
      }
      if (values.class === undefined) {
        throw new UsageError('mods: missing --class <className>');
      }
      const slot = values.slot;
      if (slot !== undefined && slot !== 'prefix' && slot !== 'suffix') {
        throw new UsageError(`mods: --slot must be prefix or suffix, not ${slot}`);
      }
      return {
        kind,
        className: values.class,
        ...(slot === undefined ? {} : { slot }),
        ...(category === undefined ? {} : { category }),
      };
    }
    case 'tiers': {
      if (query === undefined) {
        throw new UsageError('tiers: missing <statId>');
      }
      if (values.class === undefined) {
        throw new UsageError('tiers: missing --class <className>');
      }
      if (values.slot !== undefined) {
        throw new UsageError('tiers: takes no --slot; it prints both slots');
      }
      return {
        kind,
        statId: query,
        className: values.class,
        ...(category === undefined ? {} : { category }),
      };
    }
    case undefined: {
      throw new UsageError('missing <subcommand>');
    }
    default: {
      throw new UsageError(`unknown subcommand ${kind}`);
    }
  }
}

/** Reads one data file as plain JSON. An absent or unparseable file throws `LookupError` naming it. */
export type ReadJson = (path: string) => unknown;

/** Runs one command over the files `read` returns. Pure apart from `read`. */
export function runCommand(command: Command, read: ReadJson): unknown {
  switch (command.kind) {
    case 'stat': {
      return lookupStat(read(STATS_PATH), command.query);
    }
    case 'base': {
      return lookupBase(read(ITEMS_PATH), command.query);
    }
    case 'class': {
      return lookupClass(loadWeights(read), read(FILTERS_PATH), command.query);
    }
    case 'mods': {
      return lookupMods(loadWeights(read), command);
    }
    case 'tiers': {
      return lookupTiers(loadWeights(read), command.statId, command);
    }
  }
}

/** `.claude/skills/tracked-json/scripts/` → the repository root. */
export const REPO_ROOT = fileURLToPath(new URL('../../../../', import.meta.url));

/** A `ReadJson` over the files under `root`. It only reads. */
export function createJsonReader(root: string): ReadJson {
  return (path) => readJsonAt(root, path);
}

function readJsonAt(root: string, path: string): unknown {
  let text: string;
  try {
    text = readFileSync(resolve(root, path), { encoding: 'utf8' });
  } catch (error) {
    if (error instanceof Error && 'code' in error && error.code === 'ENOENT') {
      throw new LookupError(`${path}: the file is absent`);
    }
    throw new LookupError(`${path}: not readable: ${String(error)}`);
  }
  try {
    return JSON.parse(text) as unknown;
  } catch (error) {
    throw new LookupError(`${path}: not valid JSON: ${String(error)}`);
  }
}

function main(): void {
  let command: Command;
  try {
    command = parseCommand(process.argv.slice(2));
  } catch (error) {
    if (error instanceof UsageError) {
      process.stderr.write(`pnpm tracked:lookup: ${error.message}\n${USAGE}\n`);
      process.exitCode = 1;
      return;
    }
    throw error;
  }
  try {
    process.stdout.write(`${JSON.stringify(runCommand(command, createJsonReader(REPO_ROOT)), null, 2)}\n`);
  } catch (error) {
    if (error instanceof LookupError) {
      process.stdout.write(`${JSON.stringify({ error: error.message }, null, 2)}\n`);
      process.exitCode = 1;
      return;
    }
    throw error;
  }
}

/** Node realpaths the main module's URL but not `argv[1]`, so both sides are realpathed. */
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

if (isInvokedDirectly()) {
  try {
    main();
  } catch (error: unknown) {
    process.stderr.write(`pnpm tracked:lookup: ${String(error)}\n`);
    process.exitCode = 1;
  }
}
