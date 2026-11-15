import {
  canonicalKey,
  compareByCodeUnit,
  compareCanonicalKeys,
  describeOverlap,
  linesOf,
  hasHybridAffix,
  OVERLAP_SLOTS,
  overlapBranches,
} from '@poe/contracts';
import type {
  CoOccur,
  CraftedTrackedEntry,
  CrossFileCheck,
  ModifierReference,
  ModifierWeight,
  TrackedEntry,
  WeightsClassPools,
  WeightsFile,
  WeightsLine,
} from '@poe/contracts';

import { craftedClassesOf } from './crafted-classes.ts';
import { CRAFTING_ITEM_LEVELS, HIGHEST_CRAFTING_ITEM_LEVEL } from './crafting-item-level.ts';
import { classDiscriminability } from './cross-file/class-discriminability.ts';
import { coRollable } from './cross-file/co-rollable.ts';
import { COMPLETE } from './cross-file/complete-pool.ts';
import { edgeAlignment } from './cross-file/edge-alignment.ts';
import { emptyContainment } from './cross-file/empty-containment.ts';
import { kindAgreement } from './cross-file/kind-agreement.ts';
import { formatReference, setText } from './cross-file/reference-text.ts';
import type { SlotScope } from './cross-file/slot-scope.ts';
import { containedIn, isContaining, eligible, interval, lineSet, poolOf, statIds, isUntrackable } from './probability.ts';
import type { ReferenceLine, Slot } from './probability.ts';

export { classDiscriminability } from './cross-file/class-discriminability.ts';
export { coRollable } from './cross-file/co-rollable.ts';
export { edgeAlignment } from './cross-file/edge-alignment.ts';
export { emptyContainment } from './cross-file/empty-containment.ts';
export { kindAgreement } from './cross-file/kind-agreement.ts';
export type { SlotScope } from './cross-file/slot-scope.ts';

/** The cross-file checks and the unvalidated marks (AD-17). Pure (AD-1). */

export interface CrossFileFailure {
  readonly check: CrossFileCheck;
  /** The failing entry's canonical key. */
  readonly entryKey: string;
  readonly categoryId: string;
  readonly className: string;
  readonly detail: string;
}

/** A crafted entry that no pool check covers. Never a failure. */
export interface UnvalidatedMark {
  /** The entry's canonical key. */
  readonly entryKey: string;
  readonly categoryId: string;
  readonly className: string;
  readonly reason: 'weights-absent' | 'partial-pool';
}

/** The failures and the marks, side by side. */
export interface CrossFileResult {
  readonly failures: readonly CrossFileFailure[];
  readonly unvalidated: readonly UnvalidatedMark[];
}

/** The two scoped slot sets of one class at one item level. */
export type ScopedPools = Readonly<Record<Slot, readonly ModifierWeight[]>>;

/** Both slots scoped to one item level, with no recipe floor: `eligible(pool, floor, 0)`. */
export function scopedPools(pools: WeightsClassPools, floor: number): ScopedPools {
  return { prefix: eligible(pools.prefix, floor, 0), suffix: eligible(pools.suffix, floor, 0) };
}

/** `meets(rl, line)`: the search for `rl` can match a roll of `line`. */
function isMeeting(rl: ReferenceLine, line: WeightsLine): boolean {
  if (line.statId !== rl.statId) {
    return false;
  }
  if (!('valueMin' in rl)) {
    return line.ranges.length === 0;
  }
  const derived = interval(line);
  return derived.min <= rl.valueMax && rl.valueMin <= derived.max;
}

