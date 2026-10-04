import {
  canonicalKey,
  parseEnvelope,
  TRACKED_SCHEMA_VERSION,
  TrackedFileSchema,
  WEIGHTS_SCHEMA_VERSION,
  WeightsFileSchema,
} from '@poe/contracts';
import type {
  CraftedTrackedEntry,
  HybridLine,
  ModifierRef,
  ModifierWeight,
  TrackedEntry,
  WeightsClassPools,
  WeightsFile,
  WeightsLine,
  WeightsPool,
} from '@poe/contracts';
import { describe, expect, it } from 'vitest';

import { classDiscriminability, coOccur, crossFileChecks, edgeAlignment, emptyContainment } from './cross-file.ts';

const STAT = 'explicit.stat_1';
const OTHER = 'explicit.stat_2';
const SUFFIX_STAT = 'explicit.stat_9';

let serial = 0;

/** One weights tier, built in the test (NFR-2). */
function tier(
  lines: readonly WeightsLine[],
  { itemLevelMin = 1, weight = 100, modGroup }: { itemLevelMin?: number; weight?: number; modGroup?: string } = {},
): ModifierWeight {
  serial += 1;
  return {
    sourceModifierId: `m${String(serial)}`,
    modGroup: modGroup ?? `g${String(serial)}`,
    itemLevelMin,
    weight,
    weightSource: 'published',
    lines: [...lines],
  };
}

const line = (statId: string | null, ...ranges: (readonly [number, number])[]): WeightsLine => ({
  statId,
  ranges: ranges.map(([min, max]) => [min, max] as [number, number]),
});

const band = (valueMin: number, valueMax: number, statId = STAT): ModifierRef => ({
  kind: 'banded',
  statId,
  valueMin,
  valueMax,
});
const valueless = (statId = STAT): ModifierRef => ({ kind: 'valueless', statId });

/** T7 derives to `[43, 56.5]` (a two-`#` line), T8 to `[56, 80]`. */
const T7 = (itemLevelMin = 60) => tier([line(STAT, [40, 53], [46, 60])], { itemLevelMin });
const T8 = (itemLevelMin = 75) => tier([line(STAT, [56, 80])], { itemLevelMin });
/** A suffix pool one reference aligns on. */
const SUFFIX_TIER = tier([line(SUFFIX_STAT, [1, 2])]);

function pools(
  prefix: readonly ModifierWeight[],
  suffix: readonly ModifierWeight[] = [SUFFIX_TIER],
  coverage: { prefix?: WeightsPool['poolCoverage']; suffix?: WeightsPool['poolCoverage'] } = {},
): WeightsClassPools {
  return {
    prefix: { poolCoverage: coverage.prefix ?? 'complete', entries: [...prefix] },
    suffix: { poolCoverage: coverage.suffix ?? 'complete', entries: [...suffix] },
  };
}

function weightsOf(classes: Record<string, Record<string, WeightsClassPools>>): WeightsFile {
  return {
    schemaVersion: WEIGHTS_SCHEMA_VERSION,
    gamePatch: '0.5.5',
    producer: { id: 'test', generatedAt: '2026-09-27T00:00:00Z' },
    bases: classes,
  };
}

const bows = (classPools: WeightsClassPools) => weightsOf({ 'weapon.bow': { Bows: classPools } });

/** Both affixes are required; the suffix defaults to one that aligns on `SUFFIX_TIER`. */
function entry(
  { prefix, suffix = band(1, 2, SUFFIX_STAT) }: { prefix: ModifierRef; suffix?: ModifierRef },
  { itemLevelMin = 82, categoryId = 'weapon.bow', className = 'Bows' } = {},
): CraftedTrackedEntry {
  return { kind: 'crafted', categoryId, className, itemLevelMin, prefix, suffix, status: 'active' };
}

const failuresOf = (entries: readonly TrackedEntry[], weights: WeightsFile | null) =>
  crossFileChecks(entries, weights).failures;

const checksOf = (entries: readonly TrackedEntry[], weights: WeightsFile | null) =>
  failuresOf(entries, weights).map((failure) => [failure.check, failure.entryKey]);

