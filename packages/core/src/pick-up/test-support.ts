import { canonicalKey } from '@poe/contracts';
import type { CraftedRankedRow, PriceTrust, RawRankedRow, RawTrackedEntry, TrackedEntry } from '@poe/contracts';

import { classKeyOf } from '../crafted-classes.ts';
import type { Ranking, UnrankedEntry } from '../rank.ts';
import { observation } from '../rank/test-support.ts';
import { pickUpPurposes } from './pick-up.ts';
import type { PickUpEntry } from './pick-up.ts';

export const RECIPE = 'greater';
const CURRENT: PriceTrust = { verdict: 'current', reasons: [] };
export const BOW_CLASS_FLOOR = 82;
export const BOW_RAW_FLOOR = 70;

export const EMPTY: Ranking = {
  ordering: [],
  unpricedCrafted: [],
  belowThreshold: [],
  noListings: [],
  notYetSynced: [],
  unresolvable: [],
  unrankable: [],
  recipeless: [],
  uncostableRecipes: [],
  pricedInLeague: true,
};

export const rankingOf = (parts: Partial<Ranking>): Ranking => ({ ...EMPTY, ...parts });

export function rawBase(baseTypeId: string, status: TrackedEntry['status'] = 'active'): RawTrackedEntry {
  const base = { kind: 'raw' as const, baseTypeId, categoryId: 'weapon.bow', className: 'Bows', itemLevelMin: BOW_RAW_FLOOR };
  return status === 'pruned' ? { ...base, status, prunedReason: 'no market' } : { ...base, status };
}

export const B = rawBase('Dualstring Bow');

interface ClassRowOptions {
  readonly categoryId?: string;
  readonly className?: string;
  readonly itemLevelMin?: number;
  readonly recipeId?: string;
}

export const UNCOSTABLE = 'uncostable';

/** A crafted row with EV `expectedValue`, or an uncostable recipe's row (state 35). */
export function classRow(expectedValue: number | typeof UNCOSTABLE, options: ClassRowOptions = {}): CraftedRankedRow {
  const { categoryId = 'weapon.bow', className = 'Bows', itemLevelMin = BOW_CLASS_FLOOR, recipeId = RECIPE } = options;
  const isUncostable = expectedValue === UNCOSTABLE;
  const grossPayout = isUncostable ? 1 : Math.max(expectedValue, 0);
  return {
    kind: 'crafted',
    classKey: classKeyOf(categoryId, className),
    categoryId,
    className,
    itemLevelMin,
    recipeId,
    grossPayout,
    craftCost: isUncostable ? { kind: 'uncostable', currencyId: 'divine' } : grossPayout - expectedValue,
    // eslint-disable-next-line unicorn/no-null -- boundary: `RankedRow.ev` is `z.number().nullable()` in the contracts schema.
    ev: isUncostable ? null : expectedValue,
    summands: [],
    combinations: [],
    provenance: 'measured',
    trust: CURRENT,
  };
}

export function rawRow(entry: RawTrackedEntry, priceDivine: number): RawRankedRow {
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
    observation: observation(priceDivine),
    trust: CURRENT,
  };
}

export const unranked = (entry: RawTrackedEntry): UnrankedEntry => ({ entry, entryKey: canonicalKey(entry), trust: CURRENT });

export const white = (purpose: 'craft' | 'sell-raw', itemLevelMin: number): PickUpEntry => ({
  baseTypeId: B.baseTypeId,
  rarity: 'normal',
  itemLevelMin,
  purpose,
});

export const checkRolls = (itemLevelMin = BOW_CLASS_FLOOR): PickUpEntry => ({
  baseTypeId: B.baseTypeId,
  rarity: 'magic',
  itemLevelMin,
  unidentifiedTierMin: 4,
  purpose: 'check-rolls',
});

export interface Recipe {
  readonly id: string | undefined;
}

export const ACTIVE: Recipe = { id: RECIPE };

export const purposesOf = (ranking: Partial<Ranking>, tracked: readonly TrackedEntry[] = [B], recipe: Recipe = ACTIVE) =>
  pickUpPurposes({ ranking: rankingOf(ranking), tracked, recipeId: recipe.id });
