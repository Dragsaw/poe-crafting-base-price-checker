import { describe, expect, it } from 'vitest';

import { ProvenanceSchema, RankedRowSchema } from './ranked-row';
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
  summands: [{ entryKey: '["crafted","weapon.bow","Bows",82,null,null]', probability: 0.1, priceDivine: 3, contribution: 0.3 }],
  provenance: 'measured',
  asOf: '2026-09-26T00:00:00Z',
};

describe('RankedRowSchema, the crafted arm', () => {
  it('parses a costed pair, and a pair with no summand ranked at minus its cost', () => {
    expect(RankedRowSchema.parse(craftedRow)).toEqual(craftedRow);
    const empty = { ...craftedRow, grossPayout: 0, ev: -0.05, summands: [] };
    expect(RankedRowSchema.parse(empty)).toEqual(empty);
  });

  it('parses an uncostable pair, whose ev is null, and names the currency', () => {
    const uncostable = { ...craftedRow, craftCost: { kind: 'uncostable', currencyId: 'perfect-orb-of-augmentation' }, ev: null };
    expect(RankedRowSchema.parse(uncostable)).toEqual(uncostable);
  });

  it('refuses a null ev on a costed pair and a figure on an uncostable one', () => {
    expect(RankedRowSchema.safeParse({ ...craftedRow, ev: null }).success).toBe(false);
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
