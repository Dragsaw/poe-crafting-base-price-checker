import { canonicalKey, compareCanonicalKeys } from '@poe/contracts';
import type {
  DatasetEntry,
  NotYetSyncedReason,
  RankedRow,
  RawTrackedEntry,
  TrackedEntry,
  WeightsFile,
} from '@poe/contracts';

import type { CrossFileFailure } from './cross-file.ts';

/**
 * The ranking, raw branch (AD-17, AD-9, AD-19, IMPLEMENTATION-NOTES.md §4.1,
 * §4.2).
 *
 * Pure (AD-1, AD-4). The tracked entries, the published dataset entries, the
 * active league and the Payout Threshold go in as values; a typed `Ranking`
 * comes out. Nothing is read from anywhere else and no clock is consulted.
 * Every expected data condition is a group of the result. One caller error
 * throws: a threshold that is not a finite number ≥ 0 is a `RangeError`,
 * before anything is grouped. `rank` never clamps or coerces it.
 *
 * Per non-pruned `raw` tracked entry, joined to its dataset entry by canonical
 * key:
 *
 * - no dataset entry: `notYetSynced`, reason `never-synced`.
 * - `priced` with `observation.league !== activeLeague`: `notYetSynced`,
 *   reason `league-mismatch` (AD-19). Only the observation's league is
 *   compared, and the threshold is never applied to it.
 * - `priced` with `priceDivine < threshold`: a row in `belowThreshold`, never
 *   in the ordering (FR-3, AD-17).
 * - `priced` with `priceDivine ≥ threshold`: a row in `ordering`, EV equal to
 *   the price verbatim, Craft Cost zero.
 * - `no-listings`, `unresolvable`, `not-yet-synced`: their own group, the
 *   published reason kept.
 *
 * `pruned` entries appear in no group. `crafted` entries never rank here (the
 * crafted EV is Story 3.4's). Each distinct non-pruned crafted
 * `(categoryId, className)` is looked up directly in the parsed weights file,
 * by `categoryId`, then `className`, and never through a sibling `className`:
 * with no file, or no such pair, it is one `unrankable` class, reason `class
 * absent from weights file` (AD-24); with either slot declaring `poolCoverage: "partial"`, reason
 * `pool partial`. A complete pair named by a cross-file failure is reason
 * `class disagrees with weights file` (AD-17); the other two reasons take
 * precedence. Otherwise a complete pair makes no claim. `poolCoverage` is trusted as
 * declared (AD-11). Dataset entries no tracked entry names are ignored.
 * `core` never reads `lastSearchId` or `lastSearchLeague` (AD-9).
 */

export interface RankInput {
  readonly tracked: readonly TrackedEntry[];
  /** The published dataset's entries. */
  readonly dataset: readonly DatasetEntry[];
  /** The active league, verbatim from `data/config.json` (AD-19). */
  readonly activeLeague: string;
  /**
   * The Payout Threshold in divine (FR-7). An entry survives at `price ≥ threshold`.
   * Must be finite and ≥ 0 (0 is valid); any other value makes `rank` throw a `RangeError`.
   */
  readonly threshold: number;
  /**
   * The parsed weights file, or `null` when it is absent (AD-24). A crafted
   * Item Class whose pair is missing from it, or with no file at all, is
   * Unrankable as `class absent from weights file`; one with a `partial` slot
   * is Unrankable as `pool partial` (FR-4).
   */
  readonly weights: WeightsFile | null;
  /**
   * The cross-file failures of this tracked list against `weights`, from
   * `crossFileChecks`, computed once per load by the caller. Each failure's
   * `(categoryId, className)` is Unrankable as `class disagrees with weights
   * file`, unless the lookup already gave it one of the other two reasons,
   * which take precedence. Absent means none.
   */
  readonly crossFileFailures?: readonly Pick<CrossFileFailure, 'categoryId' | 'className'>[];
}

/**
 * FR-4's reasons, verbatim (PRD-owned). The first two come from the direct
 * lookup of the crafted pair in the weights file; `class disagrees with
 * weights file` is any of the five cross-file checks (`cross-file.ts`), one
 * string for all five.
 */
export type UnrankableReason =
  | 'class absent from weights file'
  | 'pool partial'
  | 'class disagrees with weights file';

/** One Unrankable Item Class: the `(categoryId, className)` pair and its reason. Never a Base Type. */
export interface UnrankableClass {
  readonly categoryId: string;
  readonly className: string;
  readonly reason: UnrankableReason;
}

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

export interface Ranking {
  /** The surviving rows: EV descending, then `compareRankedRows`. */
  readonly ordering: readonly RankedRow[];
  /** Priced rows below the threshold, in canonical key order. Never in `ordering`. */
  readonly belowThreshold: readonly RankedRow[];
  /** In canonical key order. */
  readonly noListings: readonly UnrankedEntry[];
  /** In canonical key order, each with its reason. */
  readonly notYetSynced: readonly NotYetSyncedEntry[];
  /** In canonical key order. */
  readonly unresolvable: readonly UnrankedEntry[];
  /**
   * One per distinct non-pruned crafted `(categoryId, className)`, by
   * `className` in UTF-8 code-unit order, then `categoryId`, whose pair is
   * absent from the weights file or declares a `partial` slot.
   */
  readonly unrankable: readonly UnrankableClass[];
}

