import {
  canonicalKey,
  compareByCodeUnit,
  compareCanonicalKeys,
  defenceLettersOf,
  describeOverlap,
  linesOf,
  namesHybrid,
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
  WeightsLine,
  WeightsPool,
} from '@poe/contracts';

import { craftedClassesOf } from './crafted-classes.ts';
import { containedIn, contains, covers, eligible, interval, lineSet, poolOf, statIds, untrackable } from './probability.ts';
import type { ReferenceLine, Slot } from './probability.ts';

/**
 * The six cross-file checks (AD-17, IMPLEMENTATION-NOTES.md §2.1–§2.7) and the
 * unvalidated marks (§2.8), defined once. Pure (AD-1). `web` runs them at load
 * and excludes each affected Item Class; `sync` runs them as its run-start
 * gate; `pnpm tracked:check` lists them. None of the three re-implements one.
 *
 * **What they see.** Non-`pruned` `crafted` entries only; a `raw` entry
 * carries no reference and needs no discriminator (AD-17). With the weights
 * file absent, no check runs and each entry is marked `weights-absent`. A
 * class absent from the file, or with a `partial` slot, gets no pool check and
 * each of its entries is marked `partial-pool`; class discriminability reads
 * the category's fan-out, not a pool, and still runs (§2.8). A mark is never a
 * failure.
 *
 * **The scope.** Every pool check reads `eligible(pool, entry.itemLevelMin, 0)`
 * — the class's own crafted floor, with no recipe floor. Containment is
 * `contains` and every interval is `interval`, from `./probability.ts`; no
 * range pair is divided here.
 *
 * **Per line.** Kind agreement and edge alignment run once per line of a
 * `hybrid` reference (§2.3, §2.4); `linesOf` gives a single-line reference as
 * its one line.
 *
 * **Pairs.** `contracts` refuses an overlap of two all-single-line entries.
 * The `co-occur` check evaluates every pair in which either entry names a
 * `hybrid` reference, with the whole §2.1 predicate: `overlapBranches` computes
 * `S` from the pair, compares each summed `statId` as a sum and passes `S` to
 * `coOccur` (§2.1, *Who evaluates a pair*).
 *
 * **One failure per (check, entry)**, which is the record identity
 * `check` + `entryKey` (§12). A failure's `detail` names every slot,
 * reference, line, floor, partner, tier or sibling count its § asks for. No
 * detail names a file as at fault, because `core` cannot tell which file is
 * wrong (§2.5) — except line-set completeness's mixed-modGroup half, which
 * blames `weights.json` (§2.7).
 */

export interface CrossFileFailure {
  readonly check: CrossFileCheck;
  /** The failing entry's canonical key (§4.1). */
  readonly entryKey: string;
  readonly categoryId: string;
  readonly className: string;
  readonly detail: string;
}

/** A crafted entry that no pool check covers (§2.8). Never a failure. */
export interface UnvalidatedMark {
  /** The entry's canonical key (§4.1). */
  readonly entryKey: string;
  readonly categoryId: string;
  readonly className: string;
  readonly reason: 'weights-absent' | 'partial-pool';
}

/** The failures and the marks, side by side (§2.8). */
export interface CrossFileResult {
  readonly failures: readonly CrossFileFailure[];
  readonly unvalidated: readonly UnvalidatedMark[];
}

/** The two scoped slot sets of one class at one floor. */
export type ScopedPools = Readonly<Record<Slot, readonly ModifierWeight[]>>;

/** Both slots scoped to the class floor (§2.4): `eligible(pool, floor, 0)`. */
export function scopedPools(pools: WeightsClassPools, floor: number): ScopedPools {
  return { prefix: eligible(pools.prefix, floor, 0), suffix: eligible(pools.suffix, floor, 0) };
}

/**
 * A pool check runs on a `complete` pool only (§2.8), where `untrackable`
 * reduces to `not-in-game` (§1). The checks pass this coverage to it.
 */
const COMPLETE: Pick<WeightsPool, 'poolCoverage'> = { poolCoverage: 'complete' };

function lineText(rl: ReferenceLine): string {
  return 'valueMin' in rl
    ? `${rl.statId} band [${String(rl.valueMin)}, ${String(rl.valueMax)}]`
    : `${rl.statId} valueless`;
}

/** A reference as a payload names it: the slot, then each line's `statId` and band or kind. */
function formatReference(slot: Slot, reference: ModifierRef): string {
  return reference.kind === 'hybrid' ? `${slot} hybrid (${reference.lines.map(lineText).join(', ')})` : `${slot} ${lineText(reference)}`;
}

