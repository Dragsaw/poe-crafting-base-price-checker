import {
  canonicalKey,
  canonicalKeyElements,
  type CraftedTrackedEntry,
  type ModifierReference,
  type ModifierWeight,
  type TrackedEntry,
  TrackedEntrySchema,
  type TrackedFile,
  TrackedFileSchema,
  type WeightsFile,
  type WeightsPool,
} from '@poe/contracts';
import { contains, CRAFTING_ITEM_LEVELS, lineSet, needs, ownInterval, poolOf, statIds, untrackable } from '@poe/core';

/** What one run changed, by count; `noT2` names each T1-only reference left without a sibling. */
export interface RegenerateSummary {
  readonly split: number;
  readonly sibling: number;
  readonly rebandedSingle: number;
  readonly noT2: string[];
  readonly droppedAsDuplicate: number;
  readonly droppedAsTombstone: number;
}

export interface RegenerateResult {
  /** The whole file: `schemaVersion` and every passed-through entry as read, byte for byte. */
  readonly file: TrackedFile;
  readonly summary: RegenerateSummary;
}

const LOW_LEVEL = Math.min(...CRAFTING_ITEM_LEVELS);

interface Counts {
  split: number;
  sibling: number;
  rebandedSingle: number;
  noT2: string[];
}

function isSameList(left: readonly string[], right: readonly string[]): boolean {
  return left.length === right.length && left.every((each, index) => each === right[index]);
}

function isTrackable(tier: ModifierWeight, pool: WeightsPool): boolean {
  return tier.weight > 0 && !untrackable(tier, pool);
}

function ownEdges(tier: ModifierWeight, statId: string, pool: WeightsPool): { valueMin: number; valueMax: number } {
  const line = tier.lines.find((each) => each.statId === statId);
  if (line === undefined) {
    throw new Error(`tier ${tier.sourceModifierId} has no line for ${statId}`);
  }
  const own = ownInterval(line, tier, pool);
  return { valueMin: own.min, valueMax: own.max };
}

/** The reference banded on one tier's own interval (AD-11); valueless hybrid lines stay valueless. */
function referenceOn(reference: ModifierReference, tier: ModifierWeight, pool: WeightsPool): ModifierReference {
  switch (reference.kind) {
    case 'banded': {
      return { kind: 'banded', statId: reference.statId, ...ownEdges(tier, reference.statId, pool), acceptedTier: tier.tierLabel };
    }
    case 'hybrid': {
      return {
        kind: 'hybrid',
        lines: reference.lines.map((line) => ('valueMin' in line ? { statId: line.statId, ...ownEdges(tier, line.statId, pool) } : { statId: line.statId })),
        acceptedTier: tier.tierLabel,
      };
    }
    case 'valueless': {
      return reference;
    }
  }
}

function containedTiers(reference: ModifierReference, pool: WeightsPool, where: string): ModifierWeight[] {
  const tiers = pool.entries
    .filter((tier) => isTrackable(tier, pool) && contains(reference, tier, pool))
    .toSorted((left, right) => right.itemLevelMin - left.itemLevelMin);
  const unlabelled = tiers.find((tier) => tier.tierLabel === undefined);
  if (unlabelled !== undefined) {
    throw new Error(`${where}: contained tier ${unlabelled.sourceModifierId} has no tierLabel`);
  }
  return tiers;
}

/** The references one source reference becomes (FR-22): one per contained tier, plus a T2 sibling. */
function variantsOf(reference: ModifierReference, pool: WeightsPool, where: string, counts: Counts): ModifierReference[] {
  if (reference.kind === 'valueless') {
    return [reference];
  }
  const tiers = containedTiers(reference, pool, where);
  const [only] = tiers;
  if (only === undefined) {
    return [reference];
  }
  if (tiers.length > 1) {
    counts.split += 1;
    return tiers.map((tier) => referenceOn(reference, tier, pool));
  }
  const single = referenceOn(reference, only, pool);
  if (only.tierLabel === 'T1' && only.itemLevelMin > LOW_LEVEL) {
    const family = statIds(reference);
    const siblings = pool.entries.filter((tier) => isTrackable(tier, pool) && tier.tierLabel === 'T2' && isSameList(lineSet(tier), family));
    if (siblings.length > 0) {
      counts.sibling += 1;
      return [single, ...siblings.map((tier) => referenceOn(reference, tier, pool))];
    }
    counts.noT2.push(where);
  }
  if (JSON.stringify(single) !== JSON.stringify(reference)) {
    counts.rebandedSingle += 1;
  }
  return [single];
}

