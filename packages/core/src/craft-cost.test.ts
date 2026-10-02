import type { CurrencyRate } from '@poe/contracts';
import { describe, expect, it } from 'vitest';

import { craftCost } from './craft-cost.ts';

const LEAGUE = 'Forbidden Rites';

function rate(currencyId: string, value: number, league = LEAGUE): CurrencyRate {
  return { currencyId, rate: value, source: 'measured', league, asOf: '2026-09-26T00:00:00Z' };
}

const greater = {
  currencies: [
    { currencyId: 'greater-orb-of-transmutation', quantity: 1 },
    { currencyId: 'greater-orb-of-augmentation', quantity: 2 },
  ],
};

describe('craftCost (AD-20)', () => {
  it('sums quantity × rate over the recipe currencies, in divine', () => {
    const rates = [rate('greater-orb-of-transmutation', 0.01), rate('greater-orb-of-augmentation', 0.02), rate('divine', 1)];
    expect(craftCost(greater, rates, LEAGUE)).toEqual({ ok: true, divine: 0.01 + 2 * 0.02 });
  });

  it('is uncostable, never 0, when a currency has no rate, naming the first missing currency', () => {
    expect(craftCost(greater, [rate('divine', 1)], LEAGUE)).toEqual({
      ok: false,
      reason: { kind: 'uncostable', currencyId: 'greater-orb-of-transmutation' },
    });
    expect(craftCost(greater, [rate('greater-orb-of-transmutation', 0.01)], LEAGUE)).toEqual({
      ok: false,
      reason: { kind: 'uncostable', currencyId: 'greater-orb-of-augmentation' },
    });
  });

  it('is uncostable when the only rate carries another league', () => {
    const rates = [rate('greater-orb-of-transmutation', 0.01), rate('greater-orb-of-augmentation', 0.02, 'Standard')];
    expect(craftCost(greater, rates, LEAGUE)).toEqual({
      ok: false,
      reason: { kind: 'uncostable', currencyId: 'greater-orb-of-augmentation' },
    });
  });

  it('reads the active-league rate when another league also carries one', () => {
    const rates = [
      rate('greater-orb-of-transmutation', 9, 'Standard'),
      rate('greater-orb-of-transmutation', 0.01),
      rate('greater-orb-of-augmentation', 0.02),
    ];
    expect(craftCost(greater, rates, LEAGUE)).toEqual({ ok: true, divine: 0.01 + 2 * 0.02 });
  });

  it('passes the sum on unrounded', () => {
    const rates = [rate('greater-orb-of-transmutation', 0.0001), rate('greater-orb-of-augmentation', 0.0001)];
    expect(craftCost(greater, rates, LEAGUE)).toEqual({ ok: true, divine: 0.0001 + 2 * 0.0001 });
  });
});
