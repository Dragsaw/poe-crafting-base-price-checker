import { canonicalKey, compareCanonicalKeys, type CraftedTrackedEntry, type CurationStatus, type DatasetEntry, type PriceTrust } from '@poe/contracts';

import { combinationText, type AffixPart, type StatTexts } from '../combination-text';

/** One non-pruned crafted Tracked Entry as its expansion line prints it. */
export interface CraftedCombination {
  /** The entry's canonical key. */
  readonly key: string;
  readonly text: readonly AffixPart[];
  readonly status: CurationStatus;
  /** The price in Divine, or `undefined` where `—` prints beside the mark. */
  readonly price: number | undefined;
  /** `core`'s verdict on the entry (AD-17). */
  readonly trust: PriceTrust;
  /** A priced member of `core`'s `combinations`: below the threshold (state 20). */
  readonly isBelowThreshold: boolean;
  /** The entry's dataset entry, for its stored search. `undefined` when never synced. */
  readonly entry: DatasetEntry | undefined;
}

/** One pruned crafted Tracked Entry: its text and the reason the curator gave (state 10). */
export interface PrunedCombination {
  readonly key: string;
  readonly text: readonly AffixPart[];
  readonly reason: string;
}

/** One not-counted crafted Tracked Entry: its text and the reason in its trust cell (state 49). */
export interface NotCountedCombination {
  readonly key: string;
  readonly text: readonly AffixPart[];
  readonly isPinned: boolean;
  readonly reason: string;
}

type LineFigures = Pick<CraftedCombination, 'trust' | 'price' | 'isBelowThreshold'>;

/** One class's line builders and its pruned lines; an entry key the tracked list lacks makes no line. */
export function classLines({
  entries,
  byKey,
  stats,
}: {
  readonly entries: readonly CraftedTrackedEntry[];
  readonly byKey: ReadonlyMap<string, DatasetEntry>;
  readonly stats: StatTexts;
}): {
  readonly text: (entryKey: string) => readonly AffixPart[];
  readonly line: (entryKey: string, figures: LineFigures) => CraftedCombination[];
  readonly notCountedLine: (entryKey: string, reason: string) => NotCountedCombination[];
  readonly pruned: readonly PrunedCombination[];
} {
  const tracked = new Map(entries.map((entry) => [canonicalKey(entry), entry]));
  const text = (entryKey: string): readonly AffixPart[] => {
    const entry = tracked.get(entryKey);
    return entry === undefined ? [] : combinationText(entry, stats);
  };
  const line = (entryKey: string, { trust, price, isBelowThreshold }: LineFigures): CraftedCombination[] => {
    const entry = tracked.get(entryKey);
    return entry === undefined
      ? []
      : [{ key: entryKey, text: text(entryKey), status: entry.status, price, trust, isBelowThreshold, entry: byKey.get(entryKey) }];
  };
  const notCountedLine = (entryKey: string, reason: string): NotCountedCombination[] => {
    const entry = tracked.get(entryKey);
    return entry === undefined ? [] : [{ key: entryKey, text: text(entryKey), isPinned: entry.status === 'pinned', reason }];
  };
  const pruned = [...tracked]
    .filter(([, entry]) => entry.status === 'pruned')
    .toSorted(([left], [right]) => compareCanonicalKeys(left, right))
    .map(([entryKey, entry]) => ({ key: entryKey, text: text(entryKey), reason: entry.prunedReason ?? '' }));
  return { text, line, notCountedLine, pruned };
}
