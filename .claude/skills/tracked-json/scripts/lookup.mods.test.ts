import { describe, expect, it } from 'vitest';

import { LookupError, lookupMods, lookupTiers } from './lookup';
import { A, B, EVASION, JSON_NULL, LIFE, MELEE, nullLineWeights, SPELL, SPIRIT, WEIGHTS } from './lookup.test-support';

describe('lookupMods', () => {
  it('prints one row per modGroup, a hybrid with all its statIds, verbatim', () => {
    const found = lookupMods(WEIGHTS, { className: 'Body_Armours_dex', category: 'armour.chest', slot: 'prefix' });

    expect(found).toEqual({
      categoryId: 'armour.chest',
      className: 'Body_Armours_dex',
      mods: [
        {
          slot: 'prefix',
          modGroup: 'BaseLocalDefencesAndLife',
          text: 'BaseLocalDefencesAndLife',
          statIds: [EVASION, LIFE].toSorted((a, b) => Number(a > b) - Number(a < b)),
          trackable: true,
          untrackable: [],
          tierCount: 2,
          itemLevelMin: { min: 16, max: 33 },
          tierLabels: ['T2', 'T1'],
        },
        {
          slot: 'prefix',
          modGroup: 'IncreasedLife',
          text: 'IncreasedLife',
          statIds: [LIFE],
          trackable: true,
          untrackable: [],
          tierCount: 1,
          itemLevelMin: { min: 1, max: 1 },
          tierLabels: ['T1'],
        },
      ],
    });
  });

  it('prints both slots without a slot, and drops a null line from the line set', () => {
    const found = lookupMods(WEIGHTS, { className: 'Body_Armours_dex', category: 'armour.chest' });

    expect(found.mods.map((row) => [row.slot, row.modGroup])).toEqual([
      ['prefix', 'BaseLocalDefencesAndLife'],
      ['prefix', 'IncreasedLife'],
      ['suffix', 'Thorns'],
    ]);
    // A weight-500 tier with a lone null line in a complete pool is trackable; no line to write.
    expect(found.mods[2]).toMatchObject({ statIds: [], trackable: true, untrackable: [] });
  });

  it('prints one row per mod family when a modGroup holds several', () => {
    const found = lookupMods(WEIGHTS, { className: 'Amulets', slot: 'suffix' });

    expect(
      found.mods
        .filter((row) => row.modGroup === 'GemLevel')
        .map((row) => [row.text, row.statIds, row.tierLabels]),
    ).toEqual([
      ['GemLevel', [MELEE], ['T1']],
      ['GemLevel', [SPELL], ['T2', 'T1']],
    ]);
  });

  it('refuses an unknown class', () => {
    expect(() => lookupMods(WEIGHTS, { className: 'Nope' })).toThrow('unknown class Nope');
    expect(() => lookupMods(WEIGHTS, { className: 'Amulets', category: 'armour.chest' })).toThrow(
      'unknown class Amulets in category armour.chest',
    );
  });

  it('refuses a class in several categories without a category', () => {
    expect(() => lookupMods(WEIGHTS, { className: 'Body_Armours_dex' })).toThrow(
      'appears in categories armour.chest, armour.shield; pass --category',
    );
  });
});