/** One line of a reference, as a per-line payload names it (§2.3, §2.4). */
function formatLine(slot: Slot, reference: ModifierRef, rl: ReferenceLine): string {
  return reference.kind === 'hybrid' ? `${slot} hybrid line ${lineText(rl)}` : `${slot} ${lineText(rl)}`;
}

function tierIds(entries: readonly ModifierWeight[]): string {
  return entries.map((entry) => entry.sourceModifierId).join(', ');
}

function setText(ids: readonly string[]): string {
  return `{${ids.join(', ')}}`;
}

/**
 * §2.4, per banded line. Over the reference's containment set, the detail
 * when a banded line's edges are not exactly the extremes of the contained
 * entries' lines **on that line's own `statId`**; `undefined` when every
 * banded line aligns, when no line is banded, and for an empty set (that is
 * §2.5's). A contained entry's foreign lines never enter the extremes.
 */
export function edgeAlignment(
  slot: Slot,
  reference: ModifierRef,
  scoped: readonly ModifierWeight[],
  floor: number,
): string | undefined {
  const contained = containedIn(reference, scoped);
  if (contained.length === 0) {
    return undefined;
  }
  const parts: string[] = [];
  for (const rl of linesOf(reference)) {
    if (!('valueMin' in rl)) {
      continue;
    }
    let min = Infinity;
    let max = -Infinity;
    for (const entry of contained) {
      for (const line of entry.lines) {
        if (line.statId !== rl.statId) {
          continue;
        }
        const derived = interval(line);
        min = Math.min(min, derived.min);
        max = Math.max(max, derived.max);
      }
    }
    if (rl.valueMin === min && rl.valueMax === max) {
      continue;
    }
    parts.push(
      `${formatLine(slot, reference, rl)} at floor ${String(floor)}: its edges are not the extremes [${String(min)}, ${String(max)}] of the tiers it contains (${tierIds(contained)})`,
    );
  }
  return parts.length === 0 ? undefined : parts.join('; ');
}

/**
 * The entries §1 excluded from a hybrid reference's containment set, as §2.5
 * lists them: covering every line under another line set, or `not-in-game`
 * while carrying every named `statId`.
 */
function hybridExclusions(reference: ModifierRef, scoped: readonly ModifierWeight[]): string[] {
  const named = statIds(reference);
  const lines = linesOf(reference);
  const excluded: string[] = [];
  for (const entry of scoped) {
    const tierSet = lineSet(entry);
    if (untrackable(entry, COMPLETE)) {
      if (named.every((statId) => tierSet.includes(statId))) {
        excluded.push(`${entry.sourceModifierId} (not-in-game)`);
      }
      continue;
    }
    if (lines.some((rl) => entry.lines.every((line) => !covers(rl, line)))) {
      continue;
    }
    // Covering every line means carrying every named statId, so only the tier's extra lines differ.
    const differ = tierSet.filter((statId) => !named.includes(statId));
    if (differ.length > 0) {
      excluded.push(`${entry.sourceModifierId} (line set ${setText(tierSet)} differs on ${differ.join(', ')})`);
    }
  }
  return excluded;
}

/**
 * §2.5. The detail when the reference contains no scoped entry — never a
 * `P = 0`. A weight-0 tier is never contained (§1), so a band over only
 * weight-0 tiers fails here. The detail names the reference, its floor and
 * the absence, and no file. For a hybrid reference it also lists what §1
 * excluded.
 */
export function emptyContainment(
  slot: Slot,
  reference: ModifierRef,
  scoped: readonly ModifierWeight[],
  floor: number,
): string | undefined {
  if (scoped.some((entry) => contains(reference, entry))) {
    return undefined;
  }
  const head = `${formatReference(slot, reference)} at floor ${String(floor)}: no scoped entry contains it`;
  if (reference.kind === 'hybrid') {
    const excluded = hybridExclusions(reference, scoped);
    return excluded.length === 0 ? head : `${head}; excluded: ${excluded.join(', ')}`;
  }
  const carrying = scoped.filter(
    (entry) => entry.weight > 0 && entry.lines.some((line) => line.statId === reference.statId),
  ).length;
  return `${head} (${String(carrying)} scoped ${carrying === 1 ? 'entry carries' : 'entries carry'} that statId)`;
}

/** `disagrees(rl, line)` (§2.3): a valueless reference line beside a banded weights line on its `statId`. */
function disagrees(rl: ReferenceLine, line: WeightsLine): boolean {
  return line.statId === rl.statId && !('valueMin' in rl) && line.ranges.length > 0;
}

