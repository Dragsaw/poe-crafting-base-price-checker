import { describe, expect, it } from 'vitest';

import { DAY_MS, HOUR_MS, MINUTE_MS } from './clock.ts';

describe('the clock units', () => {
  it('holds a minute, an hour and a day in milliseconds', () => {
    expect(MINUTE_MS).toBe(60_000);
    expect(HOUR_MS).toBe(3_600_000);
    expect(DAY_MS).toBe(86_400_000);
  });
});