/** Raw before crafted at an equal EV: a raw row has no recipe id (AD-17). */
const KIND_ORDER: Readonly<Record<RankedRow['kind'], number>> = { raw: 0 };

/**
 * The tie-break at an equal EV (AD-17, decision 2026-09-26): kind first, raw
 * before crafted; then the serialised canonical key of the entry's own AD-5 arm
 * by `compareCanonicalKeys`, within the kind. Epic 3's crafted arm adds the
 * recipe id as the last term. The canonical key's own leading kind tag sorts
 * `crafted` first, which is why the kind is compared explicitly before it.
 */
export function compareRankedRows(left: RankedRow, right: RankedRow): number {
  const byKind = KIND_ORDER[left.kind] - KIND_ORDER[right.kind];
  if (byKind !== 0) {
    return byKind;
  }
  return compareCanonicalKeys(left.entryKey, right.entryKey);
}

function compareOrdering(left: RankedRow, right: RankedRow): number {
  if (left.ev !== right.ev) {
    return right.ev - left.ev;
  }
  return compareRankedRows(left, right);
}

const byEntryKey = (left: { entryKey: string }, right: { entryKey: string }): number =>
  compareCanonicalKeys(left.entryKey, right.entryKey);

/** `className` by UTF-8 code unit, as the `weights-absent` record sorts; `categoryId` breaks a shared name. */
const byItemClass = (left: UnrankableClass, right: UnrankableClass): number =>
  compareCanonicalKeys(left.className, right.className) || compareCanonicalKeys(left.categoryId, right.categoryId);

/**
 * The direct lookup `bases[categoryId][className]`, by `categoryId`, then
 * `className`, never falling back to a sibling class (WEIGHTS-FILE-SCHEMA.md, *`bases` key*).
 * Own keys only, so a pair never resolves through the object prototype.
 */
function unrankableReasonOf(
  weights: WeightsFile | null,
  categoryId: string,
  className: string,
): UnrankableReason | undefined {
  const classes = weights !== null && Object.hasOwn(weights.bases, categoryId) ? weights.bases[categoryId] : undefined;
  const pools = classes !== undefined && Object.hasOwn(classes, className) ? classes[className] : undefined;
  if (pools === undefined) {
    return 'class absent from weights file';
  }
  if (pools.prefix.poolCoverage === 'partial' || pools.suffix.poolCoverage === 'partial') {
    return 'pool partial';
  }
  return undefined;
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

export function rank(input: RankInput): Ranking {
  if (!Number.isFinite(input.threshold) || input.threshold < 0) {
    throw new RangeError(
      `rank: threshold must be a finite number >= 0, got ${String(input.threshold)}`,
    );
  }
  const byKey = new Map(input.dataset.map((published) => [published.entryKey, published]));

  const surviving: RankedRow[] = [];
  const belowThreshold: RankedRow[] = [];
  const noListings: UnrankedEntry[] = [];
  const notYetSynced: NotYetSyncedEntry[] = [];
  const unresolvable: UnrankedEntry[] = [];
  /** Keyed on the serialised pair, so one class with several entries is one row. */
  const unrankable = new Map<string, UnrankableClass>();
  const disagreeing = new Set(
    (input.crossFileFailures ?? []).map((failure) => JSON.stringify([failure.categoryId, failure.className])),
  );

  for (const entry of input.tracked) {
    if (entry.status === 'pruned') {
      continue;
    }
    if (entry.kind === 'crafted') {
      const { categoryId, className } = entry;
      const classKey = JSON.stringify([categoryId, className]);
      const reason =
        unrankableReasonOf(input.weights, categoryId, className) ??
        (disagreeing.has(classKey) ? 'class disagrees with weights file' : undefined);
      if (reason !== undefined) {
        unrankable.set(classKey, { categoryId, className, reason });
      }
      continue;
    }
    const entryKey = canonicalKey(entry);
    const published = byKey.get(entryKey);
    const base = unranked(entry, entryKey, published);

    if (published === undefined) {
      notYetSynced.push({ ...base, reason: 'never-synced' });
      continue;
    }

    const price = published.price;
    switch (price.state) {
      case 'no-listings':
        noListings.push(base);
        break;
      case 'unresolvable':
        unresolvable.push(base);
        break;
      case 'not-yet-synced':
        notYetSynced.push({ ...base, reason: price.reason });
        break;
      case 'priced': {
        const { observation } = price;
        if (observation.league !== input.activeLeague) {
          notYetSynced.push({ ...base, reason: 'league-mismatch' });
          break;
        }
        const row: RankedRow = {
          kind: 'raw',
          entryKey,
          baseTypeId: entry.baseTypeId,
          itemLevelMin: entry.itemLevelMin,
          status: entry.status,
          ev: observation.priceDivine,
          craftCost: 0,
          observation,
          ...(base.lastAttemptedAt === undefined ? {} : { lastAttemptedAt: base.lastAttemptedAt }),
        };
        if (observation.priceDivine < input.threshold) {
          belowThreshold.push(row);
        } else {
          surviving.push(row);
        }
        break;
      }
    }
  }

  return {
    ordering: surviving.toSorted(compareOrdering),
    belowThreshold: belowThreshold.toSorted(byEntryKey),
    noListings: noListings.toSorted(byEntryKey),
    notYetSynced: notYetSynced.toSorted(byEntryKey),
    unresolvable: unresolvable.toSorted(byEntryKey),
    unrankable: [...unrankable.values()].toSorted(byItemClass),
  };
}
