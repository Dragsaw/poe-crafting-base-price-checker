import { describe, expect, it } from 'vitest';

import { RankedRowSchema } from './ranked-row';
import { without } from './test-support';

const observation = {
  league: 'Forbidden Rites',
  observedAt: '2026-09-20T09:30:00Z',
  priceDivine: 0.1235,
  sampleSize: 10,
  exchangeObservation: {
    currencyId: 'exalted',
    rate: 0.0042,
    source: 'in-game exchange, by hand',
    league: 'Forbidden Rites',
    asOf: '2026-09-19T08:00:00Z',
  },
};

const row = {
  kind: 'raw',
  entryKey: '["raw","Stellar Amulet",82]',
  baseTypeId: 'Stellar Amulet',
  itemLevelMin: 82,
  status: 'active',
  ev: 0.1235,
  craftCost: 0,
  observation,
};

describe('RankedRowSchema', () => {
  it('parses a raw row, with and without lastAttemptedAt', () => {
    expect(RankedRowSchema.parse(row)).toEqual(row);
    const attempted = { ...row, status: 'pinned', lastAttemptedAt: '2026-09-20T09:30:00Z' };
    expect(RankedRowSchema.parse(attempted)).toEqual(attempted);
  });

  it('refuses a non-zero craftCost: a Raw Base has none (FR-3, AD-17)', () => {
    expect(RankedRowSchema.safeParse({ ...row, craftCost: 0.5 }).success).toBe(false);
    expect(RankedRowSchema.safeParse(without(row, 'craftCost')).success).toBe(false);
  });

  it('refuses a pruned status: a pruned entry never becomes a row', () => {
    expect(RankedRowSchema.safeParse({ ...row, status: 'pruned' }).success).toBe(false);
  });

  it('refuses a row with no observation', () => {
    expect(RankedRowSchema.safeParse(without(row, 'observation')).success).toBe(false);
  });

  it('refuses an unknown kind and any display field', () => {
    expect(RankedRowSchema.safeParse({ ...row, kind: 'crafted' }).success).toBe(false);
    expect(RankedRowSchema.safeParse({ ...row, rank: 1 }).success).toBe(false);
  });
});
