import { describe, expect, it } from 'vitest';

import { NBSP, plural } from './text';

describe('plural', () => {
  it('takes the singular at exactly one and the plural at zero and many', () => {
    expect(plural(1, 'row', 'rows')).toBe('row');
    expect(plural(0, 'row', 'rows')).toBe('rows');
    expect(plural(2, 'row', 'rows')).toBe('rows');
    expect(plural(21, 'entry', 'entries')).toBe('entries');
  });

  it('agrees a verb as well as a noun', () => {
    expect(`1 tracked ${plural(1, 'entry', 'entries')} ${plural(1, 'was', 'were')}`).toBe('1 tracked entry was');
    expect(`3 tracked ${plural(3, 'entry', 'entries')} ${plural(3, 'was', 'were')}`).toBe('3 tracked entries were');
  });

  it('takes the plural for a fraction or a negative count', () => {
    expect(plural(0.5, 'listing', 'listings')).toBe('listings');
    expect(plural(-1, 'listing', 'listings')).toBe('listings');
  });
});

describe('NBSP', () => {
  it('is U+00A0', () => {
    expect(NBSP).toHaveLength(1);
    expect(NBSP.codePointAt(0)).toBe(0xa0);
  });
});
