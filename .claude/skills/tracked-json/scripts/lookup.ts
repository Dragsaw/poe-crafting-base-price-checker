/** `pnpm tracked:lookup`: read-only JSON; `core` owns the interval and line set. */

import { readFileSync } from 'node:fs';
import nodePath from 'node:path';
import { fileURLToPath } from 'node:url';

import { type WeightsFile } from '@poe/contracts';

import { isInvokedDirectly } from '../../../../tools/entry-guard/is-invoked-directly.ts';
import { absentAsNull } from './lookup-absent-as-null.ts';
import { type Command, parseCommand, USAGE } from './lookup-command.ts';
import { LookupError } from './lookup-error.ts';
import { lookupMods, lookupTiers } from './lookup-mods.ts';
import { loadRecipes } from './lookup-recipes.ts';
import { loadWeights, type ReadJson } from './lookup-weights.ts';
import { UsageError } from './usage-error.ts';

export { LookupError } from './lookup-error.ts';
export { UsageError } from './usage-error.ts';
export { type Command, parseCommand, USAGE } from './lookup-command.ts';
export { lookupMods, lookupTiers, type ModifierRow, type TierRow } from './lookup-mods.ts';
export { loadRecipes, RECIPES_PATH } from './lookup-recipes.ts';
export { type ClassSelector, loadWeights, type ReadJson, resolveClass, SLOTS, type Slot, WEIGHTS_PATH } from './lookup-weights.ts';

export const STATS_PATH = 'data/catalogue/stats.json';
export const ITEMS_PATH = 'data/catalogue/items.json';
export const FILTERS_PATH = 'data/catalogue/filters.json';

/** The most matches `stat` and `base` print; the rest are counted in `truncated`. */
export const MATCH_CAP = 50;

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
      return lookupTiers(loadWeights(read), command.statId, { ...command, recipes: loadRecipes(read) });
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

if (isInvokedDirectly(import.meta.url)) {
  try {
    main();
  } catch (error: unknown) {
    process.stderr.write(`pnpm tracked:lookup: ${String(error)}\n`);
    process.exitCode = 1;
  }
}
