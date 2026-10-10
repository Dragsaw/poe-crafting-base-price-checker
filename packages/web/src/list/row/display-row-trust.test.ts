import { rank, type Ranking } from '@poe/core';
import type { CraftedRankedRow, PriceTrust } from '@poe/contracts';
import { describe, expect, it } from 'vitest';

import { MINUS } from '../../shared/money';
import { TEST_LEAGUE } from '../../test-support/artifact-server';
import { NOW, NOW_ISO } from '../../test-support/dom';
import { hoursBefore, priced, rawEntry, unpriced } from '../../test-support/list-fixtures';
import { toDisplayRows, type ListRow } from '../display-rows';

/** The EV cell as a test reads it: the figure text, or `missing` where `—` prints beside a mark. */
function printedValue(row: ListRow | undefined): string | undefined {
  if (row === undefined) {
    return undefined;
  }
  return row.ev.kind === 'figure' ? row.ev.text : 'missing';
}

function craftedRow(trust: PriceTrust, expectedValue: number | undefined): CraftedRankedRow {
  return {
    kind: 'crafted',
    classKey: '["crafted","weapon.bow","Bows"]',
    categoryId: 'weapon.bow',
    className: 'Bows',
    itemLevelMin: 82,
    recipeId: 'greater',
    grossPayout: 0,
    craftCost: expectedValue === undefined ? { kind: 'uncostable', currencyId: 'chaos' } : 0.03,
    // eslint-disable-next-line unicorn/no-null -- boundary: `CraftedRankedRow.ev` is null exactly when the recipe is uncostable (AD-20).
    ev: expectedValue ?? null,
    summands: [],
    combinations: [],
    provenance: 'measured',
    trust,
  };
}

function rankingOf(row: CraftedRankedRow): Ranking {
  return {
    ordering: [row],
    belowThreshold: [],
    noListings: [],
    notYetSynced: [],
    unresolvable: [],
    unrankable: [],
    uncostableRecipes: [],
    pricedInLeague: true,
  };
}

describe('the trust each row carries', () => {
  it('carries core’s verdict verbatim on a ranked raw row and on each unpriced row', () => {
    const fresh = rawEntry('Gold Amulet');
    const old = rawEntry('Solar Amulet');
    const tried = rawEntry('Coral Ring');
    const lost = rawEntry('Lost Ring');
    const dataset = [
      priced(fresh, 1, hoursBefore(NOW, 1)),
      priced(old, 2, hoursBefore(NOW, 4 * 24 + 1)),
      unpriced(tried, { state: 'no-listings' }, hoursBefore(NOW, 2)),
      unpriced(lost, { state: 'unresolvable' }, hoursBefore(NOW, 1)),
    ];
    const ranking = rank({ tracked: [fresh, old, tried, lost], dataset, activeLeague: TEST_LEAGUE, now: NOW_ISO, threshold: 0, weights: undefined });
    const rows = toDisplayRows(ranking, dataset);
    const expected = new Map([
      ...ranking.ordering.flatMap((row) => (row.kind === 'raw' ? [[row.entryKey, row.trust] as const] : [])),
      ...[...ranking.noListings, ...ranking.notYetSynced, ...ranking.unresolvable].map((entry) => [entry.entryKey, entry.trust] as const),
    ]);
    expect(rows).toHaveLength(4);
    for (const row of rows) {
      expect(row.trust, row.label).toBe(expected.get(row.key));
    }
    expect(rows.map((row) => row.trust.verdict)).toEqual(['rough', 'current', 'pending', 'broken']);
    expect(rows.map((row) => printedValue(row))).toEqual(['2.00', '1.00', 'missing', 'missing']);
  });

  // States 18, 21, 35 and 41: `—` beside a pending or broken mark; a negative is a real, dimmed figure.
  it.each([
    [{ verdict: 'pending', reasons: [{ kind: 'no-prices' }] }, -0.03, 'missing', false],
    [{ verdict: 'broken', reasons: [{ kind: 'all-broken' }] }, -0.03, 'missing', false],
    [{ verdict: 'pending', reasons: [{ kind: 'uncostable' }] }, undefined, 'missing', false],
    [{ verdict: 'current', reasons: [] }, -0.03, `${MINUS}0.03`, true],
    [{ verdict: 'rough', reasons: [{ kind: 'unreliable-share', percent: 74 }] }, 1.5, '1.50', false],
  ] as const)('prints a crafted %j row at EV %s as %s', (trust, expectedValue, printed, isNegative) => {
    const own: PriceTrust = { verdict: trust.verdict, reasons: [...trust.reasons] };
    const [row] = toDisplayRows(rankingOf(craftedRow(own, expectedValue)), [], { honestEmpty: false });
    expect(printedValue(row)).toBe(printed);
    expect(row?.trust).toEqual(trust);
    expect(row?.ev.kind === 'figure' && row.ev.negative).toBe(isNegative);
  });
});
