import { rank } from '@poe/core';
import type { CraftedRankedRow, PriceTrust } from '@poe/contracts';
import { describe, expect, it } from 'vitest';

import { DEFAULT_THRESHOLD } from '../../shared/product';
import { TEST_LEAGUE } from '../../test-support/artifact-server';
import { NOW_ISO } from '../../test-support/dom';
import { toDisplayRows } from '../display-rows';

const CURRENT: PriceTrust = { verdict: 'current', reasons: [] };

/** A costable crafted row where nothing clears, as `core` ranks it. */
function nothingClears(categoryId: string, className: string, craftCost: number): CraftedRankedRow {
  return {
    kind: 'crafted',
    classKey: JSON.stringify(['crafted', categoryId, className]),
    categoryId,
    className,
    itemLevelMin: 82,
    recipeId: 'greater',
    grossPayout: 0,
    craftCost,
    ev: -craftCost,
    summands: [],
    combinations: [],
    provenance: 'measured',
    trust: CURRENT,
  };
}

describe('a jewel class row (FR-26)', () => {
  // State 21: a jewel subtracts no Craft Cost, so nothing clearing prints a dimmed `0.00`.
  it('is marked as a jewel and dims its 0.00 when nothing clears', () => {
    const ranking = rank({ tracked: [], dataset: [], activeLeague: TEST_LEAGUE, now: NOW_ISO, threshold: DEFAULT_THRESHOLD, weights: undefined });
    const ordering = [nothingClears('jewel', 'Emerald', 0), nothingClears('weapon.bow', 'Bows', 0.03)];
    const rows = toDisplayRows({ ...ranking, ordering }, [], { honestEmpty: false });
    expect(rows.map((row) => [row.label, row.ev, row.unit === 'class' && row.isJewel])).toEqual([
      ['Emerald', { kind: 'figure', text: '0.00', negative: true }, true],
      ['Bows', { kind: 'figure', text: '−0.03', negative: true }, false],
    ]);
  });
});
