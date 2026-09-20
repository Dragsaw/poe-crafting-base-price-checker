import { describe, expect, it } from 'vitest';

import { CurrencyRateSchema } from './currency-rate';
import { without } from './test-support';

const exalted = {
  currencyId: 'exalted',
  rate: 0.0042,
  source: 'in-game exchange, by hand',
  league: 'Forbidden Rites',
  asOf: '2026-09-19T08:00:00Z',
};

describe('CurrencyRateSchema', () => {
  it('parses a hand-maintained rate carrying its own league and asOf', () => {
    expect(CurrencyRateSchema.parse(exalted)).toEqual(exalted);
  });

  it("states the orientation in the schema description: divine per one unit", () => {
    const described = CurrencyRateSchema.description ?? '';
    expect(described).toContain('divine per one unit');
    expect(CurrencyRateSchema.shape.rate.description ?? '').toContain('Divine per ONE unit');
  });

  it('requires the league and the asOf, because sync copies both through rather than stamping them', () => {
    expect(CurrencyRateSchema.safeParse(without(exalted, 'league')).success).toBe(false);
    expect(CurrencyRateSchema.safeParse(without(exalted, 'asOf')).success).toBe(false);
  });

  it("carries divine's own rate of exactly 1 like any other", () => {
    expect(
      CurrencyRateSchema.parse({ ...exalted, currencyId: 'divine', rate: 1, source: 'written' })
        .rate,
    ).toBe(1);
  });

  it('refuses an offset timestamp and an unknown field', () => {
    expect(CurrencyRateSchema.safeParse({ ...exalted, asOf: '2026-09-19T08:00:00+02:00' }).success).toBe(
      false,
    );
    expect(CurrencyRateSchema.safeParse({ ...exalted, observedBy: 'sync' }).success).toBe(false);
  });
});