/** `incomplete(ref) ∨ mixedGroup(ref)`; the `mixedGroup` detail blames `weights.json`. */
export function lineSetCompleteness(
  slot: Slot,
  reference: ModifierReference,
  { scoped, pool }: SlotScope,
  level: number,
): string | undefined {
  const named = statIds(reference);
  const lines = linesOf(reference);
  const at = `${formatReference(slot, reference)} at item level ${String(level)}`;
  const parts: string[] = [];

  const wider = scoped.filter((entry) => {
    if (entry.weight === 0 || isUntrackable(entry, COMPLETE) || lines.some((rl) => entry.lines.every((line) => !isMeeting(rl, line)))) {
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
    for (const entry of containedIn(reference, scoped, pool)) {
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

/** `coOccur(x, y, S)` on one slot, memoised per reference pair and `S`; `pools` are unscoped (AD-11). */
export function coOccur(scoped: ScopedPools, pools: WeightsClassPools): CoOccur {
  const cache = new Map<string, boolean>();
  return (x, y, slot, summed) => {
    const key = JSON.stringify([slot, x, y, [...summed].toSorted(compareByCodeUnit)]);
    const cached = cache.get(key);
    if (cached !== undefined) {
      return cached;
    }
    const theirs = statIds(y);
    const isCoOccurring =
      statIds(x).some((statId) => theirs.includes(statId)) &&
      scoped[slot].some((entry) => isContaining(x, entry, pools[slot], summed) && isContaining(y, entry, pools[slot], summed));
    cache.set(key, isCoOccurring);
    return isCoOccurring;
  };
}

type ReferenceCheck = (slot: Slot, reference: ModifierReference, scope: SlotScope, level: number) => string | undefined;

/** A pass that a wider pool cannot undo, since containment reads the level-free own interval: run at the entry's own floor (AD-17). */
const FLOOR_CHECKS: readonly (readonly [CrossFileCheck, ReferenceCheck])[] = [
  ['empty-containment-set', emptyContainment],
];

/** A search for a violating tier: run where the pool is widest, so no lower level hides one (AD-17). */
const WIDEST_CHECKS: readonly (readonly [CrossFileCheck, ReferenceCheck])[] = [
  ['kind-agreement', kindAgreement],
  ['line-set-completeness', lineSetCompleteness],
];

/** Whether pool checks are defined on a class: neither slot is `partial`. */
export function isPoolCheckable(pools: WeightsClassPools): boolean {
  return pools.prefix.poolCoverage !== 'partial' && pools.suffix.poolCoverage !== 'partial';
}

interface Keyed {
  readonly entry: CraftedTrackedEntry;
  readonly key: string;
}

interface Scope {
  readonly pools: WeightsClassPools;
  readonly scoped: ScopedPools;
  readonly coOccur: CoOccur;
}

type ScopeOf = (level: number) => Scope;

/** One failure for `(check, entry)`, or none when no part names a problem. */
function failureOf({ entry, key }: Keyed, check: CrossFileCheck, parts: readonly string[]): CrossFileFailure[] {
  return parts.length === 0
    ? []
    : [{ check, entryKey: key, categoryId: entry.categoryId, className: entry.className, detail: parts.join('; ') }];
}

/** One scope per level a check reads: an entry's own floor, an offered level, or the widest level (AD-17). */
function scopeCache(pools: WeightsClassPools): ScopeOf {
  const scopes = new Map<number, Scope>();
  return (level) => {
    const known = scopes.get(level);
    if (known !== undefined) {
      return known;
    }
    const scoped = scopedPools(pools, level);
    const made = { pools, scoped, coOccur: coOccur(scoped, pools) };
    scopes.set(level, made);
    return made;
  };
}

function markClass(keyed: readonly Keyed[], reason: UnvalidatedMark['reason']): UnvalidatedMark[] {
  return keyed.map(({ entry, key }) => ({ entryKey: key, categoryId: entry.categoryId, className: entry.className, reason }));
}

function discriminabilityFailures(keyed: readonly Keyed[], weights: WeightsFile): CrossFileFailure[] {
  return keyed.flatMap((item) => {
    const detail = classDiscriminability(item.entry, weights);
    return failureOf(item, 'class-discriminability', detail === undefined ? [] : [detail]);
  });
}

function referenceFailures(keyed: readonly Keyed[], scopeOf: ScopeOf): CrossFileFailure[] {
  const failures: CrossFileFailure[] = [];
  for (const item of keyed) {
    const { entry } = item;
    for (const [checks, level] of [[FLOOR_CHECKS, entry.itemLevelMin], [WIDEST_CHECKS, widestLevel(entry.itemLevelMin)]] as const) {
      const scope = scopeOf(level);
      for (const [check, run] of checks) {
        failures.push(...failureOf(item, check, slotParts(item, run, scope, level)));
      }
    }
    failures.push(...edgeFailures(item, scopeOf));
    const { pools, scoped } = scopeOf(entry.itemLevelMin);
    const pair = coRollable(entry, scoped, entry.itemLevelMin, pools);
    failures.push(...failureOf(item, 'co-rollable-combination', pair === undefined ? [] : [pair]));
  }
  return failures;
}

/** Both slots' details of one check at one level; a passing slot adds none. */
function slotParts({ entry }: Keyed, run: ReferenceCheck, { pools, scoped }: Scope, level: number): string[] {
  return OVERLAP_SLOTS.map((slot) => run(slot, entry[slot], { scoped: scoped[slot], pool: pools[slot] }, level)).filter((part) => part !== undefined);
}

/** Edge alignment at the floor and at each offered level above it, until one fails: a wider pool can contain a tier whose interval minimum sits below the band (AD-17). */
function edgeFailures(item: Keyed, scopeOf: ScopeOf): CrossFileFailure[] {
  const floor = item.entry.itemLevelMin;
  for (const level of [floor, ...CRAFTING_ITEM_LEVELS.filter((offered) => offered > floor)]) {
    const parts = slotParts(item, edgeAlignment, scopeOf(level), level);
    if (parts.length > 0) {
      return failureOf(item, 'edge-alignment', parts);
    }
  }
  return [];
}

/** The highest offered level, or a floor above it, whose own tiers would otherwise go unchecked. */
function widestLevel(...floors: readonly number[]): number {
  return Math.max(HIGHEST_CRAFTING_ITEM_LEVEL, ...floors);
}

/** The pair's overlap text, or `undefined` when the pair is not evaluated or does not overlap. */
function pairOverlap(left: Keyed, right: Keyed, scopeOf: ScopeOf): string | undefined {
  if (!hasHybridAffix(left.entry) && !hasHybridAffix(right.entry)) {
    return undefined;
  }
  const level = widestLevel(left.entry.itemLevelMin, right.entry.itemLevelMin);
  const branches = overlapBranches(left.entry, right.entry, scopeOf(level).coOccur);
  return branches === undefined ? undefined : `at item level ${String(level)} on ${describeOverlap(branches)}`;
}

function appendPartner(partners: Map<string, string[]>, key: string, text: string): void {
  partners.set(key, [...(partners.get(key) ?? []), text]);
}

/** Every pair where either entry names a hybrid reference. */
function coOccurFailures(keyed: readonly Keyed[], scopeOf: ScopeOf): CrossFileFailure[] {
  const partners = new Map<string, string[]>();
  for (const [index, left] of keyed.entries()) {
    const later = keyed.slice(index + 1);
    for (const right of later) {
      const on = pairOverlap(left, right, scopeOf);
      if (on === undefined) {
        continue;
      }
      appendPartner(partners, left.key, `overlaps ${right.key} ${on}`);
      appendPartner(partners, right.key, `overlaps ${left.key} ${on}`);
    }
  }
  return keyed.flatMap((item) => failureOf(item, 'co-occur', partners.get(item.key) ?? []));
}

interface ClassChecked {
  readonly failures: readonly CrossFileFailure[];
  readonly unvalidated: readonly UnvalidatedMark[];
}

function checkClass(members: readonly CraftedTrackedEntry[], weights: WeightsFile | undefined): ClassChecked {
  // One failure per (check, entry): a twin, which the schema refuses anyway, is checked once.
  const keyed = [...new Map(members.map((entry) => [canonicalKey(entry), entry]))].map(([key, entry]) => ({ entry, key }));
  if (weights === undefined) {
    return { failures: [], unvalidated: markClass(keyed, 'weights-absent') };
  }
  const discriminability = discriminabilityFailures(keyed, weights);

  const [first] = members;
  if (first === undefined) {
    return { failures: discriminability, unvalidated: [] };
  }
  const lookup = poolOf(weights, first.categoryId, first.className);
  if (!lookup.ok || !isPoolCheckable(lookup.pools)) {
    return { failures: discriminability, unvalidated: markClass(keyed, 'partial-pool') };
  }
  const scopeOf = scopeCache(lookup.pools);
  return {
    failures: [...discriminability, ...referenceFailures(keyed, scopeOf), ...coOccurFailures(keyed, scopeOf)],
    unvalidated: [],
  };
}

/** Every failure of the checks and every unvalidated mark, by canonical key. */
export function crossFileChecks(entries: readonly TrackedEntry[], weights: WeightsFile | undefined): CrossFileResult {
  const failures: CrossFileFailure[] = [];
  const unvalidated: UnvalidatedMark[] = [];

  for (const members of craftedClassesOf(entries).values()) {
    const checked = checkClass(members, weights);
    failures.push(...checked.failures);
    unvalidated.push(...checked.unvalidated);
  }

  return {
    failures: failures.toSorted(
      (left, right) =>
        compareCanonicalKeys(left.entryKey, right.entryKey) || compareCanonicalKeys(left.check, right.check),
    ),
    unvalidated: unvalidated.toSorted((left, right) => compareCanonicalKeys(left.entryKey, right.entryKey)),
  };
}
