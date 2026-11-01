import { canonicalKey, compareCanonicalKeys, plainClassBaseTypeOf } from '@poe/contracts';
import type { RawTrackedEntry, TrackedEntry } from '@poe/contracts';

import { isJewelCategory } from '../craft-cost.ts';
import { classKeyOf } from '../crafted-classes.ts';
import type { Ranking } from '../rank.ts';

export type PickUpPurpose = 'craft' | 'sell-raw' | 'check-rolls';

/** One drop the Pick-up Filter names (FR-36). It never carries a Combination, a modifier or a price (FR-35). */
export interface PickUpEntry {
  readonly baseTypeId: string;
  readonly rarity: 'normal' | 'magic';
  readonly itemLevelMin: number;
  /** Set when a higher-floor Raw Base of this base type owns the drops above it (FR-36). */
  readonly itemLevelMax?: number;
  readonly unidentifiedTierMin?: 4;
  readonly purpose: PickUpPurpose;
}

/** The threshold reaches this function only through `ranking`, so the filter cannot judge a second time (FR-35). */
export interface PickUpInput {
  readonly ranking: Ranking;
  readonly tracked: readonly TrackedEntry[];
  /** The active Craft Recipe; `undefined` when none is published (state 43). */
  readonly recipeId: string | undefined;
}

/** A class with an EV under the active recipe, and the floor its crafted entries share (AD-17). */
interface ClassValue {
  readonly classKey: string;
  readonly categoryId: string;
  readonly className: string;
  readonly expectedValue: number;
  readonly itemLevelMin: number;
}

interface KeyedEntry {
  readonly key: string;
  readonly entry: PickUpEntry;
}

const RARITY_ORDER = { normal: 0, magic: 1 } as const;

/** Only the active recipe's rows in `ordering` carry an EV; `null` is uncostable (state 35). */
function classValuesOf(ranking: Ranking, recipeId: string | undefined): Map<string, ClassValue> {
  const byClass = new Map<string, ClassValue>();
  for (const row of ranking.ordering) {
    if (row.kind !== 'crafted' || row.recipeId !== recipeId || row.ev === null) {
      continue;
    }
    const { classKey, categoryId, className, itemLevelMin } = row;
    byClass.set(classKey, { classKey, categoryId, className, expectedValue: row.ev, itemLevelMin });
  }
  return byClass;
}

/** raw value(B) as the ranking truncated it (FR-3); an absent key is an unpriced base, never zero (FR-9). */
function rawValuesOf(ranking: Ranking): Map<string, number> {
  const values = new Map<string, number>();
  for (const row of ranking.ordering) {
    if (row.kind === 'raw') {
      values.set(row.entryKey, row.ev);
    }
  }
  for (const row of ranking.belowThreshold) {
    values.set(row.entryKey, 0);
  }
  return values;
}

const isWorthCrafting = (value: ClassValue | undefined): value is ClassValue =>
  value !== undefined && value.expectedValue > 0;

/** FR-36's white rule; an undefined raw value is an unpriced base (FR-9). */
function whitePurpose(value: ClassValue | undefined, rawValue: number | undefined): PickUpPurpose | undefined {
  if (isWorthCrafting(value) && (rawValue === undefined || rawValue < value.expectedValue)) {
    return 'craft';
  }
  return rawValue !== undefined && rawValue > 0 ? 'sell-raw' : undefined;
}

function rawBaseEntries(
  entry: RawTrackedEntry,
  value: ClassValue | undefined,
  rawValue: number | undefined,
  itemLevelMax: number | undefined,
): PickUpEntry[] {
  const { baseTypeId } = entry;
  const classFloor = Math.max(entry.itemLevelMin, value?.itemLevelMin ?? entry.itemLevelMin);
  const out: PickUpEntry[] = [];
  const purpose = whitePurpose(value, rawValue);
  if (purpose !== undefined) {
    const itemLevelMin = purpose === 'craft' ? classFloor : entry.itemLevelMin;
    out.push({ baseTypeId, rarity: 'normal', itemLevelMin, purpose });
  }
  if (isWorthCrafting(value)) {
    out.push({ baseTypeId, rarity: 'magic', itemLevelMin: classFloor, unidentifiedTierMin: 4, purpose: 'check-rolls' });
  }
  return itemLevelMax === undefined
    ? out
    : out.filter((pickUp) => pickUp.itemLevelMin <= itemLevelMax).map((pickUp) => ({ ...pickUp, itemLevelMax }));
}

/** Each Raw Base's last item level before the next higher floor of its base type (FR-36); absent for the highest. */
function itemLevelMaxByKey(raws: readonly RawTrackedEntry[]): Map<string, number> {
  const floorsByBase = new Map<string, number[]>();
  for (const entry of raws) {
    floorsByBase.set(entry.baseTypeId, [...(floorsByBase.get(entry.baseTypeId) ?? []), entry.itemLevelMin]);
  }
  const byKey = new Map<string, number>();
  for (const entry of raws) {
    const higher = (floorsByBase.get(entry.baseTypeId) ?? []).filter((floor) => floor > entry.itemLevelMin);
    if (higher.length > 0) {
      byKey.set(canonicalKey(entry), Math.min(...higher) - 1);
    }
  }
  return byKey;
}

function jewelKindEntry(value: ClassValue): PickUpEntry {
  return {
    baseTypeId: plainClassBaseTypeOf(value.className),
    rarity: 'magic',
    itemLevelMin: value.itemLevelMin,
    purpose: 'check-rolls',
  };
}

const compareKeyed = (left: KeyedEntry, right: KeyedEntry): number =>
  compareCanonicalKeys(left.key, right.key) || RARITY_ORDER[left.entry.rarity] - RARITY_ORDER[right.entry.rarity];

/** The one FR-36 evaluator (AD-31): each named drop with exactly one purpose, by canonical key then rarity. */
export function pickUpPurposes(input: PickUpInput): readonly PickUpEntry[] {
  const { ranking, tracked, recipeId } = input;
  const byClass = classValuesOf(ranking, recipeId);
  const rawValues = rawValuesOf(ranking);
  const raws = tracked.filter((entry): entry is RawTrackedEntry => entry.kind === 'raw' && entry.status !== 'pruned');
  const maxByKey = itemLevelMaxByKey(raws);
  const keyed: KeyedEntry[] = [];

  for (const entry of raws) {
    const key = canonicalKey(entry);
    const value = byClass.get(classKeyOf(entry.categoryId, entry.className));
    const entries = rawBaseEntries(entry, value, rawValues.get(key), maxByKey.get(key));
    keyed.push(...entries.map((pickUp) => ({ key, entry: pickUp })));
  }

  for (const value of byClass.values()) {
    if (isJewelCategory(value.categoryId) && isWorthCrafting(value)) {
      keyed.push({ key: value.classKey, entry: jewelKindEntry(value) });
    }
  }

  return keyed.toSorted(compareKeyed).map(({ entry }) => entry);
}
