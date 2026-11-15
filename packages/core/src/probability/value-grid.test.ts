import { describe, expect, it } from 'vitest';

import { nextOnGrid } from './value-grid.ts';

describe('nextOnGrid (AD-11)', () => {
  it('steps once past a midpoint that is not an exact double (ECH-1)', () => {
    const below = (0.7 + 0.1) / 2;
    const above = (0.1 + 0.2) / 2;
    expect(below).toBeLessThan(0.4);
    expect(above).toBeGreaterThan(0.15);
    expect([nextOnGrid(below, 1, 2), nextOnGrid((0.3 + 0.6) / 2, 1, 2), nextOnGrid(above, 1, 2)]).toEqual([0.45, 0.5, 0.2]);
  });

  it('steps once past an on-grid value, to the literal double', () => {
    expect([nextOnGrid(0.4, 1, 2), nextOnGrid(1.2, 1, 1), nextOnGrid(80, 0, 2), nextOnGrid(-5, 0, 1)]).toEqual([0.45, 1.3, 80.5, -4]);
  });

  it('lands on the next grid value above an off-grid value', () => {
    expect([nextOnGrid(56.5, 0, 1), nextOnGrid(-5.5, 0, 1)]).toEqual([57, -5]);
  });
});
