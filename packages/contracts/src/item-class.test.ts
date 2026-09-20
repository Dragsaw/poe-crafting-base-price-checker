import { describe, expect, it } from 'vitest';

import { CategoryIdSchema, ClassNameSchema, ItemClassSchema } from './item-class';

describe('ItemClassSchema', () => {
  it('is the pair, never className alone', () => {
    expect(
      ItemClassSchema.parse({ categoryId: 'armour.chest', className: 'Body_Armours_dex_int' }),
    ).toEqual({ categoryId: 'armour.chest', className: 'Body_Armours_dex_int' });

    expect(ItemClassSchema.safeParse({ className: 'Body_Armours_dex_int' }).success).toBe(false);
    expect(ItemClassSchema.safeParse({ categoryId: 'armour.chest' }).success).toBe(false);
  });

  it('carries each rung verbatim and refuses an empty one', () => {
    expect(CategoryIdSchema.parse('weapon.bow')).toBe('weapon.bow');
    expect(ClassNameSchema.parse('Time-Lost_Diamond')).toBe('Time-Lost_Diamond');
    expect(CategoryIdSchema.safeParse('').success).toBe(false);
    expect(ClassNameSchema.safeParse('').success).toBe(false);
  });
});
