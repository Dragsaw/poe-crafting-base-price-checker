import type { ModifierWeight, WeightsClassPools } from '@poe/contracts';

import { line, pools, tier } from './test-support.ts';

// The Wands blocking families of the research doc (technical-poe2-no-tag-mod-blocking, *Which
// mods add and which mods are blocked*); weights are illustrative, the tags are the game's.

const ELEMENTS = ['chaos', 'cold', 'fire', 'lightning', 'physical'] as const;
const AILMENT_TAG_ELEMENTS = ['chaos', 'cold', 'fire', 'lightning'] as const;
type Element = (typeof ELEMENTS)[number];

export const tagOf = (element: Element): string => `no_${element}_spell_mods`;
const othersOf = (own: Element, from: readonly Element[]): string[] =>
  from.filter((element) => element !== own).map((element) => tagOf(element));

export const damageStat = (element: Element): string => `explicit.stat_${element}_damage`;
export const levelStat = (element: Element): string => `explicit.stat_${element}_spell_level`;
export const FLAMMABILITY = 'explicit.stat_flammability';
export const FREEZE = 'explicit.stat_freeze_buildup';
export const SHOCK = 'explicit.stat_shock_chance';
export const ALL_SPELL_LEVEL = 'explicit.stat_all_spell_level';
export const MANA = 'explicit.stat_mana';

export const PREFIX_WEIGHT = { damage: 1000, mana: 2000 } as const;
export const SUFFIX_WEIGHT = { level: 2600, ailment: 4000, allSpell: 3000 } as const;

function ailment(statId: string, element: Element, family: string): ModifierWeight {
  return tier([line(statId, [10, 20])], SUFFIX_WEIGHT.ailment, {
    modGroup: family,
    addsTags: othersOf(element, AILMENT_TAG_ELEMENTS),
    blockedByTags: [tagOf(element)],
  });
}

/** One tier per family; every line rolls `[10, 20]` or `[1, 2]`. */
export function wandPools(): WeightsClassPools {
  const prefix = [
    ...ELEMENTS.map((element) =>
      tier([line(damageStat(element), [10, 20])], PREFIX_WEIGHT.damage, {
        modGroup: 'WeaponDamageTypePrefix',
        addsTags: othersOf(element, ELEMENTS),
        blockedByTags: [tagOf(element)],
      }),
    ),
    tier([line(MANA, [10, 20])], PREFIX_WEIGHT.mana, { modGroup: 'IncreasedMana' }),
  ];
  const suffix = [
    ...ELEMENTS.map((element) =>
      tier([line(levelStat(element), [1, 2])], SUFFIX_WEIGHT.level, {
        modGroup: 'IncreaseSocketedGemLevel',
        addsTags: othersOf(element, ELEMENTS),
        blockedByTags: [tagOf(element)],
      }),
    ),
    ailment(FLAMMABILITY, 'fire', 'IgniteChanceIncrease'),
    ailment(FREEZE, 'cold', 'FreezeDamageIncrease'),
    ailment(SHOCK, 'lightning', 'ShockChanceIncrease'),
    tier([line(ALL_SPELL_LEVEL, [1, 2])], SUFFIX_WEIGHT.allSpell, { modGroup: 'AllSpellSkillLevel' }),
  ];
  return pools(prefix, suffix);
}

/** The one entry of `pools` on `statId`. */
export function entryOn(classPools: WeightsClassPools, statId: string): ModifierWeight {
  const found = [...classPools.prefix.entries, ...classPools.suffix.entries].find((entry) =>
    entry.lines.some((candidate) => candidate.statId === statId),
  );
  if (found === undefined) {
    throw new Error(`no entry on ${statId}`);
  }
  return found;
}

const strip = (entries: readonly ModifierWeight[]): ModifierWeight[] =>
  entries.map((entry) => ({ ...entry, addsTags: [], blockedByTags: [] }));

/** The same pools with every tag array emptied: the `6.1.0` semantics. */
export function untagged(classPools: WeightsClassPools): WeightsClassPools {
  return pools(strip(classPools.prefix.entries), strip(classPools.suffix.entries));
}
