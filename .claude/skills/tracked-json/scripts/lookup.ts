/** `pnpm tracked:lookup`: read-only JSON; `core` owns the interval and the line set (IMPLEMENTATION-NOTES.md §1). */

import { readFileSync, realpathSync } from 'node:fs';
import nodePath from 'node:path';
import { fileURLToPath } from 'node:url';
import { parseArgs } from 'node:util';

import { type ModifierWeight, type WeightsClassPools, type WeightsFile, WeightsFileSchema, type WeightsPool } from '@poe/contracts';
import { lineSet, type UntrackableReason, untrackableReason } from '@poe/core';

export const STATS_PATH = 'data/catalogue/stats.json';
export const ITEMS_PATH = 'data/catalogue/items.json';
export const FILTERS_PATH = 'data/catalogue/filters.json';
export const WEIGHTS_PATH = 'data/weights.json';

/** The most matches `stat` and `base` print; the rest are counted in `truncated`. */
export const MATCH_CAP = 50;

export const SLOTS = ['prefix', 'suffix'] as const;
export type Slot = (typeof SLOTS)[number];

// The printed JSON keeps a key for an absent value, which `undefined` would drop.
function absentAsNull<T>(value: T | undefined): T | null {
  // eslint-disable-next-line unicorn/no-null -- boundary: the subcommands print JSON, where an absent value is `null` and a key must stay.
  return value === undefined ? null : value;
}

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

function isContaining(haystack: string, needle: string): boolean {
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
      if (id === undefined || !(isContaining(text, query) || isContaining(id, query))) {
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
    const groupId = idOf(group);
    for (const entry of arrayAt(group, 'entries')) {
      const type = baseTypeOf(entry);
      const key = `${groupId}\0${type ?? ''}`;
      if (type === undefined || !isContaining(type, query) || seen.has(key)) {
        continue;
      }
      seen.add(key);
      found.push({ type, group: groupId });
    }
  }
  return capped(found);
}

function idOf(group: unknown): string {
  return isRecord(group) ? (stringAt(group, 'id') ?? '') : '';
}

