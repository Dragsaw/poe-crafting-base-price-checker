import {
  canonicalKey,
  compareCanonicalKeys,
  defenceLettersOf,
  describeOverlap,
  NEVER_CO_OCCUR,
  OVERLAP_SLOTS,
  overlapBranches,
} from '@poe/contracts';
import type {
  CoOccur,
  CraftedTrackedEntry,
  CrossFileCheck,
  ModifierRef,
  ModifierWeight,
  TrackedEntry,
  WeightsClassPools,
  WeightsFile,
} from '@poe/contracts';

import { craftedClassesOf } from './crafted-classes.ts';
import { assertSingleLine, containedIn, contains, eligible, interval, poolOf } from './probability.ts';
import type { Slot } from './probability.ts';

/**
 * The five cross-file checks (AD-17, IMPLEMENTATION-NOTES.md §2.1–§2.6),
 * defined once. Pure (AD-1). `web` runs them at load and excludes each
 * affected Item Class; `sync` runs them as its run-start gate. Neither shell
 * re-implements one.
 *
 * **What they see.** Non-`pruned` `crafted` entries only; a `raw` entry
 * carries no reference and needs no discriminator (AD-17). With the weights
 * file absent, no check runs. A class the ranking already makes Unrankable —
 * absent from the file, or with a `partial` slot — gets no pool check, since
 * `coOccur` is `false` there and the existing reason stands (§2.2); class
 * discriminability reads the category's fan-out, not a pool, and still runs.
 *
 * **The scope.** Every pool check reads `eligible(pool, entry.itemLevelMin, 0)`
 * — the class's own crafted floor, with no recipe floor. Containment is
 * `contains` and every interval is `interval`, from `./probability.ts`; no
 * range pair is divided here.
 *
 * **One failure per (check, entry)**, which is the record identity
 * `check` + `entryKey` (§12). A failure's `detail` names every slot,
 * reference, floor, partner or sibling count its § asks for. No detail names
 * a file as at fault: `core` cannot tell which file is wrong (§2.5).
 */

export interface CrossFileFailure {
  readonly check: CrossFileCheck;
  /** The failing entry's canonical key (§4.1). */
  readonly entryKey: string;
  readonly categoryId: string;
  readonly className: string;
  readonly detail: string;
}

/** The two scoped slot sets of one class at one floor. */
export type ScopedPools = Readonly<Record<Slot, readonly ModifierWeight[]>>;

/** Both slots scoped to the class floor (§2.4): `eligible(pool, floor, 0)`. */
export function scopedPools(pools: WeightsClassPools, floor: number): ScopedPools {
  return { prefix: eligible(pools.prefix, floor, 0), suffix: eligible(pools.suffix, floor, 0) };
}

function formatRef(slot: Slot, ref: ModifierRef): string {
  assertSingleLine(ref, 5);
  return ref.kind === 'banded'
    ? `${slot} ${ref.statId} band [${String(ref.valueMin)}, ${String(ref.valueMax)}]`
    : `${slot} ${ref.statId} valueless`;
}

/**
 * §2.4. For a `banded` reference with a non-empty containment set, the
 * detail when its edges are not exactly the extremes of the contained
 * entries' lines **on the reference's own `statId`**; `undefined` when they
 * are, for a `valueless` reference, and for an empty set (that is §2.5's).
 * A hybrid entry's foreign lines never enter the extremes.
 */
export function edgeAlignment(
  slot: Slot,
  ref: ModifierRef,
  scoped: readonly ModifierWeight[],
  floor: number,
): string | undefined {
  assertSingleLine(ref, 5);
  if (ref.kind !== 'banded') {
    return undefined;
  }
  let min = Number.POSITIVE_INFINITY;
  let max = Number.NEGATIVE_INFINITY;
  for (const entry of containedIn(ref, scoped)) {
    for (const line of entry.lines) {
      if (line.statId !== ref.statId) {
        continue;
      }
      const derived = interval(line);
      min = Math.min(min, derived.min);
      max = Math.max(max, derived.max);
    }
  }
  if (min === Number.POSITIVE_INFINITY) {
    return undefined;
  }
  if (ref.valueMin === min && ref.valueMax === max) {
    return undefined;
  }
  return `${formatRef(slot, ref)} at floor ${String(floor)}: its edges are not the extremes [${String(min)}, ${String(max)}] of the tiers it contains`;
}

