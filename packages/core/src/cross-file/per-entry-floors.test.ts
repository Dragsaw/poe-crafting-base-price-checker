import { canonicalKey } from '@poe/contracts';
import type { HybridLine } from '@poe/contracts';
import { describe, expect, it } from 'vitest';

import { CRAFTING_ITEM_LEVELS } from '../crafting-item-level.ts';
import { rank } from '../rank.ts';
import { band, bows, byPair, entry, failuresOf, line, OTHER, pools, STAT, T7, T8, tier, valueless } from './test-support.ts';

const bandLine = (statId: string, valueMin: number, valueMax: number): HybridLine => ({ statId, valueMin, valueMax });

describe('crossFileChecks: per-entry floors (AD-5, AD-17; FR-16)', () => {
  const otherTier = tier([line(OTHER, [1, 5])]);

  // I/O matrix: "Mixed floors load".
  it('passes crafted entries on one class at 75 and 82', () => {
    const low = entry({ prefix: band(56, 80) }, { itemLevelMin: 75 });
    const top = entry({ prefix: band(1, 5, OTHER) });
    expect(failuresOf([low, top], bows(pools([T8(), otherTier])))).toEqual([]);
  });

  // I/O matrix: "Mixed-floor hybrid pair that overlaps at 82".
  it('checks a mixed-floor hybrid pair at the highest offered level and names it', () => {
    // Only the pool at 82 holds the shared tier, so the overlap shows only at the highest offered level.
    const hybrid = tier([line(STAT, [30, 40]), line(OTHER, [100, 150])], { itemLevelMin: 80, modGroup: 'hybrid-ab' });
    const pure = tier([line(STAT, [30, 40])]);
    const hybridEntry = entry({ prefix: { kind: 'hybrid', lines: [bandLine(STAT, 30, 40), bandLine(OTHER, 100, 150)] } }, { itemLevelMin: 75 });
    const singleEntry = entry({ prefix: band(30, 40) });
    const failures = failuresOf([hybridEntry, singleEntry], bows(pools([hybrid, pure])));
    // The hybrid's own-floor check sees no tier at 75; the single band reaches the hybrid tier, as in hybrid-references.
    expect(failures.map((failure) => [failure.check, failure.entryKey]).toSorted(byPair)).toEqual(
      [
        ['co-occur', canonicalKey(hybridEntry)],
        ['empty-containment-set', canonicalKey(hybridEntry)],
        ['co-occur', canonicalKey(singleEntry)],
        ['line-set-completeness', canonicalKey(singleEntry)],
      ].toSorted(byPair),
    );
    expect(failures.find((failure) => failure.check === 'empty-containment-set')?.detail).toContain('at floor 75');
    const coOccurs = failures.filter((failure) => failure.check === 'co-occur');
    for (const failure of coOccurs) {
      expect(failure.detail).toContain(`at item level ${String(Math.max(...CRAFTING_ITEM_LEVELS))}`);
    }
  });

  it('runs edge alignment at the entry’s own floor, so every level `rank` uses reads the same failures (AD-17)', () => {
    const misaligned = entry({ prefix: band(0, 9999) }, { itemLevelMin: 75 });
    const top = entry({ prefix: band(1, 5, OTHER) });
    const weights = bows(pools([T7(), T8(), otherTier]));
    const failures = failuresOf([misaligned, top], weights);
    const edge = failures.find((failure) => failure.check === 'edge-alignment');
    expect(edge?.entryKey).toBe(canonicalKey(misaligned));
    expect(edge?.detail).toContain('at floor 75');
    expect(failures.filter((failure) => failure.entryKey === canonicalKey(misaligned))).toEqual(failuresOf([misaligned], weights));
    const unrankableAt = (craftingItemLevel: (typeof CRAFTING_ITEM_LEVELS)[number]) =>
      rank({
        tracked: [misaligned, top],
        dataset: [],
        activeLeague: 'Forbidden Rites',
        threshold: 0,
        now: '2026-09-27T00:00:00Z',
        weights,
        crossFileFailures: failures,
        craftingItemLevel,
      }).unrankable;
    expect(unrankableAt(79)).toEqual([{ categoryId: 'weapon.bow', className: 'Bows', reason: 'class disagrees with weights file' }]);
    expect(unrankableAt(82)).toEqual(unrankableAt(79));
  });

  describe('the checks that search the pool run at the highest offered level, whatever the floor (AD-17)', () => {
    const highest = `at item level ${String(Math.max(...CRAFTING_ITEM_LEVELS))}`;
    // Only the pool at 80 and above holds the hybrid tier, so a check at the floor of 75 cannot see it.
    const hybridAt80 = tier([line(STAT, [30, 40]), line(OTHER, [100, 150])], { itemLevelMin: 80, modGroup: 'hybrid-ab' });

    it('fails a same-floor hybrid pair that co-occurs only above its floor, and a band that reaches that hybrid tier', () => {
      const hybridEntry = entry({ prefix: { kind: 'hybrid', lines: [bandLine(STAT, 30, 40), bandLine(OTHER, 100, 150)] } }, { itemLevelMin: 75 });
      const singleEntry = entry({ prefix: band(30, 40) }, { itemLevelMin: 75 });
      const failures = failuresOf([hybridEntry, singleEntry], bows(pools([hybridAt80, tier([line(STAT, [30, 40])])])));
      const searched = failures.filter((failure) => failure.check === 'co-occur' || failure.check === 'line-set-completeness');
      expect(searched.map((failure) => [failure.check, failure.entryKey]).toSorted(byPair)).toEqual(
        [
          ['co-occur', canonicalKey(hybridEntry)],
          ['co-occur', canonicalKey(singleEntry)],
          ['line-set-completeness', canonicalKey(singleEntry)],
        ].toSorted(byPair),
      );
      for (const failure of searched) {
        expect(failure.detail).toContain(highest);
      }
    });

    it('fails a valueless reference whose statId gains a banded tier only above its floor', () => {
      const valuelessEntry = entry({ prefix: valueless() }, { itemLevelMin: 75 });
      const failures = failuresOf([valuelessEntry], bows(pools([tier([line(STAT)]), tier([line(STAT, [5, 10])], { itemLevelMin: 80 })])));
      expect(failures.map((failure) => failure.check)).toEqual(['kind-agreement']);
      expect(failures[0]?.detail).toContain(highest);
    });

    it('passes the same entries when the pool gains no tier above their floor', () => {
      const valuelessEntry = entry({ prefix: valueless(OTHER) }, { itemLevelMin: 75 });
      const singleEntry = entry({ prefix: band(30, 40) }, { itemLevelMin: 75 });
      expect(failuresOf([valuelessEntry, singleEntry], bows(pools([tier([line(OTHER)]), tier([line(STAT, [30, 40])])])))).toEqual([]);
    });
  });
});
