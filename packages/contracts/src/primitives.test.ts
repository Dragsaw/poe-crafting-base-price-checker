import { describe, expect, it } from 'vitest';

import {
  DivineAmountSchema,
  IsoTimestampSchema,
  ItemLevelSchema,
  LeagueIdSchema,
} from './primitives';

describe('IsoTimestampSchema', () => {
  it('accepts an ISO-8601 UTC instant', () => {
    expect(IsoTimestampSchema.safeParse('2026-09-20T12:00:00Z').success).toBe(true);
    expect(IsoTimestampSchema.safeParse('2026-09-20T12:00:00.123Z').success).toBe(true);
  });

  it('refuses an offset form and a bare date', () => {
    expect(IsoTimestampSchema.safeParse('2026-09-20T12:00:00+02:00').success).toBe(false);
    expect(IsoTimestampSchema.safeParse('2026-09-20').success).toBe(false);
  });
});

describe('LeagueIdSchema', () => {
  it('carries a live league id verbatim, spaces and all', () => {
    expect(LeagueIdSchema.parse('Forbidden Rites')).toBe('Forbidden Rites');
  });

  it('refuses an empty id', () => {
    expect(LeagueIdSchema.safeParse('').success).toBe(false);
  });
});

describe('DivineAmountSchema', () => {
  it('is a number, so a 4dp value survives unchanged', () => {
    expect(DivineAmountSchema.parse(0.0001)).toBeCloseTo(0.0001, 10);
    expect(DivineAmountSchema.safeParse('1').success).toBe(false);
  });

  it('refuses zero and a negative amount, which nothing downstream could detect', () => {
    expect(DivineAmountSchema.safeParse(0).success).toBe(false);
    expect(DivineAmountSchema.safeParse(-0.0042).success).toBe(false);
  });
});

describe('ItemLevelSchema', () => {
  it('is an integer floor', () => {
    expect(ItemLevelSchema.parse(82)).toBe(82);
    expect(ItemLevelSchema.safeParse(79.5).success).toBe(false);
    expect(ItemLevelSchema.safeParse(0).success).toBe(false);
  });
});