/**
 * §2.5. The detail when the reference contains no scoped entry — never a
 * `P = 0`. A weight-0 tier is never contained (§1), so a band over only
 * weight-0 tiers fails here. The detail names the reference, its floor and
 * the absence, and no file.
 */
export function emptyContainment(
  slot: Slot,
  ref: ModifierRef,
  scoped: readonly ModifierWeight[],
  floor: number,
): string | undefined {
  assertSingleLine(ref, 5);
  if (scoped.some((entry) => contains(ref, entry))) {
    return undefined;
  }
  const carrying = scoped.filter(
    (entry) => entry.weight > 0 && entry.lines.some((line) => line.statId === ref.statId),
  ).length;
  return `${formatRef(slot, ref)} at floor ${String(floor)}: no scoped entry contains it (${String(carrying)} scoped ${carrying === 1 ? 'entry carries' : 'entries carry'} that statId)`;
}

/**
 * §2.3, universal. The detail when the reference is `valueless` and **any**
 * scoped line on its `statId` is banded (non-empty `ranges`). A banded
 * reference never disagrees: a valueless line reads as `[1, 1]` (§2.3). A
 * weight-0 tier moves no kind verdict (§1).
 */
export function kindAgreement(
  slot: Slot,
  ref: ModifierRef,
  scoped: readonly ModifierWeight[],
  floor: number,
): string | undefined {
  assertSingleLine(ref, 5);
  if (ref.kind !== 'valueless') {
    return undefined;
  }
  let disagreeing = 0;
  for (const entry of scoped) {
    if (entry.weight === 0) {
      continue;
    }
    for (const line of entry.lines) {
      if (line.statId !== ref.statId) {
        continue;
      }
      if (line.ranges.length > 0) {
        disagreeing += 1;
      }
    }
  }
  if (disagreeing === 0) {
    return undefined;
  }
  return `${formatRef(slot, ref)} at floor ${String(floor)}: ${String(disagreeing)} scoped ${disagreeing === 1 ? 'line' : 'lines'} on that statId ${disagreeing === 1 ? 'is' : 'are'} banded`;
}

/**
 * §2.2: `coOccur(x, y)` on one slot ⇔ one scoped entry of that slot contains
 * both. Memoised per reference pair, since one class's pairs repeat refs.
 */
export function coOccur(scoped: ScopedPools): CoOccur {
  const cache = new Map<string, boolean>();
  return (x, y, slot) => {
    const key = JSON.stringify([slot, x, y]);
    const cached = cache.get(key);
    if (cached !== undefined) {
      return cached;
    }
    const answer = scoped[slot].some((entry) => contains(x, entry) && contains(y, entry));
    cache.set(key, answer);
    return answer;
  };
}

/**
 * §2.6: `fansOut ∧ ¬discriminable`. `fansOut` is more than one class under
 * the entry's `categoryId`. `discriminable` is §10.2 arm 1 (a defence
 * suffix), arm 2 (every class under the category is plain) or arm 3 (one
 * class). No catalogue is read. The detail when it fails, else `undefined`.
 */
export function classDiscriminability(
  entry: Pick<CraftedTrackedEntry, 'categoryId' | 'className'>,
  weights: WeightsFile,
): string | undefined {
  const classes = Object.hasOwn(weights.bases, entry.categoryId) ? Object.keys(weights.bases[entry.categoryId] ?? {}) : [];
  if (classes.length <= 1) {
    return undefined;
  }
  if (defenceLettersOf(entry.className) !== undefined) {
    return undefined;
  }
  if (classes.every((className) => defenceLettersOf(className) === undefined)) {
    return undefined;
  }
  const siblings = classes.filter((className) => className !== entry.className).length;
  return `className ${entry.className}, categoryId ${entry.categoryId}, ${String(siblings)} sibling ${siblings === 1 ? 'class' : 'classes'}: class not discriminable`;
}

type RefCheck = (slot: Slot, ref: ModifierRef, scoped: readonly ModifierWeight[], floor: number) => string | undefined;

