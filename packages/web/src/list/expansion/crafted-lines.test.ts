import { classKeyOf, type Ranking } from '@poe/core';
import { canonicalKey, type CraftedRankedRow, type CraftedTrackedEntry, type CurationStatus, type PriceTrust } from '@poe/contracts';
import { describe, expect, it } from 'vitest';

import { NOW } from '../../test-support/dom';
import { craftedEntry, hoursBefore, priced } from '../../test-support/list-fixtures';
import { toDisplayRows, type ClassDisplayRow } from '../display-rows';

const onRings = (statId: string, status: CurationStatus = 'active'): CraftedTrackedEntry => ({
  ...craftedEntry('Rings', 'accessory.ring'),
  prefix: { kind: 'valueless', statId },
  status,
  ...(status === 'pruned' && { prunedReason: `${statId} sells slowly` }),
});

describe('the lines of a crafted row', () => {
  const CURRENT: PriceTrust = { verdict: 'current', reasons: [] };
  const ROUGH: PriceTrust = { verdict: 'rough', reasons: [{ kind: 'thin', listings: 1 }] };
  const PENDING: PriceTrust = { verdict: 'pending', reasons: [{ kind: 'never-synced' }] };
  const BROKEN: PriceTrust = { verdict: 'broken', reasons: [{ kind: 'unresolvable' }] };

  const top = onRings('explicit.stat_a');
  const second = onRings('explicit.stat_b', 'pinned');
  const cheap = onRings('explicit.stat_c');
  const waiting = onRings('explicit.stat_d');
  const gone = onRings('explicit.stat_e');
  const prunedLate = onRings('explicit.stat_z', 'pruned');
  const prunedEarly = onRings('explicit.stat_y', 'pruned');
  const elsewhere = { ...craftedEntry('Amulets', 'accessory.amulet'), status: 'pruned' as const, prunedReason: 'other class' };

  function linesOf(): ClassDisplayRow {
    const row: CraftedRankedRow = {
      kind: 'crafted',
      classKey: classKeyOf('accessory.ring', 'Rings'),
      categoryId: 'accessory.ring',
      className: 'Rings',
      itemLevelMin: 82,
      recipeId: 'greater',
      grossPayout: 3,
      craftCost: 0.03,
      ev: 2.97,
      // Core's order, deliberately not canonical: the second summand sorts before the first by key.
      summands: [
        { entryKey: canonicalKey(second), probability: 0.5, priceDivine: 4, contribution: 2, trust: ROUGH },
        { entryKey: canonicalKey(top), probability: 0.25, priceDivine: 4, contribution: 1, trust: CURRENT },
      ],
      combinations: [
        { entryKey: canonicalKey(cheap), trust: ROUGH, priceDivine: 0.1 },
        { entryKey: canonicalKey(waiting), trust: PENDING },
        { entryKey: canonicalKey(gone), trust: BROKEN },
      ],
      provenance: 'measured',
      trust: CURRENT,
    };
    const ranking: Ranking = {
      ordering: [row],
      belowThreshold: [],
      noListings: [],
      notYetSynced: [],
      unresolvable: [],
      unrankable: [],
      recipeless: [],
      uncostableRecipes: [],
      pricedInLeague: true,
    };
    const tracked = [prunedLate, top, gone, elsewhere, cheap, waiting, second, prunedEarly];
    const [only] = toDisplayRows(ranking, [priced(cheap, 0.1, hoursBefore(NOW, 1))], {
      crafted: { tracked, stats: new Map() },
    });
    if (only?.unit !== 'class') {
      throw new Error('no crafted row');
    }
    return only;
  }

  // FR-8: `web` reorders nothing. Summands by contribution, then core's combinations.
  it('keeps core’s order, each line with its own trust and curation', () => {
    const lines = linesOf().combinations;
    expect(lines.map((line) => line.key)).toEqual([second, top, cheap, waiting, gone].map((entry) => canonicalKey(entry)));
    expect(lines.map((line) => line.trust)).toEqual([ROUGH, CURRENT, ROUGH, PENDING, BROKEN]);
    expect(lines.map((line) => line.status)).toEqual(['pinned', 'active', 'active', 'active', 'active']);
  });

  // State 20: a priced combination is below the threshold, and keeps its stored price.
  it('flags only a priced combination as below threshold, and prices only priced lines', () => {
    const lines = linesOf().combinations;
    expect(lines.map((line) => line.isBelowThreshold)).toEqual([false, false, true, false, false]);
    expect(lines.map((line) => line.price)).toEqual([4, 4, 0.1, undefined, undefined]);
  });

  // FR-15, state 10: the class's pruned entries, by canonical key, with the curator's reason.
  it('carries the class’s pruned entries by canonical key, with their reasons', () => {
    const { pruned } = linesOf();
    expect(pruned.map((line) => [line.key, line.reason])).toEqual([
      [canonicalKey(prunedEarly), 'explicit.stat_y sells slowly'],
      [canonicalKey(prunedLate), 'explicit.stat_z sells slowly'],
    ]);
  });
});
