/**
 * `pnpm tracked:lookup stat|base|class|mods|tiers <query>` — the lookup half
 * of the tracked-json skill's loop (lookup → edit → check).
 *
 * Read-only convenience tooling. It reads `data/catalogue/{stats,items,filters}.json`
 * and `data/weights.json` as plain JSON, prints JSON to stdout, and never
 * writes a file or touches the network. It imports only `node:` built-ins, so
 * it walks each file with plain guards rather than the `@poe/contracts`
 * schemas.
 *
 * It derives nothing. `tiers` and `mods` print the weights data verbatim: no
 * interval, no floor. The interval derivation is `core`'s alone
 * (IMPLEMENTATION-NOTES.md §1), and a second copy here is forbidden.
 *
 * - A lookup error (an absent or unreadable file, an unknown or ambiguous
 *   class) prints `{error}` to stdout and exits 1.
 * - A usage error prints the usage text to stderr and exits 1.
 * - Zero matches is not an error.
 */

import { readFileSync, realpathSync } from 'node:fs';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { parseArgs } from 'node:util';

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
      const key = `${groupId}\u0000${type ?? ''}`;
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

function basesOf(weights: unknown): Record<string, unknown> {
  const bases = isRecord(weights) ? weights['bases'] : undefined;
  if (!isRecord(bases)) {
    throw new LookupError(`${WEIGHTS_PATH}: bases: expected an object`);
  }
  return bases;
}

function categoryTexts(filters: unknown): Map<string, string> {
  const texts = new Map<string, string>();
  for (const group of arrayAt(filters, 'result')) {
    for (const filter of arrayAt(group, 'filters')) {
      if (!isRecord(filter) || filter['id'] !== 'category') {
        continue;
      }
      for (const option of arrayAt(filter['option'], 'options')) {
        if (isRecord(option)) {
          const id = stringAt(option, 'id');
          const text = stringAt(option, 'text');
          if (id !== undefined && text !== undefined) {
            texts.set(id, text);
          }
        }
      }
    }
  }
  return texts;
}

