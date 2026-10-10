import { canonicalKey, compareCanonicalKeys, type CraftedTrackedEntry, type DatasetEntry, type PriceTrust, type TrackedEntry } from '@poe/contracts';
import { classKeyOf, rank, type RecipelessClass } from '@poe/core';
import { describe, expect, it } from 'vitest';

import { DEFAULT_THRESHOLD } from '../../shared/product';
import { TEST_LEAGUE } from '../../test-support/artifact-server';
import { NOW, NOW_ISO } from '../../test-support/dom';
import { craftedEntry, hoursBefore, priced, rawEntry, unpriced } from '../../test-support/list-fixtures';
import { toDisplayRows, type ClassDisplayRow, type ListRow } from '../display-rows';

const NO_RECIPE: PriceTrust = { verdict: 'pending', reasons: [{ kind: 'no-recipe' }] };
const CURRENT: PriceTrust = { verdict: 'current', reasons: [] };
const NEVER: PriceTrust = { verdict: 'pending', reasons: [{ kind: 'never-synced' }] };

const amulets = craftedEntry('Amulets', 'accessory.amulet');
const amuletsToo: CraftedTrackedEntry = { ...amulets, prefix: { kind: 'valueless', statId: 'explicit.stat_1' } };
const amuletsPruned: CraftedTrackedEntry = {
  ...amulets,
  prefix: { kind: 'valueless', statId: 'explicit.stat_2' },
  status: 'pruned',
  prunedReason: 'no market',
};
const bows = craftedEntry('Bows', 'weapon.bow');

/** `core`'s recipeless class, its entries' verdicts given in canonical key order. */
function recipeless(entries: readonly { entry: CraftedTrackedEntry; trust: RecipelessClass['trust'] }[]): RecipelessClass {
  const [first] = entries;
  if (first === undefined) {
    throw new Error('a recipeless class has an entry');
  }
  return {
    classKey: classKeyOf(first.entry.categoryId, first.entry.className),
    categoryId: first.entry.categoryId,
    className: first.entry.className,
    itemLevelMin: first.entry.itemLevelMin,
    trust: NO_RECIPE,
    combinations: entries
      .map(({ entry, trust }) => ({ entryKey: canonicalKey(entry), trust }))
      .toSorted((left, right) => compareCanonicalKeys(left.entryKey, right.entryKey)),
  };
}

function rowsFor(tracked: readonly TrackedEntry[], dataset: readonly DatasetEntry[], classes: readonly RecipelessClass[]): ListRow[] {
  const raw = tracked.filter((entry) => entry.kind === 'raw');
  const ranking = rank({ tracked: raw, dataset, activeLeague: TEST_LEAGUE, now: NOW_ISO, threshold: DEFAULT_THRESHOLD, weights: undefined });
  return toDisplayRows({ ...ranking, recipeless: classes }, dataset, { crafted: { tracked, stats: new Map() } });
}

const asClass = (row: ListRow | undefined): ClassDisplayRow | undefined => (row?.unit === 'class' ? row : undefined);

describe('toDisplayRows, the recipeless group (state 43)', () => {
  it('appends core’s recipeless classes below every Raw Base, unnumbered, the raw numerals unchanged', () => {
    const solar = rawEntry('Solar Amulet');
    const gold = rawEntry('Gold Amulet');
    const ring = rawEntry('Coral Ring');
    const tracked = [bows, amulets, amuletsToo, amuletsPruned, solar, gold, ring];
    const dataset = [
      priced(solar, 1.25, hoursBefore(NOW, 3)),
      priced(gold, 0.5, hoursBefore(NOW, 3)),
      unpriced(ring, { state: 'no-listings' }, hoursBefore(NOW, 2)),
      priced(amulets, 2, hoursBefore(NOW, 1)),
    ];
    const rows = rowsFor(tracked, dataset, [
      recipeless([{ entry: amulets, trust: CURRENT }, { entry: amuletsToo, trust: NEVER }]),
      recipeless([{ entry: bows, trust: NEVER }]),
    ]);
    expect(rows.map((row) => [row.label, row.numeral, row.tier, row.ev.kind])).toEqual([
      ['Solar Amulet', 1, 1, 'figure'],
      ['Gold Amulet', 2, 1, 'figure'],
      ['Coral Ring', undefined, 3, 'missing'],
      ['Amulets', undefined, 3, 'missing'],
      ['Bows', undefined, 3, 'missing'],
    ]);
    const row = asClass(rows[3]);
    expect(row?.trust).toEqual(NO_RECIPE);
    expect(row?.provenance).toBeUndefined();
    expect(row?.chase).toEqual([]);
    expect(row?.combinations.map((line) => [line.key, line.trust.verdict, line.price, line.isBelowThreshold])).toEqual(
      [
        [canonicalKey(amulets), 'current', 2, false],
        [canonicalKey(amuletsToo), 'pending', undefined, false],
      ].toSorted(([left], [right]) => compareCanonicalKeys(String(left), String(right))),
    );
    expect(row?.pruned.map((line) => [line.key, line.reason])).toEqual([[canonicalKey(amuletsPruned), 'no market']]);
  });

  it('joins the recipeless rows to the one canonical sequence in state 23', () => {
    const ring = rawEntry('Coral Ring');
    const belt = rawEntry('Wide Belt');
    const dataset = [unpriced(ring, { state: 'no-listings' }, hoursBefore(NOW, 2))];
    const rows = rowsFor([belt, ring, bows], dataset, [recipeless([{ entry: bows, trust: NEVER }])]);
    expect(rows.map((row) => [row.label, row.numeral, row.ev.kind])).toEqual([
      ['Bows', undefined, 'missing'],
      ['Coral Ring', undefined, 'missing'],
      ['Wide Belt', undefined, 'missing'],
    ]);
    const keys = rows.map((row) => row.key);
    expect(keys).toEqual(keys.toSorted(compareCanonicalKeys));
  });
});