function baseTypeOf(entry: unknown): string | undefined {
  return isRecord(entry) && entry['name'] === undefined ? stringAt(entry, 'type') : undefined;
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

function categoryOptions(filters: unknown): unknown[] {
  return arrayAt(filters, 'result').flatMap((group) =>
    arrayAt(group, 'filters').flatMap((filter) =>
      isRecord(filter) && filter['id'] === 'category' ? arrayAt(filter['option'], 'options') : [],
    ),
  );
}

function categoryTexts(filters: unknown): Map<string, string> {
  const texts = new Map<string, string>();
  for (const option of categoryOptions(filters)) {
    if (!isRecord(option)) {
      continue;
    }
    const id = stringAt(option, 'id');
    const text = stringAt(option, 'text');
    if (id !== undefined && text !== undefined) {
      texts.set(id, text);
    }
  }
  return texts;
}

/** The item classes of the weights `bases`, matched on className, categoryId or category text. */
export function lookupClass(weights: WeightsFile, filters: unknown, query: string): { matches: ClassMatch[] } {
  const texts = categoryTexts(filters);
  const matches: ClassMatch[] = [];
  for (const [categoryId, classes] of Object.entries(weights.bases)) {
    const categoryText = absentAsNull(texts.get(categoryId));
    for (const className of Object.keys(classes)) {
      if (isContaining(className, query) || isContaining(categoryId, query) || isContaining(categoryText ?? '', query)) {
        matches.push({ categoryId, categoryText, className });
      }
    }
  }
  return { matches };
}

// --- mods and tiers -------------------------------------------------------------

export interface ClassSelector {
  readonly className: string;
  readonly category?: string;
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

export interface ModifierRow {
  readonly slot: Slot;
  readonly modGroup: string;
  readonly text: string;
  /** The family's line set (`core`'s `lineSet`, IMPLEMENTATION-NOTES.md §1); more than one means a hybrid. */
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
  selector: ClassSelector & { readonly slot?: Slot },
): { categoryId: string; className: string; mods: ModifierRow[] } {
  const resolved = resolveClass(weights, selector);
  const slots = selector.slot === undefined ? SLOTS : [selector.slot];
  const mods: ModifierRow[] = [];
  for (const slot of slots) {
    const pool = resolved.pools[slot];
    for (const family of modifierFamilies(pool.entries).values()) {
      mods.push(modifierRow(slot, family, pool));
    }
  }
  return { categoryId: resolved.categoryId, className: resolved.className, mods };
}

interface ModifierFamily {
  readonly modGroup: string;
  readonly statIds: string[];
  readonly tiers: ModifierWeight[];
}

// A family is (modGroup, line set): a hybrid is one row, two families of one modGroup are two. `core` owns the line set.
function modifierFamilies(entries: readonly ModifierWeight[]): Map<string, ModifierFamily> {
  const families = new Map<string, ModifierFamily>();
  for (const entry of entries) {
    const statIds = [...lineSet(entry)];
    const key = JSON.stringify([entry.modGroup, statIds]);
    const family = families.get(key);
    if (family === undefined) {
      families.set(key, { modGroup: entry.modGroup, statIds, tiers: [entry] });
    } else {
      family.tiers.push(entry);
    }
  }
  return families;
}

function modifierRow(slot: Slot, family: ModifierFamily, pool: WeightsPool): ModifierRow {
  const tiers = family.tiers.toSorted(byItemLevel);
  const first = tiers[0];
  const last = tiers.at(-1);
  const untrackable = tiers.flatMap((entry) => {
    const reason = untrackableReason(entry, pool);
    return reason === undefined
      ? []
      : {
          tierLabel: absentAsNull(entry.tierLabel),
          itemLevelMin: entry.itemLevelMin,
          sourceModifierId: entry.sourceModifierId,
          reason,
        };
  });
  return {
    slot,
    modGroup: family.modGroup,
    text: first?.modGroup ?? '',
    statIds: family.statIds,
    trackable: untrackable.length === 0,
    untrackable,
    tierCount: tiers.length,
    itemLevelMin: { min: first?.itemLevelMin ?? 0, max: last?.itemLevelMin ?? 0 },
    tierLabels: tiers.map((entry) => absentAsNull(entry.tierLabel)),
  };
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
        tierLabel: absentAsNull(entry.tierLabel),
        itemLevelMin: entry.itemLevelMin,
        weight: entry.weight,
        weightSource: entry.weightSource,
        modGroup: entry.modGroup,
        lines: entry.lines,
        lineSet: lineSet(entry),
        untrackable: absentAsNull(untrackableReason(entry, pool)),
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

function parseOptions(argv: readonly string[]) {
  try {
    return parseArgs({
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
}

/** Parses the arguments after the script name. Throws `UsageError`. */
export function parseCommand(argv: readonly string[]): Command {
  const { positionals, values } = parseOptions(argv);
  const [kind, query, ...extra] = positionals;
  if (extra.length > 0) {
    throw new UsageError(`unexpected argument ${extra.join(' ')}`);
  }
  switch (kind) {
    case 'stat':
    case 'base':
    case 'class': {
      return parseQueryCommand(kind, query, values);
    }
    case 'mods': {
      return parseModsCommand(query, values);
    }
    case 'tiers': {
      return parseTiersCommand(query, values);
    }
    case undefined: {
      throw new UsageError('missing <subcommand>');
    }
    default: {
      throw new UsageError(`unknown subcommand ${kind}`);
    }
  }
}

type OptionValues = ReturnType<typeof parseOptions>['values'];

function parseQueryCommand(kind: 'stat' | 'base' | 'class', query: string | undefined, values: OptionValues): Command {
  if (query === undefined) {
    throw new UsageError(`${kind}: missing <query>`);
  }
  if (values.category !== undefined || values.class !== undefined || values.slot !== undefined) {
    throw new UsageError(`${kind}: takes no options`);
  }
  return { kind, query };
}

function parseModsCommand(query: string | undefined, values: OptionValues): Command {
  if (query !== undefined) {
    throw new UsageError(`mods: unexpected argument ${query}`);
  }
  if (values.class === undefined) {
    throw new UsageError('mods: missing --class <className>');
  }
  const { category, slot } = values;
  if (slot !== undefined && slot !== 'prefix' && slot !== 'suffix') {
    throw new UsageError(`mods: --slot must be prefix or suffix, not ${slot}`);
  }
  return {
    kind: 'mods',
    className: values.class,
    ...(slot !== undefined && { slot }),
    ...(category !== undefined && { category }),
  };
}

function parseTiersCommand(query: string | undefined, values: OptionValues): Command {
  if (query === undefined) {
    throw new UsageError('tiers: missing <statId>');
  }
  if (values.class === undefined) {
    throw new UsageError('tiers: missing --class <className>');
  }
  if (values.slot !== undefined) {
    throw new UsageError('tiers: takes no --slot; it prints both slots');
  }
  const { category } = values;
  return {
    kind: 'tiers',
    statId: query,
    className: values.class,
    ...(category !== undefined && { category }),
  };
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
    text = readFileSync(nodePath.resolve(root, path), { encoding: 'utf8' });
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
    const result = runCommand(command, createJsonReader(REPO_ROOT));
    process.stdout.write(`${JSON.stringify(result, undefined, 2)}\n`);
  } catch (error) {
    if (error instanceof LookupError) {
      process.stdout.write(`${JSON.stringify({ error: error.message }, undefined, 2)}\n`);
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
    return realpathSync(nodePath.resolve(entry)) === realpathSync(fileURLToPath(import.meta.url));
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