/** The item classes of the weights `bases`, matched on className, categoryId or category text. */
export function lookupClass(weights: unknown, filters: unknown, query: string): { matches: ClassMatch[] } {
  const texts = categoryTexts(filters);
  const matches: ClassMatch[] = [];
  for (const [categoryId, classes] of Object.entries(basesOf(weights))) {
    if (!isRecord(classes)) {
      continue;
    }
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
  readonly pools: Record<string, unknown>;
}

/** One class's pools. An unknown class, or one in several categories without `category`, throws. */
export function resolveClass(weights: unknown, selector: ClassSelector): ResolvedClass {
  const found: ResolvedClass[] = [];
  for (const [categoryId, classes] of Object.entries(basesOf(weights))) {
    if (selector.category !== undefined && categoryId !== selector.category) {
      continue;
    }
    const pools = isRecord(classes) ? classes[selector.className] : undefined;
    if (isRecord(pools)) {
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

/** A weights entry, read with guards. Fields are kept verbatim. */
interface WeightsEntry {
  readonly sourceModifierId: string;
  readonly modGroup: string;
  readonly itemLevelMin: number;
  readonly tierLabel: unknown;
  readonly weight: unknown;
  readonly weightSource: unknown;
  readonly lines: readonly unknown[];
}

function entriesOf(pools: Record<string, unknown>, slot: Slot): WeightsEntry[] {
  const entries: WeightsEntry[] = [];
  for (const entry of arrayAt(pools[slot], 'entries')) {
    if (!isRecord(entry)) {
      continue;
    }
    const modGroup = stringAt(entry, 'modGroup');
    const itemLevelMin = entry['itemLevelMin'];
    if (modGroup === undefined || typeof itemLevelMin !== 'number') {
      continue;
    }
    entries.push({
      sourceModifierId: stringAt(entry, 'sourceModifierId') ?? '',
      modGroup,
      itemLevelMin,
      tierLabel: entry['tierLabel'] ?? null,
      weight: entry['weight'] ?? null,
      weightSource: entry['weightSource'] ?? null,
      lines: arrayAt(entry, 'lines'),
    });
  }
  return entries;
}

function byItemLevel(left: WeightsEntry, right: WeightsEntry): number {
  return left.itemLevelMin - right.itemLevelMin;
}

/** The text after the third NUL of `sourceModifierId` (`slot\0modGroup\0itemLevel\0text`). */
export function modText(sourceModifierId: string): string {
  const parts = sourceModifierId.split('\u0000');
  return parts.length > 3 ? parts.slice(3).join('\u0000') : sourceModifierId;
}

export interface ModRow {
  readonly slot: Slot;
  readonly modGroup: string;
  readonly text: string;
  /** Every distinct `statId` across the group's lines, in first-seen order; `null` kept verbatim. */
  readonly statIds: (string | null)[];
  readonly tierCount: number;
  readonly itemLevelMin: { readonly min: number; readonly max: number };
  /** The tier labels, in ascending `itemLevelMin` order. */
  readonly tierLabels: unknown[];
}

/** One row per modGroup of the class and slot (both slots when `slot` is absent). */
export function lookupMods(
  weights: unknown,
  selector: ClassSelector & { readonly slot?: Slot | undefined },
): { categoryId: string; className: string; mods: ModRow[] } {
  const resolved = resolveClass(weights, selector);
  const mods: ModRow[] = [];
  for (const slot of selector.slot === undefined ? SLOTS : [selector.slot]) {
    const groups = new Map<string, WeightsEntry[]>();
    for (const entry of entriesOf(resolved.pools, slot)) {
      const group = groups.get(entry.modGroup);
      if (group === undefined) {
        groups.set(entry.modGroup, [entry]);
      } else {
        group.push(entry);
      }
    }
    for (const [modGroup, group] of groups) {
      const tiers = group.toSorted(byItemLevel);
      const statIds = new Set<string | null>();
      for (const entry of tiers) {
        for (const line of entry.lines) {
          if (isRecord(line)) {
            const statId = line['statId'];
            statIds.add(typeof statId === 'string' ? statId : null);
          }
        }
      }
      const first = tiers[0];
      const last = tiers.at(-1);
      mods.push({
        slot,
        modGroup,
        text: modText(first?.sourceModifierId ?? ''),
        statIds: [...statIds],
        tierCount: tiers.length,
        itemLevelMin: { min: first?.itemLevelMin ?? 0, max: last?.itemLevelMin ?? 0 },
        tierLabels: tiers.map((entry) => entry.tierLabel),
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
}

/** Per slot, every tier of the class with a line carrying `statId`, in ascending `itemLevelMin`. */
export function lookupTiers(
  weights: unknown,
  statId: string,
  selector: ClassSelector,
): { categoryId: string; className: string; statId: string; tiers: TierRow[] } {
  const resolved = resolveClass(weights, selector);
  const tiers: TierRow[] = [];
  for (const slot of SLOTS) {
    const carrying = entriesOf(resolved.pools, slot).filter((entry) =>
      entry.lines.some((line) => isRecord(line) && line['statId'] === statId),
    );
    for (const entry of carrying.toSorted(byItemLevel)) {
      tiers.push({
        slot,
        tierLabel: entry.tierLabel,
        itemLevelMin: entry.itemLevelMin,
        weight: entry.weight,
        weightSource: entry.weightSource,
        modGroup: entry.modGroup,
        lines: entry.lines,
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
    case undefined:
      throw new UsageError('missing <subcommand>');
    default:
      throw new UsageError(`unknown subcommand ${kind}`);
  }
}

/** Reads one data file as plain JSON. An absent or unparseable file throws `LookupError` naming it. */
export type ReadJson = (path: string) => unknown;

/** Runs one command over the files `read` returns. Pure apart from `read`. */
export function runCommand(command: Command, read: ReadJson): unknown {
  switch (command.kind) {
    case 'stat':
      return lookupStat(read(STATS_PATH), command.query);
    case 'base':
      return lookupBase(read(ITEMS_PATH), command.query);
    case 'class':
      return lookupClass(read(WEIGHTS_PATH), read(FILTERS_PATH), command.query);
    case 'mods':
      return lookupMods(read(WEIGHTS_PATH), command);
    case 'tiers':
      return lookupTiers(read(WEIGHTS_PATH), command.statId, command);
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
