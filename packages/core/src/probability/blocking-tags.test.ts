import type { ModifierWeight } from '@poe/contracts';
import { describe, expect, it } from 'vitest';

import { combinationProbability, isExcludedBy, recipeReach, secondDraw } from '../probability.ts';
import { band, isCloseRelative, line, OTHER, pOf, pools, STAT, tier } from './test-support.ts';
import {
  ALL_SPELL_LEVEL,
  damageStat,
  entryOn,
  FLAMMABILITY,
  FREEZE,
  levelStat,
  MANA,
  PREFIX_WEIGHT,
  SHOCK,
  SUFFIX_WEIGHT,
  tagOf,
  untagged,
  wandPools,
} from './wand-test-support.ts';

const statsOf = (entries: readonly ModifierWeight[]): string[] =>
  entries.flatMap((entry) => entry.lines.map((candidate) => candidate.statId ?? ''));

describe('the second draw on Wands (AD-17, research doc)', () => {
  const wands = wandPools();

  it('omits the other elements’ level suffixes, Flammability and Shock after increased Cold Damage', () => {
    const kept = statsOf(secondDraw(entryOn(wands, damageStat('cold')), wands.suffix.entries));
    expect(kept).toEqual([levelStat('cold'), FREEZE, ALL_SPELL_LEVEL]);
    for (const omitted of [levelStat('fire'), levelStat('lightning'), levelStat('chaos'), levelStat('physical'), FLAMMABILITY, SHOCK]) {
      expect(kept).not.toContain(omitted);
    }
  });

  it('omits the non-fire damage prefixes after +Level of all Fire Spell Skills, the other draw order', () => {
    const kept = statsOf(secondDraw(entryOn(wands, levelStat('fire')), wands.prefix.entries));
    expect(kept).toEqual([damageStat('fire'), MANA]);
  });

  it('excludes by a shared modGroup as well as by tag', () => {
    const cold = entryOn(wands, damageStat('cold'));
    expect(isExcludedBy(entryOn(wands, damageStat('fire')), cold)).toBe(true);
    expect(isExcludedBy(entryOn(wands, MANA), cold)).toBe(false);
  });

  it('computes the two-order sum by hand for increased Cold Damage and Freeze Buildup', () => {
    const prefixTotal = 5 * PREFIX_WEIGHT.damage + PREFIX_WEIGHT.mana;
    const suffixTotal = 5 * SUFFIX_WEIGHT.level + 3 * SUFFIX_WEIGHT.ailment + SUFFIX_WEIGHT.allSpell;
    // Cold first: 4 levels, Flammability and Shock leave the suffix pool.
    const coldFirst = (PREFIX_WEIGHT.damage * SUFFIX_WEIGHT.ailment) / (suffixTotal - 4 * SUFFIX_WEIGHT.level - 2 * SUFFIX_WEIGHT.ailment);
    // Freeze first: the fire, lightning and chaos damage prefixes leave the prefix pool.
    const freezeFirst = (SUFFIX_WEIGHT.ailment * PREFIX_WEIGHT.damage) / (prefixTotal - 3 * PREFIX_WEIGHT.damage);
    const combination = { itemLevelMin: 82, prefix: band(10, 20, damageStat('cold')), suffix: band(10, 20, FREEZE) };
    const p = pOf(combinationProbability(wands, combination, 0));
    expect(isCloseRelative(p, (coldFirst + freezeFirst) / (prefixTotal + suffixTotal))).toBe(true);
    expect(p).not.toBe(pOf(combinationProbability(untagged(wands), combination, 0)));
  });

  it('keys the second-draw sums by every tag of the first affix, not by its modGroup alone', () => {
    const coldTier = tier([line(STAT, [10, 12])], 100, { modGroup: 'A', addsTags: ['no_cold_spell_mods'] });
    const fireTier = tier([line(STAT, [13, 15])], 300, { modGroup: 'A', addsTags: ['no_fire_spell_mods'] });
    const coldBlocked = tier([line(OTHER, [1, 2])], 200, { blockedByTags: ['no_cold_spell_mods'] });
    const fireBlocked = tier([line(OTHER, [3, 4])], 600, { blockedByTags: ['no_fire_spell_mods'] });
    const filler = tier([line('explicit.s', [1, 1])], 400);
    // Prefix first: cold → 100 · 600 / 1000; fire → 300 · 200 / 600. Suffix first: 200 · 400 / 400 + 600 · 400 / 400.
    const p = pOf(
      combinationProbability(
        pools([coldTier, fireTier], [coldBlocked, fireBlocked, filler]),
        { itemLevelMin: 82, prefix: band(10, 15), suffix: band(1, 4, OTHER) },
        0,
      ),
    );
    expect(isCloseRelative(p, (60 + 100 + 200 + 600) / 1600)).toBe(true);
  });
});