describe('edge alignment (§2.4)', () => {
  const scoped = [T7(), T8()];

  it('counts a valueless line as [1, 1] in the extremes (§2.3)', () => {
    expect(edgeAlignment('prefix', band(1, 2), [tier([line(STAT)]), tier([line(STAT, [2, 2])])], 82)).toBeUndefined();
    expect(edgeAlignment('prefix', band(0, 1), [tier([line(STAT)])], 82)).toContain('extremes [1, 1]');
  });

  it.each([
    ['43.0–56.5', 43, 56.5],
    ['56.0–80.0', 56, 80],
    ['43.0–80.0', 43, 80],
  ])('accepts %s over T7 and T8', (_label, min, max) => {
    expect(edgeAlignment('prefix', band(min, max), scoped, 82)).toBeUndefined();
    expect(failuresOf([entry({ prefix: band(min, max) })], bows(pools(scoped)))).toEqual([]);
  });

  it.each([
    ['43.0–60.0, clipped', 43, 60],
    ['0–9999, sentinel', 0, 9999],
  ])('rejects %s', (_label, min, max) => {
    const tracked = entry({ prefix: band(min, max) });
    const [failure, ...rest] = failuresOf([tracked], bows(pools(scoped)));
    expect(rest).toEqual([]);
    expect(failure?.check).toBe('edge-alignment');
    expect(failure?.entryKey).toBe(canonicalKey(tracked));
    expect(failure?.detail).toContain('prefix');
    expect(failure?.detail).toContain(STAT);
    expect(failure?.detail).toContain('floor 82');
  });

  it('ignores a contained hybrid entry’s foreign statId line', () => {
    const hybrid = tier([line(STAT, [43, 56.5]), line(OTHER, [1, 500])]);
    expect(edgeAlignment('prefix', band(43, 56.5), [hybrid], 82)).toBeUndefined();
  });

  it('fails at the floor when a band aligns only above it', () => {
    const tracked = entry({ prefix: band(43, 80) }, { itemLevelMin: 70 });
    // At 70, T8 (75) leaves the scope, so the band's ceiling is past T7's.
    expect(checksOf([tracked], bows(pools(scoped)))).toEqual([['edge-alignment', canonicalKey(tracked)]]);
    expect(checksOf([{ ...tracked, itemLevelMin: 82 }], bows(pools(scoped)))).toEqual([]);
  });

  it('skips a valueless reference', () => {
    expect(edgeAlignment('prefix', valueless(), [tier([line(STAT)])], 82)).toBeUndefined();
  });
});

describe('empty containment set (§2.5)', () => {
  it('fails when no scoped entry contains the reference, naming the ref, the floor and the absence, and no file', () => {
    const tracked = entry({ prefix: band(12, 15) });
    const [failure, ...rest] = failuresOf([tracked], bows(pools([tier([line(STAT, [5, 15])])])));
    expect(rest).toEqual([]);
    expect(failure?.check).toBe('empty-containment-set');
    expect(failure?.detail).toContain(`prefix ${STAT} band [12, 15]`);
    expect(failure?.detail).toContain('floor 82');
    expect(failure?.detail).toContain('no scoped entry contains it');
    expect(failure?.detail).not.toMatch(/\.json|weights file|tracked list/i);
  });

  it('fails when only weight-0 tiers match, never P = 0', () => {
    const scoped = [tier([line(STAT, [43, 56.5])], { weight: 0 })];
    expect(emptyContainment('prefix', band(43, 56.5), scoped, 82)).toContain('no scoped entry contains it');
  });

  it('fails a tier that sits above the floor', () => {
    const scoped = [tier([line(STAT, [43, 56.5])], { itemLevelMin: 83 })];
    expect(checksOf([entry({ prefix: band(43, 56.5) })], bows(pools(scoped)))[0]?.[0]).toBe('empty-containment-set');
  });
});

