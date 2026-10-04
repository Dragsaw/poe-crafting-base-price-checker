import { type ModifierWeight, type WeightsFile, type WeightsPool } from '@poe/contracts';
import { lineSet, type UntrackableReason, untrackableReason } from '@poe/core';

import { absentAsNull } from './lookup-absent-as-null.ts';
import { type ClassSelector, resolveClass, SLOTS, type Slot } from './lookup-weights.ts';

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