const REF_CHECKS: readonly (readonly [CrossFileCheck, RefCheck])[] = [
  ['empty-containment-set', emptyContainment],
  ['edge-alignment', edgeAlignment],
  ['kind-agreement', kindAgreement],
];

function isPoolCheckable(pools: WeightsClassPools): boolean {
  return pools.prefix.poolCoverage !== 'partial' && pools.suffix.poolCoverage !== 'partial';
}

/**
 * Every failure of the five checks over the tracked list against the parsed
 * weights file, sorted by canonical key, then by check. Empty when `weights`
 * is `null`.
 */
export function crossFileChecks(
  entries: readonly TrackedEntry[],
  weights: WeightsFile | null,
): CrossFileFailure[] {
  if (weights === null) {
    return [];
  }
  const byClass = craftedClassesOf(entries);

  const failures: CrossFileFailure[] = [];
  const fail = (entry: CraftedTrackedEntry, entryKey: string, check: CrossFileCheck, parts: readonly string[]): void => {
    if (parts.length > 0) {
      failures.push({
        check,
        entryKey,
        categoryId: entry.categoryId,
        className: entry.className,
        detail: parts.join('; '),
      });
    }
  };

  for (const members of byClass.values()) {
    // One failure per (check, entry): a twin, which the schema refuses anyway, is checked once.
    const keyed = [...new Map(members.map((entry) => [canonicalKey(entry), entry])).entries()].map(
      ([key, entry]) => ({ entry, key }),
    );
    for (const { entry, key } of keyed) {
      const discriminability = classDiscriminability(entry, weights);
      fail(entry, key, 'class-discriminability', discriminability === undefined ? [] : [discriminability]);
    }

    const [first] = members;
    if (first === undefined) {
      continue;
    }
    const lookup = poolOf(weights, first.categoryId, first.className);
    if (!lookup.ok || !isPoolCheckable(lookup.pools)) {
      continue;
    }
    /** One scope per floor: AD-17 gives a class one, but the list may not yet agree. */
    const scopes = new Map<number, { readonly scoped: ScopedPools; readonly coOccur: CoOccur }>();
    const scopeOf = (floor: number) => {
      const known = scopes.get(floor);
      if (known !== undefined) {
        return known;
      }
      const scoped = scopedPools(lookup.pools, floor);
      const made = { scoped, coOccur: coOccur(scoped) };
      scopes.set(floor, made);
      return made;
    };

    for (const { entry, key } of keyed) {
      const { scoped } = scopeOf(entry.itemLevelMin);
      for (const [check, run] of REF_CHECKS) {
        const parts: string[] = [];
        for (const slot of OVERLAP_SLOTS) {
          const part = run(slot, entry[slot], scoped[slot], entry.itemLevelMin);
          if (part !== undefined) {
            parts.push(part);
          }
        }
        fail(entry, key, check, parts);
      }
    }

    // §2.1's coOccur branch: an overlap the real pool read makes and the
    // within-file call does not. Each entry of the pair names the other.
    const partners = new Map<string, string[]>();
    for (let i = 0; i < keyed.length; i += 1) {
      const left = keyed[i];
      if (left === undefined) {
        continue;
      }
      for (let j = i + 1; j < keyed.length; j += 1) {
        const right = keyed[j];
        if (right === undefined || right.entry.itemLevelMin !== left.entry.itemLevelMin) {
          continue;
        }
        const real = overlapBranches(left.entry, right.entry, scopeOf(left.entry.itemLevelMin).coOccur);
        if (real === undefined || overlapBranches(left.entry, right.entry, NEVER_CO_OCCUR) !== undefined) {
          continue;
        }
        const on = `at floor ${String(left.entry.itemLevelMin)} on ${describeOverlap(real)}`;
        partners.set(left.key, [...(partners.get(left.key) ?? []), `overlaps ${right.key} ${on}`]);
        partners.set(right.key, [...(partners.get(right.key) ?? []), `overlaps ${left.key} ${on}`]);
      }
    }
    for (const { entry, key } of keyed) {
      fail(entry, key, 'co-occur', partners.get(key) ?? []);
    }
  }

  return failures.toSorted(
    (left, right) => compareCanonicalKeys(left.entryKey, right.entryKey) || compareCanonicalKeys(left.check, right.check),
  );
}
