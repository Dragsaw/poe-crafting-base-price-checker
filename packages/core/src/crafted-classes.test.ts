import type { TrackedEntry } from '@poe/contracts';
import { describe, expect, it } from 'vitest';

import { classKeyOf, craftedClassesOf } from './crafted-classes.ts';

const crafted = (className: string, status: 'tracked' | 'pruned', itemLevelMin: number): TrackedEntry =>
  ({
    kind: 'crafted',
    categoryId: 'c.' + className,
    className,
    itemLevelMin,
    status,
    modifiers: [],
  }) as unknown as TrackedEntry;

describe('craftedClassesOf', () => {
  it('groups non-pruned crafted entries by class, drops pruned and raw, keeps insertion order', () => {
    const a1 = crafted('Amulets', 'tracked', 1);
    const bows = crafted('Bows', 'tracked', 1);
    const a2 = crafted('Amulets', 'tracked', 2);
    const pruned = crafted('Rings', 'pruned', 1);
    const raw = { kind: 'raw', baseTypeId: 'x', itemLevelMin: 1, status: 'tracked' } as unknown as TrackedEntry;

    const groups = craftedClassesOf([a1, raw, bows, pruned, a2]);

    expect([...groups.keys()]).toEqual([classKeyOf('c.Amulets', 'Amulets'), classKeyOf('c.Bows', 'Bows')]);
    expect(groups.get(classKeyOf('c.Amulets', 'Amulets'))).toEqual([a1, a2]);
  });

  it('is empty for no entries and for pruned-only input', () => {
    expect(craftedClassesOf([]).size).toBe(0);
    expect(craftedClassesOf([crafted('Rings', 'pruned', 1)]).size).toBe(0);
  });

  it('keeps one className under two categoryIds apart', () => {
    const one = { ...crafted('Jewels', 'tracked', 1), categoryId: 'jewel.a' } as unknown as TrackedEntry;
    const two = { ...crafted('Jewels', 'tracked', 1), categoryId: 'jewel.b' } as unknown as TrackedEntry;
    expect(craftedClassesOf([one, two]).size).toBe(2);
  });
});