/** Class and references without floor or label: what a pruned tombstone forbids reviving. */
function combinationKey(entry: TrackedEntry): string {
  const elements = canonicalKeyElements(TrackedEntrySchema.parse(entry));
  return JSON.stringify(elements[0] === 'crafted' ? [elements[1], elements[2], elements[4], elements[5]] : elements);
}

function isSummedPair(entry: CraftedTrackedEntry): boolean {
  const suffixIds = statIds(entry.suffix);
  return statIds(entry.prefix).some((statId) => suffixIds.includes(statId));
}

/** The canonical key over the parsed entry: the schema sorts hybrid lines, the file need not. */
function keyOf(entry: TrackedEntry): string {
  return canonicalKey(TrackedEntrySchema.parse(entry));
}

/** Validates without parsing, so each entry keeps its bytes, hybrid line order included. */
export function isTrackedFile(value: unknown): value is TrackedFile {
  return TrackedFileSchema.safeParse(value).success;
}

/** An active crafted entry on a class in `weights`, other than a summed pair, whose split is undefined. */
function isRegenerable(entry: TrackedEntry, weights: WeightsFile): entry is CraftedTrackedEntry {
  return entry.kind === 'crafted' && entry.status === 'active' && poolOf(weights, entry.categoryId, entry.className).ok && !isSummedPair(entry);
}

/** The prefix × suffix product of the variants, each at floor `max(needs(prefix), needs(suffix))`. */
function expand(entry: CraftedTrackedEntry, weights: WeightsFile, index: number, counts: Counts): CraftedTrackedEntry[] {
  const lookup = poolOf(weights, entry.categoryId, entry.className);
  if (!lookup.ok) {
    return [];
  }
  const { prefix: prefixPool, suffix: suffixPool } = lookup.pools;
  const prefixes = variantsOf(entry.prefix, prefixPool, `entries.${String(index)}.prefix`, counts);
  const suffixes = variantsOf(entry.suffix, suffixPool, `entries.${String(index)}.suffix`, counts);
  return prefixes.flatMap((prefix) =>
    suffixes.map((suffix): CraftedTrackedEntry => {
      const prefixNeeds = needs(prefix, prefixPool);
      const suffixNeeds = needs(suffix, suffixPool);
      return {
        kind: 'crafted',
        categoryId: entry.categoryId,
        className: entry.className,
        itemLevelMin: prefixNeeds === undefined || suffixNeeds === undefined ? entry.itemLevelMin : Math.max(prefixNeeds, suffixNeeds),
        prefix,
        suffix,
        status: 'active',
      };
    }),
  );
}

/**
 * Rewrites every active crafted entry from `core`'s `needs`, `ownInterval` and `contains` (FR-22, FR-38).
 * Raw entries, tombstones, summed pairs and classes absent from `weights` pass through as read.
 */
export function regenerateEntries(tracked: TrackedFile, weights: WeightsFile): RegenerateResult {
  const tombstones = new Set(tracked.entries.filter((entry) => entry.status !== 'active').map((entry) => combinationKey(entry)));
  const counts: Counts = { split: 0, sibling: 0, rebandedSingle: 0, noT2: [] };
  const dropped = { duplicate: 0, tombstone: 0 };
  const seen = new Set<string>();
  const entries: TrackedEntry[] = [];

  const admit = (generated: CraftedTrackedEntry): void => {
    const key = keyOf(generated);
    if (tombstones.has(combinationKey(generated))) {
      dropped.tombstone += 1;
    } else if (seen.has(key)) {
      dropped.duplicate += 1;
    } else {
      seen.add(key);
      entries.push(generated);
    }
  };

  for (const [index, entry] of tracked.entries.entries()) {
    if (isRegenerable(entry, weights)) {
      for (const each of expand(entry, weights, index, counts)) {
        admit(each);
      }
    } else {
      entries.push(entry);
      seen.add(keyOf(entry));
    }
  }

  const summary = { ...counts, droppedAsDuplicate: dropped.duplicate, droppedAsTombstone: dropped.tombstone };
  return { file: { ...tracked, entries }, summary };
}
