import type { TrackedEntry } from '@poe/contracts';
import { describe, expect, it } from 'vitest';

import { ABSENT, NO_RECIPE, PARTIAL, permute, ranked, raw, WEIGHTS, weightsWith, priced, published } from './test-support.ts';

function craftedOf(
  categoryId: string,
  className: string,
  status: TrackedEntry['status'] = 'active',
  itemLevelMin = 54,
): TrackedEntry {
  const base = {
    kind: 'crafted' as const,
    categoryId,
    className,
    itemLevelMin,
    prefix: { kind: 'valueless' as const, statId: 'explicit.stat_1' },
    suffix: { kind: 'valueless' as const, statId: 'explicit.stat_2' },
  };
  return status === 'pruned' ? { ...base, status, prunedReason: 'no market' } : { ...base, status };
}

describe('rank: the Unrankable Item Classes (AD-24, FR-4)', () => {
  it('names every crafted class, reason verbatim, when no weights envelope is loaded', () => {
    const result = ranked({
      tracked: [craftedOf('weapon.bow', 'Bows'), craftedOf('accessory.amulet', 'Amulets'), raw('A')],
      weights: undefined,
    });
    expect(result.unrankable).toEqual([
      { categoryId: 'accessory.amulet', className: 'Amulets', reason: ABSENT },
      { categoryId: 'weapon.bow', className: 'Bows', reason: ABSENT },
    ]);
  });

  it('names a class absent from the file, and never falls back to a sibling className', () => {
    const result = ranked({
      tracked: [craftedOf('jewel', 'Sapphire'), craftedOf('weapon.crossbow', 'Crossbows')],
      weights: weightsWith(['jewel', 'Emerald'], ['weapon.bow', 'Crossbows']),
    });
    expect(result.unrankable).toEqual([
      { categoryId: 'weapon.crossbow', className: 'Crossbows', reason: ABSENT },
      { categoryId: 'jewel', className: 'Sapphire', reason: ABSENT },
    ]);
  });

  it('never resolves a pair through the object prototype', () => {
    const result = ranked({ tracked: [craftedOf('toString', 'constructor')], weights: WEIGHTS });
    expect(result.unrankable).toEqual([{ categoryId: 'toString', className: 'constructor', reason: ABSENT }]);
  });

  it.each([
    ['the prefix', 'partial', 'complete'],
    ['the suffix', 'complete', 'partial'],
    ['both slots', 'partial', 'partial'],
  ] as const)('names a class whose %s declares partial as pool partial, once', (_label, prefix, suffix) => {
    const result = ranked({
      tracked: [craftedOf('jewel', 'Emerald'), craftedOf('jewel', 'Emerald', 'pinned', 82), craftedOf('weapon.bow', 'Bows')],
      weights: weightsWith(['jewel', 'Emerald', prefix, suffix], ['weapon.bow', 'Bows']),
    });
    expect(result.unrankable).toEqual([
      { categoryId: 'weapon.bow', className: 'Bows', reason: NO_RECIPE },
      { categoryId: 'jewel', className: 'Emerald', reason: PARTIAL },
    ]);
    expect(result.ordering).toEqual([]);
  });

  it('makes no weights claim for a complete class: no ranked row, only the no-recipe reason', () => {
    const result = ranked({ tracked: [craftedOf('weapon.bow', 'Bows')], weights: WEIGHTS });
    expect(result.unrankable).toEqual([{ categoryId: 'weapon.bow', className: 'Bows', reason: NO_RECIPE }]);
    expect(result.ordering).toEqual([]);
    expect(result.belowThreshold).toEqual([]);
  });

  it('holds no weights-file reason, and never the string, while a weights envelope is loaded', () => {
    const result = ranked({ tracked: [craftedOf('weapon.bow', 'Bows')], weights: WEIGHTS });
    expect(result.unrankable.map((item) => item.reason)).toEqual([NO_RECIPE]);
    expect(JSON.stringify(result)).not.toContain(ABSENT);
  });

  it('makes one class of two crafted entries on one (categoryId, className)', () => {
    const result = ranked({
      tracked: [craftedOf('weapon.bow', 'Bows', 'active', 54), craftedOf('weapon.bow', 'Bows', 'pinned', 82)],
      weights: undefined,
    });
    expect(result.unrankable).toEqual([{ categoryId: 'weapon.bow', className: 'Bows', reason: ABSENT }]);
  });

  it('keeps two classes that share a className but not a categoryId, breaking on categoryId', () => {
    const result = ranked({
      tracked: [craftedOf('armour.chest', 'Body Armours'), craftedOf('armour.chest.alt', 'Body Armours')],
      weights: undefined,
    });
    expect(result.unrankable.map((item) => item.categoryId)).toEqual(['armour.chest', 'armour.chest.alt']);
  });

  it('makes no class of one whose entries are all pruned, and keeps one with a live entry', () => {
    const result = ranked({
      tracked: [
        craftedOf('weapon.bow', 'Bows', 'pruned'),
        craftedOf('weapon.staff', 'Staves', 'pruned'),
        craftedOf('weapon.staff', 'Staves', 'active'),
      ],
      weights: undefined,
    });
    expect(result.unrankable.map((item) => item.className)).toEqual(['Staves']);
  });

  it('holds no class for a raw-only Tracked List, and leaves the raw branch unchanged', () => {
    const A = raw('A');
    const input = { tracked: [A], dataset: [published(A, priced(0.5))] };
    const absent = ranked({ ...input, weights: undefined });
    expect(absent.unrankable).toEqual([]);
    expect(absent).toEqual(ranked({ ...input, weights: WEIGHTS }));
  });

  it('sorts by className in UTF-8 code-unit order, not locale order', () => {
    const result = ranked({
      tracked: [craftedOf('c.b', 'bows'), craftedOf('c.a', 'Wands'), craftedOf('c.c', 'Amulets')],
      weights: undefined,
    });
    expect(result.unrankable.map((item) => item.className)).toEqual(['Amulets', 'Wands', 'bows']);
  });

  it('names a class a cross-file failure names as class disagrees with weights file, and no other', () => {
    const result = ranked({
      tracked: [craftedOf('weapon.bow', 'Bows'), craftedOf('accessory.amulet', 'Amulets')],
      weights: WEIGHTS,
      crossFileFailures: [{ categoryId: 'weapon.bow', className: 'Bows' }, { categoryId: 'weapon.bow', className: 'Bows' }],
    });
    expect(result.unrankable).toEqual([
      { categoryId: 'accessory.amulet', className: 'Amulets', reason: NO_RECIPE },
      { categoryId: 'weapon.bow', className: 'Bows', reason: 'class disagrees with weights file' },
    ]);
  });

  it('lets the lookup reasons take precedence over a cross-file failure', () => {
    const result = ranked({
      tracked: [craftedOf('jewel', 'Emerald'), craftedOf('jewel', 'Sapphire')],
      weights: weightsWith(['jewel', 'Emerald', 'partial']),
      crossFileFailures: [
        { categoryId: 'jewel', className: 'Emerald' },
        { categoryId: 'jewel', className: 'Sapphire' },
      ],
    });
    expect(result.unrankable).toEqual([
      { categoryId: 'jewel', className: 'Emerald', reason: PARTIAL },
      { categoryId: 'jewel', className: 'Sapphire', reason: ABSENT },
    ]);
  });

  it('is identical under a shuffled Tracked List', () => {
    const tracked = [
      craftedOf('weapon.bow', 'Bows'),
      craftedOf('weapon.bow', 'Bows', 'active', 82),
      craftedOf('accessory.amulet', 'Amulets'),
      craftedOf('weapon.staff', 'Staves', 'pruned'),
      raw('A'),
    ];
    const expected = ranked({ tracked, weights: undefined });
    for (const seed of [1, 7, 42]) {
      expect(ranked({ tracked: permute(tracked, seed), weights: undefined })).toEqual(expected);
    }
  });
});
