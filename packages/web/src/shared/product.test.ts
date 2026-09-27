import { describe, expect, it } from 'vitest';

import { DEFAULT_THRESHOLD, TOP_ROWS } from './product';

describe('the product constants', () => {
  it('shows the top 20 and starts at 0.25 Divine', () => {
    expect(TOP_ROWS).toBe(20);
    expect(DEFAULT_THRESHOLD).toBe(0.25);
  });
});
