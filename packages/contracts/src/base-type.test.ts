import { describe, expect, it } from 'vitest';

import { BaseTypeIdSchema, BaseTypeSchema } from './base-type';

describe('BaseTypeSchema', () => {
  it("keys on the trade API's own `type` string, verbatim", () => {
    expect(BaseTypeIdSchema.parse('Time-Lost Diamond')).toBe('Time-Lost Diamond');
    expect(BaseTypeSchema.parse({ baseTypeId: 'Advanced Dualstring Bow' })).toEqual({
      baseTypeId: 'Advanced Dualstring Bow',
    });
  });

  it('refuses an empty id and any second identity beside it', () => {
    expect(BaseTypeSchema.safeParse({ baseTypeId: '' }).success).toBe(false);
    expect(
      BaseTypeSchema.safeParse({ baseTypeId: 'Sapphire', categoryId: 'jewel' }).success,
    ).toBe(false);
  });
});
