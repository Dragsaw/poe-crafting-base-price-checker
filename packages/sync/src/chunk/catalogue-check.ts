// Run-start catalogue check (AD-9, AD-12, AD-25, FR-24): pure and offline, so it never stamps
// `lastAttemptedAt`. Recovery (AD-7) changes only the order's input, not the published dataset.
// A crafted `jewel` is never recovered here: its base type is checked only when priced (AD-25).

import { canonicalKey } from '@poe/contracts';
import type { DatasetEntry, TrackedEntry, UnresolvableRecord } from '@poe/contracts';
import { statIds } from '@poe/core';

import type { CatalogueIds } from '../catalogue/catalogue-ids.ts';

export interface CatalogueCheck {
  /** The offline marks, one per entry with a miss, in tracked-list order. */
  readonly marked: readonly DatasetEntry[];
  /** One `unresolvable` record per miss: entries in tracked-list order, misses in field order. */
  readonly records: readonly UnresolvableRecord[];
  /** The canonical keys kept out of this chunk's order. */
  readonly excludedKeys: ReadonlySet<string>;
  /** The dataset entries the rotation reads, recovered entries with their state stripped. */
  readonly orderDataset: readonly DatasetEntry[];
}

/** The state a recovered entry carries into the order only. Never published. */
const RECOVERED: DatasetEntry['price'] = { state: 'not-yet-synced', reason: 'never-synced' };

/** Marks an entry `unresolvable`, keeping its attempt metadata and stamping nothing (AD-9). */
export function markUnresolvable(entryKey: string, before: DatasetEntry | undefined): DatasetEntry {
  return {
    entryKey,
    price: { state: 'unresolvable' },
    ...(before?.lastAttemptedAt !== undefined && { lastAttemptedAt: before.lastAttemptedAt }),
    ...(before?.lastSearchId !== undefined && { lastSearchId: before.lastSearchId }),
    ...(before?.lastSearchLeague !== undefined && { lastSearchLeague: before.lastSearchLeague }),
  };
}

type Miss = Pick<UnresolvableRecord, 'identifier' | 'identifierKind'>;

function missesOf(entry: TrackedEntry, ids: CatalogueIds): Miss[] {
  const misses: Miss[] = [];
  if (entry.kind === 'raw') {
    if (!ids.baseTypeIds.has(entry.baseTypeId)) {
      misses.push({ identifier: entry.baseTypeId, identifierKind: 'baseTypeId' });
    }
    return misses;
  }
  if (!ids.categoryIds.has(entry.categoryId)) {
    misses.push({ identifier: entry.categoryId, identifierKind: 'categoryId' });
  }
  for (const reference of [entry.prefix, entry.suffix]) {
    // A hybrid reference names one statId per line, in its sorted line order.
    for (const statId of statIds(reference)) {
      if (!ids.statIds.has(statId)) {
        misses.push({ identifier: statId, identifierKind: 'statId' });
      }
    }
  }
  return misses;
}

export function checkCatalogue(
  tracked: readonly TrackedEntry[],
  dataset: readonly DatasetEntry[],
  ids: CatalogueIds,
): CatalogueCheck {
  const published = new Map(dataset.map((entry) => [entry.entryKey, entry]));
  const marked: DatasetEntry[] = [];
  const records: UnresolvableRecord[] = [];
  const excludedKeys = new Set<string>();
  const recovered = new Set<string>();

  for (const entry of tracked) {
    if (entry.status === 'pruned') {
      continue;
    }
    const entryKey = canonicalKey(entry);
    const misses = missesOf(entry, ids);
    if (misses.length === 0) {
      const isUndecidable = entry.kind === 'crafted' && entry.categoryId === 'jewel';
      if (!isUndecidable && published.get(entryKey)?.price.state === 'unresolvable') {
        recovered.add(entryKey);
      }
      continue;
    }
    if (excludedKeys.has(entryKey)) {
      continue;
    }
    excludedKeys.add(entryKey);
    marked.push(markUnresolvable(entryKey, published.get(entryKey)));
    for (const miss of misses) {
      records.push({ kind: 'unresolvable', entryKey, ...miss });
    }
  }

  const orderDataset = dataset.map((entry) =>
    recovered.has(entry.entryKey) ? { ...entry, price: RECOVERED } : entry,
  );
  return { marked, records, excludedKeys, orderDataset };
}