describe('kind agreement (§2.3), universal', () => {
  it('fails a valueless reference when any scoped line on its statId is banded', () => {
    const scoped = [tier([line(STAT)], { itemLevelMin: 55 }), tier([line(STAT, [2, 2])], { itemLevelMin: 82 })];
    const tracked = entry({ prefix: valueless() });
    const failures = failuresOf([tracked], bows(pools(scoped)));
    expect(failures.map((failure) => failure.check)).toEqual(['kind-agreement']);
    expect(failures[0]?.detail).toContain('1 scoped line on that statId is banded');
  });

  it('passes a banded reference beside a valueless line, which reads as [1, 1]', () => {
    const scoped = [tier([line(STAT, [43, 56.5])]), tier([line(STAT)])];
    expect(checksOf([entry({ prefix: band(43, 56.5) })], bows(pools(scoped)))).toEqual([]);
  });

  it('passes a banded [1, 1] reference on a mixed-kind statId: it contains and aligns on the valueless tier', () => {
    const scoped = [tier([line(STAT)], { itemLevelMin: 55 }), tier([line(STAT, [2, 2])], { itemLevelMin: 82 })];
    expect(checksOf([entry({ prefix: band(1, 1) })], bows(pools(scoped)))).toEqual([]);
  });

  it('still fails a valueless reference beside one banded line, however many valueless lines agree', () => {
    const scoped = [tier([line(STAT)]), tier([line(STAT)]), tier([line(STAT, [2, 2])])];
    expect(checksOf([entry({ prefix: valueless() })], bows(pools(scoped)))[0]?.[0]).toBe('kind-agreement');
  });

  it('ignores a disagreeing line above the floor or at weight 0', () => {
    const scoped = [
      tier([line(STAT)]),
      tier([line(STAT, [2, 2])], { itemLevelMin: 90 }),
      tier([line(STAT, [3, 3])], { weight: 0 }),
    ];
    expect(checksOf([entry({ prefix: valueless() })], bows(pools(scoped)))).toEqual([]);
  });
});

describe('single-line pairs (§2.1 consequence 3)', () => {
  const hybrid = tier([line(STAT, [10, 20]), line(OTHER, [5, 6])]);
  const first = entry({ prefix: band(10, 20) });
  const second = entry({ prefix: band(5, 6, OTHER) });

  it('reports no co-occur for two statIds one tier holds; line-set completeness fails each band instead', () => {
    const failures = failuresOf([first, second], bows(pools([hybrid])));
    expect(failures.map((failure) => failure.check)).toEqual(['line-set-completeness', 'line-set-completeness']);
    expect(new Set(failures.map((failure) => failure.entryKey))).toEqual(
      new Set([canonicalKey(first), canonicalKey(second)]),
    );
    for (const failure of failures) {
      expect(failure.detail).toContain('band reaches into a hybrid tier');
      expect(failure.detail).toContain(hybrid.sourceModifierId);
    }
  });

  it('passes when no scoped entry carries both', () => {
    const apart = [tier([line(STAT, [10, 20])]), tier([line(OTHER, [5, 6])])];
    expect(checksOf([first, second], bows(pools(apart)))).toEqual([]);
  });
});

