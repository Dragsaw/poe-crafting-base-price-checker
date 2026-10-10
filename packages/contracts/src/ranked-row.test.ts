import { describe, expect, it } from 'vitest';

import { PriceTrustSchema } from './ranked-row/price-trust';
import { ProvenanceSchema, RankedRowSchema } from './ranked-row';
import { JSON_NULL, without } from './test-support';

const CURRENT = { verdict: 'current', reasons: [] };

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
  categoryId: 'accessory.amulet',
  className: 'Amulets',
  itemLevelMin: 82,
  status: 'active',
  ev: 0.1235,
  craftCost: 0,
  observation,
  trust: CURRENT,
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

const SUMMAND = { entryKey: '["crafted","weapon.bow","Bows",82,null,null]', probability: 0.1, priceDivine: 3, contribution: 0.3, trust: CURRENT };
const COMBINATION = { entryKey: '["crafted","weapon.bow","Bows",82,"a",null]', trust: { verdict: 'pending', reasons: [{ kind: 'never-synced' }] } };

const craftedRow = {
  kind: 'crafted',
  classKey: '["crafted","weapon.bow","Bows"]',
  categoryId: 'weapon.bow',
  className: 'Bows',
  itemLevelMin: 82,
  recipeId: 'greater',
  grossPayout: 0.3,
  craftCost: 0.05,
  ev: 0.25,
  summands: [SUMMAND],
  combinations: [COMBINATION],
  provenance: 'measured',
  asOf: '2026-09-26T00:00:00Z',
  trust: CURRENT,
};

describe('RankedRowSchema, the crafted arm', () => {
  it('parses a costed pair, and a pair with no summand ranked at minus its cost', () => {
    expect(RankedRowSchema.parse(craftedRow)).toEqual(craftedRow);
    const empty = { ...craftedRow, grossPayout: 0, ev: -0.05, summands: [] };
    expect(RankedRowSchema.parse(empty)).toEqual(empty);
  });

  it('parses an uncostable pair, whose ev is null, and names the currency', () => {
    const uncostable = { ...craftedRow, craftCost: { kind: 'uncostable', currencyId: 'perfect-orb-of-augmentation' }, ev: JSON_NULL };
    expect(RankedRowSchema.parse(uncostable)).toEqual(uncostable);
  });

  it('refuses a null ev on a costed pair and a figure on an uncostable one', () => {
    expect(RankedRowSchema.safeParse({ ...craftedRow, ev: JSON_NULL }).success).toBe(false);
    const figure = { ...craftedRow, craftCost: { kind: 'uncostable', currencyId: 'exalted' } };
    expect(RankedRowSchema.safeParse(figure).success).toBe(false);
  });

  it('refuses a ranked row labelled absent or with no provenance, and parses one with no asOf', () => {
    expect(RankedRowSchema.safeParse({ ...craftedRow, provenance: 'absent' }).success).toBe(false);
    expect(RankedRowSchema.safeParse(without(craftedRow, 'provenance')).success).toBe(false);
    const prior = { ...without(craftedRow, 'asOf'), provenance: 'uniform-prior' };
    expect(RankedRowSchema.parse(prior)).toEqual(prior);
    expect(ProvenanceSchema.options).toEqual(['absent', 'uniform-prior', 'measured']);
  });

  it('refuses a negative cost, a probability above 1, and a missing recipe id', () => {
    expect(RankedRowSchema.safeParse({ ...craftedRow, craftCost: -1 }).success).toBe(false);
    const summand = { ...craftedRow.summands[0], probability: 1.5 };
    expect(RankedRowSchema.safeParse({ ...craftedRow, summands: [summand] }).success).toBe(false);
    expect(RankedRowSchema.safeParse(without(craftedRow, 'recipeId')).success).toBe(false);
  });
});

describe('RankedRowSchema, the price trust', () => {
  it('requires a trust on a raw row, a crafted row, a summand and a combination', () => {
    expect(RankedRowSchema.safeParse(without(row, 'trust')).success).toBe(false);
    expect(RankedRowSchema.safeParse(without(craftedRow, 'trust')).success).toBe(false);
    expect(RankedRowSchema.safeParse(without(craftedRow, 'combinations')).success).toBe(false);
    expect(RankedRowSchema.safeParse({ ...craftedRow, summands: [without(SUMMAND, 'trust')] }).success).toBe(false);
    expect(RankedRowSchema.safeParse({ ...craftedRow, combinations: [without(COMBINATION, 'trust')] }).success).toBe(false);
  });

  it('parses each reason kind, and refuses a display string or an unknown kind', () => {
    const rough = { verdict: 'rough', reasons: [{ kind: 'old', days: 3 }, { kind: 'thin', listings: 2 }] };
    expect(RankedRowSchema.parse({ ...row, trust: rough })).toEqual({ ...row, trust: rough });
    const share = { verdict: 'rough', reasons: [{ kind: 'unreliable-share', percent: 70 }] };
    expect(RankedRowSchema.parse({ ...craftedRow, trust: share })).toEqual({ ...craftedRow, trust: share });
    const noRecipe = { verdict: 'pending', reasons: [{ kind: 'no-recipe' }] };
    expect(PriceTrustSchema.parse(noRecipe)).toEqual(noRecipe);
    expect(PriceTrustSchema.safeParse({ verdict: 'pending', reasons: [{ kind: 'no-recipe', recipeId: 'x' }] }).success).toBe(false);
    expect(RankedRowSchema.safeParse({ ...row, trust: { verdict: 'rough', reasons: ['priced 3 days ago'] } }).success).toBe(false);
    expect(RankedRowSchema.safeParse({ ...row, trust: { verdict: 'rough', reasons: [{ kind: 'stale' }] } }).success).toBe(false);
    expect(RankedRowSchema.safeParse({ ...row, trust: { verdict: 'rough', reasons: [{ kind: 'old', days: 3, text: 'x' }] } }).success).toBe(false);
  });

  it('refuses a current verdict with a reason and any other verdict without one', () => {
    expect(PriceTrustSchema.safeParse({ verdict: 'current', reasons: [{ kind: 'thin', listings: 1 }] }).success).toBe(false);
    expect(PriceTrustSchema.safeParse({ verdict: 'pending', reasons: [] }).success).toBe(false);
    expect(PriceTrustSchema.parse({ verdict: 'pending', reasons: [{ kind: 'no-listings' }] })).toEqual({
      verdict: 'pending',
      reasons: [{ kind: 'no-listings' }],
    });
    expect(PriceTrustSchema.parse({ verdict: 'pending', reasons: [{ kind: 'no-listings', minutes: 240 }] }).reasons).toEqual([
      { kind: 'no-listings', minutes: 240 },
    ]);
    expect(PriceTrustSchema.safeParse({ verdict: 'pending', reasons: [{ kind: 'no-listings', days: 2 }] }).success).toBe(false);
    expect(PriceTrustSchema.safeParse({ verdict: 'pending', reasons: [{ kind: 'no-listings', minutes: -1 }] }).success).toBe(false);
  });

  it('refuses a fractional day count and a share above 100 percent', () => {
    expect(PriceTrustSchema.safeParse({ verdict: 'rough', reasons: [{ kind: 'old', days: 3.5 }] }).success).toBe(false);
    expect(PriceTrustSchema.safeParse({ verdict: 'rough', reasons: [{ kind: 'unreliable-share', percent: 101 }] }).success).toBe(false);
  });
});
