import { afterEach, describe, expect, it } from 'vitest';

import { cellIn as cell, mountList, NOW, rgb, rowsIn, unmount } from '../../test-support/dom';
import { hoursBefore, priced, rawEntry, unpriced } from '../../test-support/list-fixtures';
import { colors } from '../../theme/tokens';

afterEach(unmount);

describe('the unpriced trail', () => {
  // Matrix: unpriced trail, and unresolvable (trail order, row cells, stale unresolvable).
  it('numbers the priced rows, then trails an open question, no figure yet and not valued, the age cell blank', () => {
    const a = rawEntry('Gold Amulet');
    const b = rawEntry('Solar Amulet');
    const tried = rawEntry('Coral Ring');
    const never = rawEntry('Wide Belt');
    const lost = rawEntry('Lost Ring');
    const gone = rawEntry('Broken Ring');
    const rows = rowsIn(
      mountList(
        [lost, a, b, gone, tried, never],
        [
          priced(a, 1, hoursBefore(NOW, 2)),
          priced(b, 0.8, hoursBefore(NOW, 2)),
          unpriced(tried, { state: 'no-listings' }, hoursBefore(NOW, 9 * 24 + 3)),
          unpriced(lost, { state: 'unresolvable' }, hoursBefore(NOW, 1)),
          unpriced(gone, { state: 'unresolvable' }, hoursBefore(NOW, 3 * 24 + 2)),
        ],
      ),
    );
    expect(rows).toHaveLength(6);
    expect(rows.map((r) => cell(r, 'rank').textContent)).toEqual(['1', '2', '', '', '', '']);
    expect(rows.map((r) => r.querySelector('[data-unit-name]')?.textContent)).toEqual([
      'Gold Amulet',
      'Solar Amulet',
      'Coral Ring',
      'Wide Belt',
      'Broken Ring',
      'Lost Ring',
    ]);
    expect(cell(rows[2], 'ev').textContent).toBe('an open question');
    expect(cell(rows[3], 'ev').textContent).toBe('no figure yet');
    expect(cell(rows[3], 'ev').querySelector<HTMLElement>('[data-money-phrase]')?.style.fontStyle).toBe('italic');
    expect(cell(rows[3], 'ev').querySelector<HTMLElement>('[data-money-phrase]')?.style.color).toBe(rgb(colors.text));
    for (const r of rows.slice(4)) {
      const phrase = cell(r, 'ev').querySelector<HTMLElement>('[data-money-phrase]');
      expect(phrase?.textContent).toBe('not valued');
      expect(phrase?.style.fontStyle).toBe('italic');
      expect(phrase?.style.color).toBe(rgb(colors['trust-broken']));
      expect(cell(r, 'ev').querySelector('[data-ev-figure]')).toBeNull();
    }
    // `web` derives no age mark (AD-10); the verdict is `core`'s (EXPERIENCE.md *Price trust*).
    for (const r of rows) {
      expect(cell(r, 'age').childNodes).toHaveLength(0);
    }
    for (const r of rows.slice(2)) {
      expect(r.dataset['tier']).toBe('3');
      expect(r.dataset['raw']).toBeDefined();
      expect(r.querySelector('[data-raw-note]')).not.toBeNull();
    }
  });

  // Review decision (b): the EV colour follows the phrase shown, so trust-broken goes only to *not valued*.
  it('prints an honest-empty unresolvable row as no figure yet in text, not trust-broken', () => {
    const lost = rawEntry('Lost Ring');
    const tried = rawEntry('Coral Ring');
    const rows = rowsIn(
      mountList(
        [lost, tried],
        [
          unpriced(tried, { state: 'no-listings' }, hoursBefore(NOW, 1)),
          unpriced(lost, { state: 'unresolvable' }, hoursBefore(NOW, 1)),
        ],
      ),
    );
    expect(rows).toHaveLength(2);
    for (const r of rows) {
      const phrase = cell(r, 'ev').querySelector<HTMLElement>('[data-money-phrase]');
      expect(phrase?.textContent).toBe('no figure yet');
      expect(phrase?.style.color).toBe(rgb(colors.text));
    }
  });

  it('never prints 0, a blank or an em dash in an EV cell', () => {
    const tried = rawEntry('Coral Ring');
    const never = rawEntry('Wide Belt');
    const rows = rowsIn(mountList([tried, never], [unpriced(tried, { state: 'no-listings' })]));
    for (const r of rows) {
      const text = cell(r, 'ev').textContent;
      expect(text).not.toMatch(/^(0|0\.00|—|)$/);
    }
  });
});
