import { describe, expect, it } from 'vitest';

import { fixedCell } from './cell';

describe('fixedCell', () => {
  it('is a fixed flex cell of its width, with its right padding', () => {
    expect(fixedCell({ width: 84, padRight: 12 })).toEqual({
      flex: '0 0 84px',
      width: '84px',
      minWidth: 0,
      boxSizing: 'border-box',
      paddingRight: '12px',
    });
  });

  it('sets no padding for a zero or absent padRight', () => {
    expect(fixedCell({ width: 24, padRight: 0 }).paddingRight).toBeUndefined();
    expect(fixedCell({ width: 24 }).paddingRight).toBeUndefined();
  });
});
