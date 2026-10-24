import { canonicalKey } from '@poe/contracts';
import type { WeightsClassPools } from '@poe/contracts';
import { describe, expect, it } from 'vitest';

import { coRollable } from '../cross-file.ts';
import { damageStat, entryOn, FREEZE, levelStat, tagOf, wandPools } from '../probability/wand-test-support.ts';
import { band, checksOf, entry, failuresOf, line, OTHER, pools, STAT, tier, weightsOf } from './test-support.ts';

const wandsFile = (classPools: WeightsClassPools) => weightsOf({ 'weapon.wand': { Wands: classPools } });
const onWands = { categoryId: 'weapon.wand', className: 'Wands' } as const;

describe('the co-rollable combination check (AD-17)', () => {
  const wands = wandPools();

  it('fails a pair blocked in both draw orders as a validation error, naming both references, the floor and an example', () => {
    const tracked = entry({ prefix: band(10, 20, damageStat('cold')), suffix: band(1, 2, levelStat('fire')) }, onWands);
    const failures = failuresOf([tracked], wandsFile(wands));
    expect(failures.map((failure) => [failure.check, failure.entryKey])).toEqual([['co-rollable-combination', canonicalKey(tracked)]]);
    const detail = failures[0]?.detail ?? '';
    const cold = entryOn(wands, damageStat('cold'));
    const fire = entryOn(wands, levelStat('fire'));
    expect(detail).toContain(`prefix ${damageStat('cold')} band [10, 20] and suffix ${levelStat('fire')} band [1, 2] at floor 82`);
    expect(detail).toContain(`${cold.sourceModifierId} and ${fire.sourceModifierId}`);
    expect(detail).toContain(`prefix first, ${fire.sourceModifierId} blockedByTags meets ${cold.sourceModifierId} addsTags on ${tagOf('fire')}`);
    expect(detail).toContain(`suffix first, ${cold.sourceModifierId} blockedByTags meets ${fire.sourceModifierId} addsTags on ${tagOf('cold')}`);
  });

  it('passes a pair the game can roll', () => {
    const tracked = entry({ prefix: band(10, 20, damageStat('cold')), suffix: band(10, 20, FREEZE) }, onWands);
    expect(failuresOf([tracked], wandsFile(wands))).toEqual([]);
  });

  it('passes when only one draw order is open', () => {
    const prefix = tier([line(STAT, [10, 12])], { addsTags: [tagOf('cold')] });
    const suffix = tier([line(OTHER, [1, 2])], { blockedByTags: [tagOf('cold')] });
    const tracked = entry({ prefix: band(10, 12), suffix: band(1, 2, OTHER) }, onWands);
    expect(failuresOf([tracked], wandsFile(pools([prefix], [suffix])))).toEqual([]);
  });

  it('names a shared modGroup as the reason', () => {
    const prefix = tier([line(STAT, [10, 12])], { modGroup: 'shared' });
    const suffix = tier([line(OTHER, [1, 2])], { modGroup: 'shared' });
    const detail = coRollable({ prefix: band(10, 12), suffix: band(1, 2, OTHER) }, { prefix: [prefix], suffix: [suffix] }, 82);
    expect(detail).toContain('prefix first, shared modGroup shared; suffix first, shared modGroup shared');
  });

  it('leaves an empty containment set to that check', () => {
    const tracked = entry({ prefix: band(30, 40, damageStat('cold')), suffix: band(1, 2, levelStat('fire')) }, onWands);
    expect(checksOf([tracked], wandsFile(wands)).map(([check]) => check)).toEqual(['empty-containment-set']);
  });

  it('reads the containment sets under the item-level scope, so a recipe floor can still leave P = 0', () => {
    const prefix = tier([line(STAT, [10, 12])], { itemLevelMin: 75, addsTags: [tagOf('cold')], blockedByTags: [tagOf('fire')] });
    const low = tier([line(OTHER, [1, 2])], { itemLevelMin: 1, modGroup: 's' });
    const high = tier([line(OTHER, [1, 2])], { itemLevelMin: 75, modGroup: 's', addsTags: [tagOf('fire')], blockedByTags: [tagOf('cold')] });
    const tracked = entry({ prefix: band(10, 12), suffix: band(1, 2, OTHER) }, onWands);
    expect(failuresOf([tracked], wandsFile(pools([prefix], [low, high])))).toEqual([]);
    expect(checksOf([tracked], wandsFile(pools([prefix], [high]))).map(([check]) => check)).toEqual(['co-rollable-combination']);
  });
});
