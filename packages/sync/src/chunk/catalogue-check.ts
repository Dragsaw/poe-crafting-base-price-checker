/**
 * The run-start catalogue check (AD-9, AD-12, AD-25, FR-24).
 *
 * Pure: the tracked list, the published dataset entries and the catalogue id
 * sets go in; the marks, the records and the order's input come out. It issues
 * no request and reads no file, so it never stamps `lastAttemptedAt`. It is
 * validation against the committed catalogue, never inference from a search
 * result.
 *
 * Every non-pruned entry is checked, field by field: the `categoryId` (crafted)
 * or the `baseTypeId` (raw), then the prefix `statId`s, then the suffix
 * `statId`s — one per line of a `hybrid` reference. `className` is never checked: no catalogue endpoint carries a class
 * axis. An entry with any miss is:
 *
 * - **marked** `unresolvable`, keeping `lastAttemptedAt`, `lastSearchId` and
 *   `lastSearchLeague` as published and dropping only the observation;
 * - **reported**, one `unresolvable` record per miss, in field order;
 * - **excluded** from this chunk's order, so no request is issued for it.
 *
 * An entry published as `unresolvable` whose ids all resolve again is
 * **recovered** (AD-7): `orderDataset` carries it with that state stripped, so
 * the rotation places it as an ordinary entry (row 1 or 2) rather than in
 * row 3. Only the order's input changes: the published dataset keeps the entry
 * `unresolvable` until a step prices it. A crafted `jewel` entry is never
 * recovered here: its derived base type is checked only by the pricing step
 * (AD-25), so this check cannot decide it, and it stays in row 3.
 */

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

/**
 * An entry marked `unresolvable` with its attempt metadata kept and its
 * observation dropped. Stamps nothing: the mark is offline work (AD-9).
 */
export function markUnresolvable(entryKey: string, before: DatasetEntry | undefined): DatasetEntry {
  return {
    entryKey,
    price: { state: 'unresolvable' },
    ...(!(before?.lastAttemptedAt === undefined) && { lastAttemptedAt: before.lastAttemptedAt }),
    ...(!(before?.lastSearchId === undefined) && { lastSearchId: before.lastSearchId }),
    ...(!(before?.lastSearchLeague === undefined) && { lastSearchLeague: before.lastSearchLeague }),
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
  for (const ref of [entry.prefix, entry.suffix]) {
    // A hybrid reference names one statId per line, in its sorted line order.
    for (const statId of statIds(ref)) {
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
      const undecidable = entry.kind === 'crafted' && entry.categoryId === 'jewel';
      if (!undecidable && published.get(entryKey)?.price.state === 'unresolvable') {
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
