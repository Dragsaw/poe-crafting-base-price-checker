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
  ModifierRef,
  ModifierWeight,
  TrackedEntry,
  WeightsClassPools,
  WeightsFile,
  WeightsLine,
} from '@poe/contracts';

import { craftedClassesOf } from './crafted-classes.ts';
import { classDiscriminability } from './cross-file/class-discriminability.ts';
import { COMPLETE } from './cross-file/complete-pool.ts';
import { edgeAlignment } from './cross-file/edge-alignment.ts';
import { emptyContainment } from './cross-file/empty-containment.ts';
import { formatLine, formatReference, setText } from './cross-file/reference-text.ts';
import { containedIn, contains, eligible, interval, lineSet, poolOf, statIds, untrackable } from './probability.ts';
import type { ReferenceLine, Slot } from './probability.ts';

export { classDiscriminability } from './cross-file/class-discriminability.ts';
export { edgeAlignment } from './cross-file/edge-alignment.ts';
export { emptyContainment } from './cross-file/empty-containment.ts';

/** The six cross-file checks and the unvalidated marks (AD-17, IMPLEMENTATION-NOTES.md §2). Pure (AD-1): `web`, `sync` and `pnpm tracked:check` share them. */

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

/** `disagrees(rl, line)` (§2.3): a valueless reference line beside a banded weights line on its `statId`. */
function disagrees(rl: ReferenceLine, line: WeightsLine): boolean {
  return line.statId === rl.statId && !('valueMin' in rl) && line.ranges.length > 0;
}

/** §2.3, universal and per line: the detail when a valueless reference line meets any banded scoped line on its `statId`. */
export function kindAgreement(
  slot: Slot,
  reference: ModifierRef,
  scoped: readonly ModifierWeight[],
  floor: number,
): string | undefined {
  const parts: string[] = [];
  for (const rl of linesOf(reference)) {
    const found = disagreementsOn(rl, scoped);
    if (found === undefined) {
      continue;
    }
    const { count, first } = found;
    parts.push(
      `${formatLine(slot, reference, rl)} at floor ${String(floor)}: ${String(count)} scoped ${count === 1 ? 'line' : 'lines'} on that statId ${count === 1 ? 'is' : 'are'} banded (e.g. ${first.sourceModifierId})`,
    );
  }
  return parts.length === 0 ? undefined : parts.join('; ');
}

/** How many positive-weight scoped lines disagree with `rl`, and the first tier that does; `undefined` for none. */
function disagreementsOn(
  rl: ReferenceLine,
  scoped: readonly ModifierWeight[],
): { readonly count: number; readonly first: ModifierWeight } | undefined {
  let count = 0;
  let first: ModifierWeight | undefined;
  for (const entry of scoped) {
    if (entry.weight === 0) {
      continue;
    }
    const here = entry.lines.filter((line) => disagrees(rl, line)).length;
    if (here === 0) {
      continue;
    }
    count += here;
    first ??= entry;
  }
  return first === undefined ? undefined : { count, first };
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

/** §2.7: `incomplete(ref) ∨ mixedGroup(ref)`; the `mixedGroup` detail blames `weights.json`. */
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

/** §2.2: `coOccur(x, y, S)` on one slot, memoised per reference pair and `S` since one class's pairs repeat refs. */
export function coOccur(scoped: ScopedPools): CoOccur {
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
      scoped[slot].some((entry) => contains(x, entry, summed) && contains(y, entry, summed));
    cache.set(key, isCoOccurring);
    return isCoOccurring;
  };
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

interface Keyed {
  readonly entry: CraftedTrackedEntry;
  readonly key: string;
}

interface Scope {
  readonly scoped: ScopedPools;
  readonly coOccur: CoOccur;
}

type ScopeOf = (floor: number) => Scope;

/** One failure for `(check, entry)`, or none when no part names a problem. */
function failureOf({ entry, key }: Keyed, check: CrossFileCheck, parts: readonly string[]): CrossFileFailure[] {
  return parts.length === 0
    ? []
    : [{ check, entryKey: key, categoryId: entry.categoryId, className: entry.className, detail: parts.join('; ') }];
}

/** One scope per floor: AD-17 gives a class one, but the list may not yet agree. */
function scopeCache(pools: WeightsClassPools): ScopeOf {
  const scopes = new Map<number, Scope>();
  return (floor) => {
    const known = scopes.get(floor);
    if (known !== undefined) {
      return known;
    }
    const scoped = scopedPools(pools, floor);
    const made = { scoped, coOccur: coOccur(scoped) };
    scopes.set(floor, made);
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
    const { scoped } = scopeOf(entry.itemLevelMin);
    for (const [check, run] of REF_CHECKS) {
      const parts = OVERLAP_SLOTS.map((slot) => run(slot, entry[slot], scoped[slot], entry.itemLevelMin)).filter(
        (part) => part !== undefined,
      );
      failures.push(...failureOf(item, check, parts));
    }
  }
  return failures;
}

/** The pair's overlap text, or `undefined` when the pair is not evaluated or does not overlap. */
function pairOverlap(left: Keyed, right: Keyed, scopeOf: ScopeOf): string | undefined {
  if (
    right.entry.itemLevelMin !== left.entry.itemLevelMin ||
    (!hasHybridAffix(left.entry) && !hasHybridAffix(right.entry))
  ) {
    return undefined;
  }
  const branches = overlapBranches(left.entry, right.entry, scopeOf(left.entry.itemLevelMin).coOccur);
  return branches === undefined ? undefined : `at floor ${String(left.entry.itemLevelMin)} on ${describeOverlap(branches)}`;
}

function appendPartner(partners: Map<string, string[]>, key: string, text: string): void {
  partners.set(key, [...(partners.get(key) ?? []), text]);
}

/** §2.1, *Who evaluates a pair*: every pair in which either entry names a hybrid reference. Each entry of the pair names the other. */
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

/** Every failure of the six checks and every unvalidated mark, each sorted by canonical key (§2.8); without `weights`, every crafted entry is `weights-absent`. */
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