describe('hybrid references (§2.1–§2.5, §2.7)', () => {
  const A = STAT;
  const B = OTHER;
  const C = 'explicit.stat_3';
  /** A Bows-like family {A, B}: T1 and T2 share one modGroup. A pure A tier sits apart from both. */
  const H1 = tier([line(A, [30, 40]), line(B, [100, 150])], { itemLevelMin: 75, modGroup: 'hybrid-ab' });
  const H2 = tier([line(A, [20, 29]), line(B, [60, 99])], { itemLevelMin: 50, modGroup: 'hybrid-ab' });
  const PURE_A = tier([line(A, [70, 80])], { itemLevelMin: 60 });
  const hybridReference = (...lines: HybridLine[]): ModifierRef => ({ kind: 'hybrid', lines });
  const bandLine = (statId: string, valueMin: number, valueMax: number): HybridLine => ({ statId, valueMin, valueMax });
  const T1_REF = hybridReference(bandLine(A, 30, 40), bandLine(B, 100, 150));

  it('passes a correct hybrid at T1’s edges', () => {
    expect(failuresOf([entry({ prefix: T1_REF })], bows(pools([H1, H2, PURE_A])))).toEqual([]);
  });

  it('fails a misaligned line: line B covers T1 only and line A spans T1–T2', () => {
    const tracked = entry({ prefix: hybridReference(bandLine(A, 20, 40), bandLine(B, 100, 150)) });
    const failures = failuresOf([tracked], bows(pools([H1, H2, PURE_A])));
    expect(failures.map((failure) => failure.check)).toEqual(['edge-alignment']);
    const detail = failures[0]?.detail ?? '';
    expect(detail).toContain(`prefix hybrid line ${A} band [20, 40]`);
    expect(detail).toContain('extremes [30, 40]');
    expect(detail).toContain(`(${H1.sourceModifierId})`);
    expect(detail).not.toContain(B);
  });

  it('fails a reference that names a subset of a tier’s lines, naming the tier and the omitted line', () => {
    const wide = tier([line(A, [30, 40]), line(B, [100, 150]), line(C, [5, 10])]);
    const failures = failuresOf([entry({ prefix: T1_REF })], bows(pools([H1, wide])));
    expect(failures.map((failure) => failure.check)).toEqual(['line-set-completeness']);
    const detail = failures[0]?.detail ?? '';
    expect(detail).toContain("reference names a subset of this tier's lines");
    expect(detail).toContain(`${wide.sourceModifierId} {${A}, ${B}, ${C}} omits ${C}`);
  });

  it('fails a single-line band that reaches into a hybrid tier', () => {
    const pure = tier([line(A, [35, 45])]);
    const failures = failuresOf([entry({ prefix: band(35, 45, A) })], bows(pools([pure, H1])));
    expect(failures.map((failure) => failure.check)).toEqual(['line-set-completeness']);
    const detail = failures[0]?.detail ?? '';
    expect(detail).toContain('band reaches into a hybrid tier');
    expect(detail).toContain(`${H1.sourceModifierId} {${A}, ${B}} interval [30, 40]`);
  });

  it('fails an empty containment set, listing the wider tier that covers every line and what differs', () => {
    const wide = tier([line(A, [30, 40]), line(B, [100, 150]), line(C, [5, 10])]);
    const gone = tier([line(A, [30, 40]), line(B, [100, 150])], { weight: 0 });
    const notInGame: ModifierWeight = { ...gone, sourceModifierId: 'not-in-game-ab', weightSource: 'not-in-game' };
    const failures = failuresOf([entry({ prefix: T1_REF })], bows(pools([wide, notInGame])));
    const empty = failures.find((failure) => failure.check === 'empty-containment-set');
    expect(empty?.detail).toContain(`prefix hybrid (${A} band [30, 40], ${B} band [100, 150]) at floor 82`);
    expect(empty?.detail).toContain('no scoped entry contains it');
    expect(empty?.detail).toContain(`${wide.sourceModifierId} (line set {${A}, ${B}, ${C}} differs on ${C})`);
    expect(empty?.detail).toContain('not-in-game-ab (not-in-game)');
    expect(empty?.detail).not.toMatch(/\.json/);
  });

  it('fails contained tiers in two modGroups, blaming weights.json', () => {
    const split = tier([line(A, [20, 29]), line(B, [60, 99])], { itemLevelMin: 50, modGroup: 'hybrid-ab-2' });
    const tracked = entry({ prefix: hybridReference(bandLine(A, 20, 40), bandLine(B, 60, 150)) });
    const failures = failuresOf([tracked], bows(pools([H1, split])));
    expect(failures.map((failure) => failure.check)).toEqual(['line-set-completeness']);
    const detail = failures[0]?.detail ?? '';
    expect(detail).toContain('weights data publishes one hybrid family under more than one modGroup');
    expect(detail).toContain(`modGroup hybrid-ab: ${H1.sourceModifierId}`);
    expect(detail).toContain(`modGroup hybrid-ab-2: ${split.sourceModifierId}`);
    expect(detail).toContain('weights.json is at fault');
  });

  it('fails kind agreement on a valueless hybrid line beside a banded line, naming the line and one tier', () => {
    const tracked = entry({ prefix: hybridReference(bandLine(A, 30, 40), { statId: B }) });
    const failures = failuresOf([tracked], bows(pools([H1])));
    const kind = failures.find((failure) => failure.check === 'kind-agreement');
    expect(kind?.detail).toContain(`prefix hybrid line ${B} valueless`);
    expect(kind?.detail).toContain(`(e.g. ${H1.sourceModifierId})`);
    expect(kind?.detail).not.toContain(`line ${A}`);
  });

  it('fails co-occur on both entries when a hybrid and a single-line reference share a contained tier', () => {
    const pure = tier([line(A, [30, 40])]);
    const hybridEntry = entry({ prefix: T1_REF });
    const singleEntry = entry({ prefix: band(30, 40, A) });
    const failures = failuresOf([hybridEntry, singleEntry], bows(pools([H1, pure])));
    // The single-line band also reaches into H1, so §2.7 reports it beside co-occur.
    const byString = (pairs: readonly (readonly string[])[]) => pairs.map((pair) => JSON.stringify(pair)).toSorted();
    expect(byString(failures.map((failure) => [failure.check, failure.entryKey]))).toEqual(
      byString([
        ['co-occur', canonicalKey(hybridEntry)],
        ['co-occur', canonicalKey(singleEntry)],
        ['line-set-completeness', canonicalKey(singleEntry)],
      ]),
    );
    const coOccurs = failures.filter((failure) => failure.check === 'co-occur');
    expect(coOccurs.map((failure) => failure.entryKey).toSorted()).toEqual(
      [canonicalKey(hybridEntry), canonicalKey(singleEntry)].toSorted(),
    );
    for (const failure of coOccurs) {
      const partner = failure.entryKey === canonicalKey(hybridEntry) ? singleEntry : hybridEntry;
      expect(failure.detail).toContain(`overlaps ${canonicalKey(partner)}`);
      expect(failure.detail).toContain('prefix (shared lines intersect and one scoped tier contains both)');
      expect(failure.detail).toContain('suffix (bands intersect)');
    }
  });

  it('fails co-occur on two suffix hybrids that both contain one scoped suffix tier', () => {
    const E = 'explicit.stat_7';
    const D = 'explicit.stat_8';
    const S1 = tier([line(E, [10, 20]), line(D, [5, 6])], { modGroup: 'hybrid-cd' });
    const S2 = tier([line(E, [21, 25]), line(D, [5, 6])], { modGroup: 'hybrid-cd' });
    const prefix = band(43, 56.5);
    const narrow = entry({ prefix, suffix: hybridReference(bandLine(E, 10, 20), bandLine(D, 5, 6)) });
    const wide = entry({ prefix, suffix: hybridReference(bandLine(E, 10, 25), bandLine(D, 5, 6)) });
    const failures = failuresOf([narrow, wide], bows(pools([T7()], [S1, S2])));
    expect(failures.map((failure) => [failure.check, failure.entryKey]).toSorted()).toEqual(
      [
        ['co-occur', canonicalKey(narrow)],
        ['co-occur', canonicalKey(wide)],
      ].toSorted(),
    );
    for (const failure of failures) {
      expect(failure.detail).toContain('prefix (bands intersect)');
      expect(failure.detail).toContain('suffix (shared lines intersect and one scoped tier contains both)');
    }
  });

  it('stays silent on an overlapping all-single-line pair, which is contracts’ to refuse', () => {
    const pool = [tier([line(A, [30, 40])]), tier([line(A, [35, 45])])];
    expect(failuresOf([entry({ prefix: band(30, 40, A) }), entry({ prefix: band(35, 45, A) })], bows(pools(pool)))).toEqual(
      [],
    );
  });

  it('leaves weight-0 and not-in-game hybrid tiers out of what a band reaches', () => {
    const zero = tier([line(A, [30, 40]), line(B, [100, 150])], { weight: 0 });
    // Weight 100, which the weights schema forbids, so only `untrackable` keeps it out of `reached`.
    const notInGame: ModifierWeight = { ...zero, sourceModifierId: 'not-in-game-ab', weight: 100, weightSource: 'not-in-game' };
    const pure = tier([line(A, [30, 40])]);
    expect(failuresOf([entry({ prefix: band(30, 40, A) })], bows(pools([pure, zero, notInGame])))).toEqual([]);
  });

  it('reaches a hybrid tier from a valueless reference only through a valueless line', () => {
    const valuelessA = tier([line(A), line(B, [1, 2])]);
    const failures = failuresOf([entry({ prefix: valueless(A) })], bows(pools([valuelessA])));
    expect(failures.map((failure) => failure.check)).toEqual(['line-set-completeness']);
    expect(failures[0]?.detail).toContain('band reaches into a hybrid tier');

    const bandedA = tier([line(A, [30, 40]), line(B, [1, 2])]);
    const checks = failuresOf([entry({ prefix: valueless(A) })], bows(pools([bandedA]))).map((failure) => failure.check);
    expect(checks).not.toContain('line-set-completeness');
  });

  it('reports no co-occur when the bands on the shared line are disjoint', () => {
    const pure = tier([line(A, [70, 80])]);
    const failures = failuresOf([entry({ prefix: T1_REF }), entry({ prefix: band(70, 80, A) })], bows(pools([H1, pure])));
    expect(failures).toEqual([]);
  });

  describe('a hybrid pair whose shared line is summed (§2.1, §2.2)', () => {
    const L = 'explicit.stat_light';
    /** A suffix family {B, L} in one modGroup, whose L line rolls 15 on every tier. */
    const suffixTier = (bMin: number, bMax: number) =>
      tier([line(B, [bMin, bMax]), line(L, [15, 15])], { modGroup: 'light-acc' });
    const SL_HIGH = suffixTier(200, 250);
    const SL1 = suffixTier(41, 60);
    const SL2 = suffixTier(21, 40);
    const weights = bows(pools([H1], [SL_HIGH, SL1, SL2]));
    const withSuffix = (bMin: number, bMax: number) =>
      entry({ prefix: T1_REF, suffix: hybridReference(bandLine(B, bMin, bMax), bandLine(L, 15, 15)) });

    it('memoises coOccur per S: one instance answers the same pair differently under an empty and a summed S', () => {
      const x = hybridReference(bandLine(B, 41, 60), bandLine(L, 15, 15));
      const y = hybridReference(bandLine(B, 50, 55), bandLine(L, 15, 15));
      const scoped = { prefix: [], suffix: [SL1] };
      const summedB = new Set([B]);

      const emptyFirst = coOccur(scoped);
      expect(emptyFirst(x, y, 'suffix', new Set())).toBe(false);
      expect(emptyFirst(x, y, 'suffix', summedB)).toBe(true);

      const summedFirst = coOccur(scoped);
      expect(summedFirst(x, y, 'suffix', summedB)).toBe(true);
      expect(summedFirst(x, y, 'suffix', new Set())).toBe(false);
    });

    it('fails co-occur on both entries when the sums intersect, though the per-slot B bands are disjoint', () => {
      const low = withSuffix(41, 60);
      const lower = withSuffix(21, 40);
      const failures = failuresOf([low, lower], weights);
      expect(failures.map((failure) => [failure.check, failure.entryKey]).toSorted()).toEqual(
        [
          ['co-occur', canonicalKey(low)],
          ['co-occur', canonicalKey(lower)],
        ].toSorted(),
      );
      for (const failure of failures) {
        expect(failure.detail).toContain('prefix (shared lines intersect and one scoped tier contains both)');
        expect(failure.detail).toContain('suffix (shared lines intersect and one scoped tier contains both)');
        expect(failure.detail).toContain(`sum ${B} [141, 210] and [121, 190] intersect`);
      }
    });

    it('reports no co-occur when the sums are disjoint, though both slots overlap outside them', () => {
      expect(failuresOf([withSuffix(41, 60), withSuffix(200, 250)], weights)).toEqual([]);
    });
  });
});