describe('a combination blocked in both draw orders', () => {
  const wands = wandPools();
  const blocked = { itemLevelMin: 82, prefix: band(10, 20, damageStat('cold')), suffix: band(1, 2, levelStat('fire')) };

  it('has P = 0, which the reach verdict reads as unreachable on both slots', () => {
    expect(combinationProbability(wands, blocked, 0)).toEqual({ ok: true, p: 0 });
    expect(recipeReach(wands, blocked, 0)).toEqual({ reached: false, slots: ['prefix', 'suffix'] });
  });

  it('is reachable when one order is open: the predicate is not symmetric', () => {
    const prefix = tier([line(STAT, [10, 12])], 100, { addsTags: [tagOf('cold')] });
    const suffix = tier([line(OTHER, [1, 2])], 100, { blockedByTags: [tagOf('cold')] });
    const fillers = [tier([line('explicit.p', [1, 1])], 100), tier([line('explicit.s', [1, 1])], 100)] as const;
    const classPools = pools([prefix, fillers[0]], [suffix, fillers[1]]);
    const combination = { itemLevelMin: 82, prefix: band(10, 12), suffix: band(1, 2, OTHER) };
    // Prefix first is blocked; suffix first: 100 · 100 / 200.
    expect(isCloseRelative(pOf(combinationProbability(classPools, combination, 0)), 50 / 400)).toBe(true);
    expect(recipeReach(classPools, combination, 0)).toEqual({ reached: true });
  });

  it('is unreachable under a recipe whose floor leaves only blocked pairs, and reachable without it', () => {
    const prefix = tier([line(STAT, [10, 12])], 100, { itemLevelMin: 75, addsTags: [tagOf('cold')], blockedByTags: [tagOf('fire')] });
    const low = tier([line(OTHER, [1, 2])], 100, { itemLevelMin: 1, modGroup: 's' });
    const high = tier([line(OTHER, [1, 2])], 100, { itemLevelMin: 75, modGroup: 's', addsTags: [tagOf('fire')], blockedByTags: [tagOf('cold')] });
    const classPools = pools([prefix, tier([line('explicit.p', [1, 1])], 100)], [low, high, tier([line('explicit.s', [1, 1])], 100)]);
    const combination = { itemLevelMin: 82, prefix: band(10, 12), suffix: band(1, 2, OTHER) };
    expect(recipeReach(classPools, combination, 0)).toEqual({ reached: true });
    expect(combinationProbability(classPools, combination, 70)).toEqual({ ok: true, p: 0 });
    expect(recipeReach(classPools, combination, 70)).toEqual({ reached: false, slots: ['prefix', 'suffix'] });
  });
});

/** Foci: the damage prefixes add the tags, but `focus` decides their weight, so nothing is blocked. */
function fociPools() {
  const prefix = (['cold', 'fire', 'lightning'] as const).map((element, index) =>
    tier([line(`explicit.focus_${element}`, [10, 20])], 700 + index * 37, {
      modGroup: 'FocusDamageTypePrefix',
      addsTags: ['no_chaos_spell_mods', 'no_cold_spell_mods', 'no_fire_spell_mods', 'no_lightning_spell_mods', 'no_physical_spell_mods'].filter(
        (tag) => tag !== tagOf(element),
      ),
    }),
  );
  const suffix = [
    tier([line('explicit.focus_es', [5, 9])], 1300, { modGroup: 'EnergyShieldRecharge' }),
    tier([line('explicit.focus_cast', [3, 7])], 911, { modGroup: 'CastSpeed' }),
    tier([line('explicit.focus_cast', [8, 12])], 433, { modGroup: 'CastSpeed', itemLevelMin: 60 }),
  ];
  return pools([...prefix, tier([line('explicit.focus_mana', [1, 3])], 1777)], suffix);
}

/** Jewels: some suffixes add the tags; no jewel mod is blocked by one. */
function jewelPools() {
  const prefix = [tier([line('explicit.jewel_damage', [5, 9])], 613), tier([line('explicit.jewel_life', [2, 4])], 1024)];
  const suffix = [
    tier([line('explicit.jewel_freeze', [10, 20])], 377, { modGroup: 'FreezeDamageIncrease', addsTags: ['no_chaos_spell_mods', 'no_fire_spell_mods', 'no_lightning_spell_mods'] }),
    tier([line('explicit.jewel_shock', [10, 20])], 377, { modGroup: 'ShockChanceIncrease', addsTags: ['no_chaos_spell_mods', 'no_cold_spell_mods', 'no_fire_spell_mods'] }),
    tier([line('explicit.jewel_speed', [1, 3])], 999),
  ];
  return pools(prefix, suffix);
}

describe('classes where no tag crosses the slots (research doc, *Not affected*)', () => {
  it.each([
    ['Focus', fociPools(), band(10, 20, 'explicit.focus_cold'), band(3, 12, 'explicit.focus_cast')],
    ['Focus, another element', fociPools(), band(10, 20, 'explicit.focus_fire'), band(5, 9, 'explicit.focus_es')],
    ['jewel', jewelPools(), band(5, 9, 'explicit.jewel_damage'), band(10, 20, 'explicit.jewel_freeze')],
    ['jewel, untagged suffix', jewelPools(), band(2, 4, 'explicit.jewel_life'), band(1, 3, 'explicit.jewel_speed')],
  ] as const)('gives a %s combination exactly the probability of the same pools without tags', (_label, classPools, prefix, suffix) => {
    for (const modifierLevelMin of [0, 50]) {
      const combination = { itemLevelMin: 82, prefix, suffix };
      const tagged = pOf(combinationProbability(classPools, combination, modifierLevelMin));
      expect(tagged).toBeGreaterThan(0);
      expect(tagged).toBe(pOf(combinationProbability(untagged(classPools), combination, modifierLevelMin)));
    }
  });
});
