import { canonicalKey } from '@poe/contracts';
import type {
  DatasetEntry,
  NotYetSyncedReason,
  PriceTrust,
  RankedRow,
  RawRankedRow,
  RawTrackedEntry,
  TrackedEntry,
} from '@poe/contracts';

import { entryTrust, resolvedPrice } from './price-trust.ts';

/** An entry that contributes nothing to the ordering — not zero, nothing (AD-9). */
export interface UnrankedEntry {
  readonly entry: RawTrackedEntry;
  readonly entryKey: string;
  /** Present where the dataset entry carries it, for the view's *tried* clock. */
  readonly lastAttemptedAt?: string;
  readonly trust: PriceTrust;
}

export interface NotYetSyncedEntry extends UnrankedEntry {
  readonly reason: NotYetSyncedReason;
}

function unranked(
  entry: RawTrackedEntry,
  entryKey: string,
  published: DatasetEntry | undefined,
  trust: PriceTrust,
): UnrankedEntry {
  return published?.lastAttemptedAt === undefined
    ? { entry, entryKey, trust }
    : { entry, entryKey, lastAttemptedAt: published.lastAttemptedAt, trust };
}

type LiveRawEntry = RawTrackedEntry & { readonly status: RawRankedRow['status'] };

function isLiveRaw(entry: TrackedEntry): entry is LiveRawEntry {
  return entry.kind === 'raw' && entry.status !== 'pruned';
}

interface RawGroupingRules {
  readonly activeLeague: string;
  readonly threshold: number;
  /** ISO-8601, the clock the verdict reads ages against (AD-10). */
  readonly now: string;
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
    categoryId: entry.categoryId,
    className: entry.className,
    itemLevelMin: entry.itemLevelMin,
    status: entry.status,
    ev: observation.priceDivine,
    craftCost: 0,
    observation,
    ...(base.lastAttemptedAt !== undefined && { lastAttemptedAt: base.lastAttemptedAt }),
    trust: base.trust,
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
  const base = unranked(entry, entryKey, published, entryTrust(entry, published, rules.activeLeague, rules.now));
  const price = resolvedPrice(published, rules.activeLeague);

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
  const row = rawRankedRow(entry, base, price.observation);
  if (price.observation.priceDivine < rules.threshold) {
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