describe('unvalidated marks (§2.8)', () => {
  const a = entry({ prefix: band(43, 56.5) });
  const b = entry({ prefix: band(56, 80) });

  it('marks every crafted entry weights-absent, and fails none, without a weights file', () => {
    expect(crossFileChecks([a, b], null)).toEqual({
      failures: [],
      unvalidated: [a, b]
        .map((tracked) => ({
          entryKey: canonicalKey(tracked),
          categoryId: 'weapon.bow',
          className: 'Bows',
          reason: 'weights-absent',
        }))
        .toSorted((left, right) => (left.entryKey < right.entryKey ? -1 : 1)),
    });
  });

  it('marks every entry of a partial or absent class partial-pool, with no pool failure', () => {
    const sentinel = entry({ prefix: band(0, 9999) });
    const partial = crossFileChecks([sentinel, b], bows(pools([T7()], [SUFFIX_TIER], { suffix: 'partial' })));
    expect(partial.failures).toEqual([]);
    expect(partial.unvalidated.map((mark) => [mark.entryKey, mark.reason])).toEqual(
      [sentinel, b].map((tracked) => [canonicalKey(tracked), 'partial-pool']).toSorted(),
    );
    const absent = crossFileChecks([sentinel], weightsOf({}));
    expect(absent.unvalidated.map((mark) => mark.reason)).toEqual(['partial-pool']);
  });

  it('marks nothing on a complete class', () => {
    expect(crossFileChecks([a], bows(pools([T7(), T8()])))).toEqual({ failures: [], unvalidated: [] });
  });
});

