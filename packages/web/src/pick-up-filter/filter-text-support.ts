import { canonicalKey, type CraftedRankedRow, type PriceTrust, type RawRankedRow, type RawTrackedEntry, type TrackedEntry } from '@poe/contracts';
import { classKeyOf, pickUpPurposes, type PickUpEntry, type Ranking } from '@poe/core';

import { TEST_LEAGUE } from '../test-support/artifact-server';

export const BASE_FILTER = 'Base.filter';
const RECIPE = 'greater';
const CURRENT: PriceTrust = { verdict: 'current', reasons: [] };

/** Each `Show` block's lines, without its trailing blank line. */
export const blocksOf = (text: string): string[][] =>
  text
    .split('\n\n')
    .filter((chunk) => chunk.startsWith('Show'))
    .map((chunk) => chunk.split('\n'));

/** The game's `BaseType` predicate: `==` is an exact match on a quoted name, no operator is a substring match. */
export function isCaughtBy(block: readonly string[], baseName: string): boolean {
  const match = /^\tBaseType (==\s)?(.*)$/.exec(block.find((line) => line.startsWith('\tBaseType ')) ?? '');
  if (match === null) {
    return false;
  }
  const names = (match[2] ?? '')
    .matchAll(/"([^"]*)"/g)
    .map((name) => name[1] ?? '')
    .toArray();
  return names.some((name) => (match[1] === undefined ? baseName.includes(name) : baseName === name));
}

export function classRow(categoryId: string, className: string, expectedValue: number, itemLevelMin: number): CraftedRankedRow {
  return {
    kind: 'crafted',
    classKey: classKeyOf(categoryId, className),
    categoryId,
    className,
    itemLevelMin,
    recipeId: RECIPE,
    grossPayout: expectedValue + 0.5,
    craftCost: 0.5,
    ev: expectedValue,
    summands: [],
    combinations: [],
    provenance: 'measured',
    trust: CURRENT,
  };
}

export function rawRow(entry: RawTrackedEntry, priceDivine: number): RawRankedRow {
  const league = TEST_LEAGUE;
  return {
    kind: 'raw',
    entryKey: canonicalKey(entry),
    baseTypeId: entry.baseTypeId,
    categoryId: entry.categoryId,
    className: entry.className,
    itemLevelMin: entry.itemLevelMin,
    status: 'active',
    ev: priceDivine,
    craftCost: 0,
    observation: {
      league,
      observedAt: '2026-10-31T10:00:00Z',
      priceDivine,
      sampleSize: 10,
      exchangeObservation: { currencyId: 'exalted', rate: 0.0042, source: 'in-game exchange, by hand', league, asOf: '2026-10-30T08:00:00Z' },
    },
    trust: CURRENT,
  };
}

const rankingOf = (ordering: Ranking['ordering']): Ranking => ({
  ordering,
  unpricedCrafted: [],
  belowThreshold: [],
  noListings: [],
  notYetSynced: [],
  unresolvable: [],
  unrankable: [],
  recipeless: [],
  uncostableRecipes: [],
  pricedInLeague: true,
});

export const purposesOf = (ordering: Ranking['ordering'], tracked: readonly TrackedEntry[]): readonly PickUpEntry[] =>
  pickUpPurposes({ ranking: rankingOf(ordering), tracked, recipeId: RECIPE });
