import { describe, expect, it } from 'vitest';

import { cssNumber } from './css-number';

describe('cssNumber', () => {
  it('reads the leading number and drops the unit', () => {
    expect(cssNumber('448px')).toBe(448);
    expect(cssNumber('11.5px')).toBeCloseTo(11.5, 10);
    expect(cssNumber('8.5%')).toBeCloseTo(8.5, 10);
    expect(cssNumber('-.5em')).toBeCloseTo(-0.5, 10);
    expect(cssNumber('1.85')).toBeCloseTo(1.85, 10);
  });

  it('is NaN when no number leads', () => {
    expect(cssNumber('')).toBeNaN();
    expect(cssNumber('auto')).toBeNaN();
  });
});