/**
 * §2.3, universal and per line. The detail when a valueless line of the
 * reference meets **any** banded scoped line on its `statId`, naming the line,
 * its kind and one disagreeing tier. A banded line never disagrees: a
 * valueless weights line reads as `[1, 1]` (§2.3). A weight-0 tier moves no
 * kind verdict (§1).
 */
export function kindAgreement(
  slot: Slot,
  reference: ModifierRef,
  scoped: readonly ModifierWeight[],
  floor: number,
): string | undefined {
  const parts: string[] = [];
  for (const rl of linesOf(reference)) {
    let disagreeing = 0;
    let first: ModifierWeight | undefined;
    for (const entry of scoped) {
      if (entry.weight === 0) {
        continue;
      }
      for (const line of entry.lines) {
        if (!disagrees(rl, line)) {
          continue;
        }

        disagreeing += 1;
        first ??= entry;
      }
    }
    if (first === undefined) {
      continue;
    }
    parts.push(
      `${formatLine(slot, reference, rl)} at floor ${String(floor)}: ${String(disagreeing)} scoped ${disagreeing === 1 ? 'line' : 'lines'} on that statId ${disagreeing === 1 ? 'is' : 'are'} banded (e.g. ${first.sourceModifierId})`,
    );
  }
  return parts.length === 0 ? undefined : parts.join('; ');
}

/** `meets(rl, line)` (§2.7): the search for `rl` can match a roll of `line`. */
function meets(rl: ReferenceLine, line: WeightsLine): boolean {
  if (line.statId !== rl.statId) {
    return false;
  }
  if (!('valueMin' in rl)) {
    return line.ranges.length === 0;
  }
  const derived = interval(line);
  return derived.min <= rl.valueMax && rl.valueMin <= derived.max;
}

/**
 * §2.7: `incomplete(ref) ∨ mixedGroup(ref)`. `incomplete` holds when a scoped,
 * positive-weight, trackable tier that every line of the reference meets has
 * a line set strictly wider than the reference's `statId`s: a hybrid that
 * names a subset of a tier's lines, or a single-line band that reaches into a
 * hybrid tier. `mixedGroup` holds when a hybrid's contained tiers span more
 * than one `modGroup`, and its detail blames `weights.json`.
 */
export function lineSetCompleteness(
  slot: Slot,
  reference: ModifierRef,
  scoped: readonly ModifierWeight[],
  floor: number,
): string | undefined {
  const named = statIds(reference);
  const lines = linesOf(reference);
  const at = `${formatReference(slot, reference)} at floor ${String(floor)}`;
  const parts: string[] = [];

  const wider = scoped.filter((entry) => {
    if (entry.weight === 0 || untrackable(entry, COMPLETE) || lines.some((rl) => entry.lines.every((line) => !meets(rl, line)))) {
      return false;
    }
    const tierSet = lineSet(entry);
    return named.every((statId) => tierSet.includes(statId)) && tierSet.some((statId) => !named.includes(statId));
  });
  if (wider.length > 0) {
    if (reference.kind === 'hybrid') {
      const tiers = wider.map((entry) => {
        const tierSet = lineSet(entry);
        const omitted = tierSet.filter((statId) => !named.includes(statId));
        return `${entry.sourceModifierId} ${setText(tierSet)} omits ${omitted.join(', ')}`;
      });
      parts.push(`${at}: reference names a subset of this tier's lines: ${tiers.join(', ')}`);
    } else {
      const tiers = wider.map((entry) => {
        const line = entry.lines.find((candidate) => candidate.statId === reference.statId);
        const on = line === undefined ? '' : ` interval [${String(interval(line).min)}, ${String(interval(line).max)}]`;
        return `${entry.sourceModifierId} ${setText(lineSet(entry))}${on}`;
      });
      parts.push(`${at}: band reaches into a hybrid tier: ${tiers.join(', ')}`);
    }
  }

  if (reference.kind === 'hybrid') {
    const groups = new Map<string, string[]>();
    for (const entry of containedIn(reference, scoped)) {
      groups.set(entry.modGroup, [...(groups.get(entry.modGroup) ?? []), entry.sourceModifierId]);
    }
    if (groups.size > 1) {
      const byGroup = [...groups].map(([group, ids]) => `modGroup ${group}: ${ids.join(', ')}`).join('; ');
      parts.push(
        `${at}: weights data publishes one hybrid family under more than one modGroup (${byGroup}); weights.json is at fault, not the tracked list`,
      );
    }
  }
  return parts.length === 0 ? undefined : parts.join('; ');
}

