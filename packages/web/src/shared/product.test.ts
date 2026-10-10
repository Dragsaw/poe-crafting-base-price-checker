import { describe, expect, it } from 'vitest';

import { DEFAULT_THRESHOLD, DENOMINATION, TOP_LINES, TOP_ROWS } from './product';

describe('the product constants', () => {
  it('shows the top 20 and starts at 0.25 Divine', () => {
    expect(TOP_ROWS).toBe(20);
    expect(DEFAULT_THRESHOLD).toBe(0.25);
  });

  it('opens an expansion on its top 8 lines (state 39)', () => {
    expect(TOP_LINES).toBe(8);
  });

  it('prints the PRD’s denomination word, not the catalogue label Divine Orb', () => {
    expect(DENOMINATION).toBe('Divine');
  });
});
