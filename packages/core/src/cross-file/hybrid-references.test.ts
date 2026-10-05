import { canonicalKey } from '@poe/contracts';
import type { HybridLine, ModifierReference, ModifierWeight } from '@poe/contracts';
import { describe, expect, it } from 'vitest';

import { coOccur } from '../cross-file.ts';
import { band, bows, byCodeUnit, byPair, entry, failuresOf, line, OTHER, pools, STAT, T7, tier, valueless } from './test-support.ts';

const hybridReference = (...lines: HybridLine[]): ModifierReference => ({ kind: 'hybrid', lines });

const bandLine = (statId: string, valueMin: number, valueMax: number): HybridLine => ({ statId, valueMin, valueMax });

const byString = (pairs: readonly (readonly string[])[]) => pairs.map((pair) => JSON.stringify(pair)).toSorted(byCodeUnit);

describe('hybrid references (§2.1–§2.5, §2.7)', () => {
  const A = STAT;
  const B = OTHER;
  const C = 'explicit.stat_3';
  /** A Bows-like family {A, B}: T1 and T2 share one modGroup; a pure A tier sits apart. */
  const H1 = tier([line(A, [30, 40]), line(B, [100, 150])], { itemLevelMin: 75, modGroup: 'hybrid-ab' });
  const H2 = tier([line(A, [20, 29]), line(B, [60, 99])], { itemLevelMin: 50, modGroup: 'hybrid-ab' });
  const PURE_A = tier([line(A, [70, 80])], { itemLevelMin: 60 });
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
    expect(byString(failures.map((failure) => [failure.check, failure.entryKey]))).toEqual(
      byString([
        ['co-occur', canonicalKey(hybridEntry)],
        ['co-occur', canonicalKey(singleEntry)],
        ['line-set-completeness', canonicalKey(singleEntry)],
      ]),
    );
    const coOccurs = failures.filter((failure) => failure.check === 'co-occur');
    expect(coOccurs.map((failure) => failure.entryKey).toSorted(byCodeUnit)).toEqual(
      [canonicalKey(hybridEntry), canonicalKey(singleEntry)].toSorted(byCodeUnit),
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
    expect(failures.map((failure) => [failure.check, failure.entryKey]).toSorted(byPair)).toEqual(
      [
        ['co-occur', canonicalKey(narrow)],
        ['co-occur', canonicalKey(wide)],
      ].toSorted(byPair),
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
    // Weight 100, which the schema forbids, so only `untrackable` keeps it out of `reached`.
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
      expect(failures.map((failure) => [failure.check, failure.entryKey]).toSorted(byPair)).toEqual(
        [
          ['co-occur', canonicalKey(low)],
          ['co-occur', canonicalKey(lower)],
        ].toSorted(byPair),
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