/**
 * §2.2: `coOccur(x, y, S)` on one slot ⇔ `x` and `y` share a `statId` ∧ one
 * scoped entry of that slot contains both under `contains_S` (`contains`
 * with `summed`, which admits no weight-0 tier). A reference line on a
 * `statId` in `S` keeps its place in the line-set test and drops out of the
 * band test, so the sum alone judges it (§2.1). Memoised per reference pair
 * and `S`, since one class's pairs repeat refs.
 */
export function coOccur(scoped: ScopedPools): CoOccur {
  const cache = new Map<string, boolean>();
  return (x, y, slot, summed) => {
    const key = JSON.stringify([slot, x, y, [...summed].sort(compareByCodeUnit)]);
    const cached = cache.get(key);
    if (cached !== undefined) {
      return cached;
    }
    const theirs = statIds(y);
    const answer =
      statIds(x).some((statId) => theirs.includes(statId)) &&
      scoped[slot].some((entry) => contains(x, entry, summed) && contains(y, entry, summed));
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

type ReferenceCheck = (slot: Slot, reference: ModifierRef, scoped: readonly ModifierWeight[], floor: number) => string | undefined;

const REF_CHECKS: readonly (readonly [CrossFileCheck, ReferenceCheck])[] = [
  ['empty-containment-set', emptyContainment],
  ['edge-alignment', edgeAlignment],
  ['kind-agreement', kindAgreement],
  ['line-set-completeness', lineSetCompleteness],
];

function isPoolCheckable(pools: WeightsClassPools): boolean {
  return pools.prefix.poolCoverage !== 'partial' && pools.suffix.poolCoverage !== 'partial';
}

/**
 * Every failure of the six checks over the tracked list against the parsed
 * weights file, sorted by canonical key, then by check, and every unvalidated
 * mark, one per entry, sorted by canonical key (§2.8). With `weights` `null`
 * there is no failure and every crafted entry is marked `weights-absent`.
 */
export function crossFileChecks(entries: readonly TrackedEntry[], weights: WeightsFile | null): CrossFileResult {
  const byClass = craftedClassesOf(entries);

  const failures: CrossFileFailure[] = [];
  const unvalidated: UnvalidatedMark[] = [];
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
    const keyed = [...new Map(members.map((entry) => [canonicalKey(entry), entry]))].map(
      ([key, entry]) => ({ entry, key }),
    );
    const mark = (reason: UnvalidatedMark['reason']): void => {
      for (const { entry, key } of keyed) {
        unvalidated.push({ entryKey: key, categoryId: entry.categoryId, className: entry.className, reason });
      }
    };
    if (weights === null) {
      mark('weights-absent');
      continue;
    }
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
      mark('partial-pool');
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

    // §2.1, *Who evaluates a pair*: core takes every pair in which either
    // entry names a hybrid reference. Each entry of the pair names the other.
    const partners = new Map<string, string[]>();
    for (let index = 0; index < keyed.length; index += 1) {
      const left = keyed[index];
      if (left === undefined) {
        continue;
      }
      for (let index_ = index + 1; index_ < keyed.length; index_ += 1) {
        const right = keyed[index_];
        if (
          right === undefined ||
          right.entry.itemLevelMin !== left.entry.itemLevelMin ||
          (!namesHybrid(left.entry) && !namesHybrid(right.entry))
        ) {
          continue;
        }
        const branches = overlapBranches(left.entry, right.entry, scopeOf(left.entry.itemLevelMin).coOccur);
        if (branches === undefined) {
          continue;
        }
        const on = `at floor ${String(left.entry.itemLevelMin)} on ${describeOverlap(branches)}`;
        partners.set(left.key, [...(partners.get(left.key) ?? []), `overlaps ${right.key} ${on}`]);
        partners.set(right.key, [...(partners.get(right.key) ?? []), `overlaps ${left.key} ${on}`]);
      }
    }
    for (const { entry, key } of keyed) {
      fail(entry, key, 'co-occur', partners.get(key) ?? []);
    }
  }

  return {
    failures: failures.toSorted(
      (left, right) =>
        compareCanonicalKeys(left.entryKey, right.entryKey) || compareCanonicalKeys(left.check, right.check),
    ),
    unvalidated: unvalidated.toSorted((left, right) => compareCanonicalKeys(left.entryKey, right.entryKey)),
  };
}