describe('class discriminability (§2.6)', () => {
  const plain = pools([T7()]);

  it('fails a plain class in a mixed category, naming class, category, sibling count and the reason', () => {
    const weights = weightsOf({
      'armour.chest': { Body_Armours: plain, Body_Armours_dex: plain, Body_Armours_str: plain },
    });
    const tracked = entry({ prefix: band(43, 56.5) }, { categoryId: 'armour.chest', className: 'Body_Armours' });
    const failures = failuresOf([tracked], weights);
    expect(failures.map((failure) => failure.check)).toEqual(['class-discriminability']);
    const detail = failures[0]?.detail ?? '';
    for (const part of ['Body_Armours', 'armour.chest', '2 sibling classes', 'class not discriminable']) {
      expect(detail).toContain(part);
    }
  });

  it('passes arm 1, arm 2 and arm 3', () => {
    const mixed = weightsOf({ 'armour.chest': { Body_Armours_dex: plain, Body_Armours_str: plain } });
    const jewels = weightsOf({ jewel: { Emerald: plain, Ruby: plain } });
    const single = weightsOf({ 'weapon.bow': { Bows: plain } });
    expect(classDiscriminability({ categoryId: 'armour.chest', className: 'Body_Armours_dex' }, mixed)).toBeUndefined();
    expect(classDiscriminability({ categoryId: 'jewel', className: 'Emerald' }, jewels)).toBeUndefined();
    expect(classDiscriminability({ categoryId: 'weapon.bow', className: 'Bows' }, single)).toBeUndefined();
  });
});

