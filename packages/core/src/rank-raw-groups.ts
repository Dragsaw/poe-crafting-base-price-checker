import { canonicalKey } from '@poe/contracts';
import type { DatasetEntry, NotYetSyncedReason, RankedRow, RawRankedRow, RawTrackedEntry, TrackedEntry } from '@poe/contracts';

/** An entry that contributes nothing to the ordering — not zero, nothing (AD-9). */
export interface UnrankedEntry {
  readonly entry: RawTrackedEntry;
  readonly entryKey: string;
  /** Present where the dataset entry carries it, for the view's *tried* clock. */
  readonly lastAttemptedAt?: string;
}

export interface NotYetSyncedEntry extends UnrankedEntry {
  readonly reason: NotYetSyncedReason;
}

function unranked(
  entry: RawTrackedEntry,
  entryKey: string,
  published: DatasetEntry | undefined,
): UnrankedEntry {
  return published?.lastAttemptedAt === undefined
    ? { entry, entryKey }
    : { entry, entryKey, lastAttemptedAt: published.lastAttemptedAt };
}

type LiveRawEntry = RawTrackedEntry & { readonly status: RawRankedRow['status'] };

function isLiveRaw(entry: TrackedEntry): entry is LiveRawEntry {
  return entry.kind === 'raw' && entry.status !== 'pruned';
}

interface RawGroupingRules {
  readonly activeLeague: string;
  readonly threshold: number;
}

interface RawGroups {
  readonly surviving: RankedRow[];
  readonly belowThreshold: RawRankedRow[];
  readonly noListings: UnrankedEntry[];
  readonly notYetSynced: NotYetSyncedEntry[];
  readonly unresolvable: UnrankedEntry[];
}

function rawRankedRow(
  entry: LiveRawEntry,
  base: UnrankedEntry,
  observation: RawRankedRow['observation'],
): RawRankedRow {
  return {
    kind: 'raw',
    entryKey: base.entryKey,
    baseTypeId: entry.baseTypeId,
    itemLevelMin: entry.itemLevelMin,
    status: entry.status,
    ev: observation.priceDivine,
    craftCost: 0,
    observation,
    ...(base.lastAttemptedAt !== undefined && { lastAttemptedAt: base.lastAttemptedAt }),
  };
}

function groupRawEntry(
  entry: LiveRawEntry,
  rules: RawGroupingRules,
  byKey: ReadonlyMap<string, DatasetEntry>,
  groups: RawGroups,
): void {
  const entryKey = canonicalKey(entry);
  const published = byKey.get(entryKey);
  const base = unranked(entry, entryKey, published);

  if (published === undefined) {
    groups.notYetSynced.push({ ...base, reason: 'never-synced' });
    return;
  }

  const { price } = published;
  if (price.state === 'no-listings') {
    groups.noListings.push(base);
    return;
  }
  if (price.state === 'unresolvable') {
    groups.unresolvable.push(base);
    return;
  }
  if (price.state === 'not-yet-synced') {
    groups.notYetSynced.push({ ...base, reason: price.reason });
    return;
  }
  const { observation } = price;
  if (observation.league !== rules.activeLeague) {
    groups.notYetSynced.push({ ...base, reason: 'league-mismatch' });
    return;
  }
  const row = rawRankedRow(entry, base, observation);
  if (observation.priceDivine < rules.threshold) {
    groups.belowThreshold.push(row);
  } else {
    groups.surviving.push(row);
  }
}

export function groupRawEntries(
  tracked: readonly TrackedEntry[],
  byKey: ReadonlyMap<string, DatasetEntry>,
  rules: RawGroupingRules,
): RawGroups {
  const groups: RawGroups = { surviving: [], belowThreshold: [], noListings: [], notYetSynced: [], unresolvable: [] };
  for (const entry of tracked) {
    if (isLiveRaw(entry)) {
      groupRawEntry(entry, rules, byKey, groups);
    }
  }
  return groups;
}