describe('the null-line rule in lookupMods and lookupTiers', () => {
  const rings = { className: 'Rings', slot: 'prefix' } as const;

  it('offers a hybrid as one row with its sorted line set, and an internal line is not a second family', () => {
    const row = lookupMods(nullLineWeights('complete'), rings).mods.find((module_) => module_.modGroup === 'Hybrid');

    expect(row).toMatchObject({ statIds: [A, B], trackable: true, untrackable: [], tierCount: 2, tierLabels: ['T2', 'T1'] });
  });

  it('reports a not-in-game tier with no line set, untrackable, and its reason', () => {
    const row = lookupMods(nullLineWeights('complete'), rings).mods.find((module_) => module_.modGroup === 'Dead');

    expect(row).toMatchObject({
      statIds: [],
      trackable: false,
      untrackable: [{ tierLabel: 'T1', itemLevelMin: 1, reason: 'not-in-game' }],
    });
  });

  it('makes a {A, null} tier untrackable only in a partial pool, naming the reason', () => {
    const complete = lookupMods(nullLineWeights('complete'), rings).mods.find((module_) => module_.modGroup === 'Mixed');
    const partial = lookupMods(nullLineWeights('partial'), rings).mods.find((module_) => module_.modGroup === 'Mixed');

    expect(complete).toMatchObject({ statIds: [A], trackable: true, untrackable: [], tierCount: 2 });
    // One family, one untrackable tier: the family is not trackable, and only that tier is listed.
    expect(partial).toMatchObject({
      statIds: [A],
      trackable: false,
      tierCount: 2,
      untrackable: [{ tierLabel: 'T1', itemLevelMin: 20, reason: 'partial-pool-null-line' }],
    });
    expect(partial?.untrackable).toHaveLength(1);
  });

  it('adds lineSet and untrackable to a tiers row beside the verbatim lines', () => {
    const complete = lookupTiers(nullLineWeights('complete'), A, { className: 'Rings' }).tiers;
    const partial = lookupTiers(nullLineWeights('partial'), A, { className: 'Rings' }).tiers;

    const t1 = complete.find((row) => row.modGroup === 'Hybrid' && row.tierLabel === 'T1');
    expect(t1?.lines).toEqual([
      { statId: B, ranges: [[5, 6]] },
      { statId: A, ranges: [[3, 4]] },
      { statId: JSON_NULL, ranges: [] },
    ]);
    expect(t1).toMatchObject({ lineSet: [A, B], untrackable: JSON_NULL });
    expect(partial.find((row) => row.modGroup === 'Mixed' && row.tierLabel === 'T1')).toMatchObject({
      lineSet: [A],
      untrackable: 'partial-pool-null-line',
    });
    expect(partial.find((row) => row.modGroup === 'Mixed' && row.tierLabel === 'T2')?.untrackable).toBeNull();
  });
});

describe('lookupTiers', () => {
  it('lists, per slot, the tiers carrying the statId in itemLevelMin order, ranges verbatim', () => {
    const found = lookupTiers(WEIGHTS, SPIRIT, { className: 'Amulets' });

    expect(found.categoryId).toBe('accessory.amulet');
    expect(found.tiers.map((row) => [row.slot, row.tierLabel, row.itemLevelMin])).toEqual([
      ['prefix', 'T3', 16],
      ['prefix', 'T2', 25],
      ['prefix', 'T1', 54],
      ['suffix', 'T1', 40],
    ]);
    expect(found.tiers[0]).toEqual({
      slot: 'prefix',
      tierLabel: 'T3',
      itemLevelMin: 16,
      weight: 500,
      weightSource: 'published',
      modGroup: 'BaseSpirit',
      lines: [{ statId: SPIRIT, ranges: [[30, 33]] }],
      lineSet: [SPIRIT],
      untrackable: JSON_NULL,
    });
  });

  it('prints every line of a hybrid tier that carries the statId', () => {
    const found = lookupTiers(WEIGHTS, EVASION, { className: 'Body_Armours_dex', category: 'armour.chest' });

    expect(found.tiers.map((row) => row.lines)).toEqual([
      [
        { statId: EVASION, ranges: [[14, 20]] },
        { statId: LIFE, ranges: [[11, 19]] },
      ],
      [
        { statId: EVASION, ranges: [[21, 26]] },
        { statId: LIFE, ranges: [[20, 23]] },
      ],
    ]);
  });

  it('refuses an unknown class, and a class in several categories without a category', () => {
    expect(() => lookupTiers(WEIGHTS, SPIRIT, { className: 'Nope' })).toThrow(LookupError);
    expect(() => lookupTiers(WEIGHTS, SPIRIT, { className: 'Body_Armours_dex' })).toThrow('pass --category');
  });
});