describe('crossFileChecks scope', () => {
  it('runs no check without a weights file', () => {
    expect(failuresOf([entry({ prefix: band(0, 9999) })], null)).toEqual([]);
  });

  it('runs no pool check on an absent class or a partial slot', () => {
    const tracked = entry({ prefix: band(0, 9999) });
    expect(failuresOf([tracked], weightsOf({}))).toEqual([]);
    expect(failuresOf([tracked], bows(pools([T7()], [SUFFIX_TIER], { suffix: 'partial' })))).toEqual([]);
  });

  it('still runs class discriminability on a class whose own pool is partial', () => {
    const complete = pools([T7()]);
    const weights = weightsOf({
      'armour.chest': {
        Body_Armours: pools([T7()], [SUFFIX_TIER], { prefix: 'partial' }),
        Body_Armours_dex: complete,
        Body_Armours_str: complete,
      },
    });
    const tracked = entry({ prefix: band(0, 9999) }, { categoryId: 'armour.chest', className: 'Body_Armours' });
    expect(checksOf([tracked], weights)).toEqual([['class-discriminability', canonicalKey(tracked)]]);
  });

  it('sees neither pruned nor raw entries', () => {
    const pruned: TrackedEntry = { ...entry({ prefix: band(0, 9999) }), status: 'pruned', prunedReason: 'gone' };
    const raw: TrackedEntry = { kind: 'raw', baseTypeId: 'Gold Amulet', itemLevelMin: 82, status: 'active' };
    expect(failuresOf([pruned, raw], bows(pools([T7()])))).toEqual([]);
  });

  it('reports one failure per (check, entry), every slot in its detail, sorted by key then check', () => {
    const tracked = entry({ prefix: band(0, 9999), suffix: band(0, 9999, SUFFIX_STAT) });
    const alsoEmpty = entry({ prefix: band(1000, 2000), suffix: band(1, 2, SUFFIX_STAT) });
    const failures = failuresOf([tracked, alsoEmpty], bows(pools([T7(), T8()])));
    const edge = failures.find((failure) => failure.check === 'edge-alignment');
    expect(edge?.detail).toContain('prefix');
    expect(edge?.detail).toContain('suffix');
    expect(failures.filter((failure) => failure.check === 'edge-alignment')).toHaveLength(1);
    const keys = failures.map((failure) => `${failure.entryKey}|${failure.check}`);
    expect(keys).toEqual(keys.toSorted());
    expect(failures[0]).toMatchObject({ categoryId: 'weapon.bow', className: 'Bows' });
  });

  it('finds no failure on the committed files', async () => {
    const here = (import.meta as ImportMeta & { readonly dirname: string }).dirname;
    const load = async (name: string): Promise<unknown> =>
      ((await import(/* @vite-ignore */ `${here}/../../../test/fixtures/frozen-data/${name}`)) as { default: unknown }).default;
    const tracked = parseEnvelope(TrackedFileSchema, await load('tracked.json'), TRACKED_SCHEMA_VERSION);
    const weights = parseEnvelope(WeightsFileSchema, await load('weights.json'), WEIGHTS_SCHEMA_VERSION);
    if (!tracked.ok || !weights.ok) {
      throw new Error('a committed data file was refused');
    }
    expect(failuresOf(tracked.value.entries, weights.value)).toEqual([]);
  });
});
