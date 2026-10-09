import { afterEach, describe, expect, it } from 'vitest';

import { cellIn as cell, mountList, NOW, rgb, rowsIn, unmount } from '../../test-support/dom';
import { hoursBefore, priced, rawEntry, unpriced } from '../../test-support/list-fixtures';
import { colors, glyphs } from '../../theme/tokens';
import { HAIR_SPACE } from '../TrustMark';

afterEach(unmount);

describe('the unpriced trail', () => {
  // Matrix: unpriced trail, and unresolvable (trail order, row cells, stale unresolvable).
  it('numbers the priced rows, then trails an open question, no figure yet and not valued with their age marks', () => {
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
    expect(cell(rows[2], 'age').textContent).toBe(`${glyphs.stale}${HAIR_SPACE}tried 9d ago`);
    expect(cell(rows[3], 'ev').textContent).toBe('no figure yet');
    expect(cell(rows[3], 'ev').querySelector<HTMLElement>('[data-money-phrase]')?.style.fontStyle).toBe('italic');
    expect(cell(rows[3], 'age').textContent).toBe(`${glyphs.stale}${HAIR_SPACE}never attempted`);
    const never_ = cell(rows[3], 'age').querySelector<HTMLElement>('[data-trust-mark="never"]');
    expect(never_?.lastElementChild instanceof HTMLElement ? never_.lastElementChild.style.fontStyle : '').toBe('italic');
    expect(cell(rows[3], 'ev').querySelector<HTMLElement>('[data-money-phrase]')?.style.color).toBe(rgb(colors.text));
    for (const r of rows.slice(4)) {
      const phrase = cell(r, 'ev').querySelector<HTMLElement>('[data-money-phrase]');
      expect(phrase?.textContent).toBe('not valued');
      expect(phrase?.style.fontStyle).toBe('italic');
      expect(phrase?.style.color).toBe(rgb(colors['trust-broken']));
      expect(cell(r, 'ev').querySelector('[data-ev-figure]')).toBeNull();
    }
    expect(cell(rows[4], 'age').textContent).toBe(`${glyphs.stale}${HAIR_SPACE}tried 3d ago`);
    expect(cell(rows[5], 'age').childNodes).toHaveLength(0);
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

  // Matrix: mismatched observation, old attempt / recent attempt; priced in the active league.
  it('reads a league-mismatched row by its attempted clock, never as priced', () => {
    const active = rawEntry('Gold Amulet');
    const oldTry = rawEntry('Coral Ring');
    const recentTry = rawEntry('Wide Belt');
    const rows = rowsIn(
      mountList(
        [active, oldTry, recentTry],
        [
          { ...priced(active, 1, hoursBefore(NOW, 72)), lastAttemptedAt: hoursBefore(NOW, 1) },
          priced(oldTry, 0.9, hoursBefore(NOW, 96), { league: 'Standard' }),
          { ...priced(recentTry, 0.8, hoursBefore(NOW, 30 * 24), { league: 'Standard' }), lastAttemptedAt: hoursBefore(NOW, 2) },
        ],
      ),
    );
    expect(rows).toHaveLength(3);
    const byName = (name: string): HTMLElement | undefined =>
      rows.find((r) => r.querySelector('[data-unit-name]')?.textContent === name);
    expect(cell(byName('Gold Amulet'), 'age').textContent).toBe(`${glyphs.stale}${HAIR_SPACE}priced 3d ago`);
    expect(cell(byName('Coral Ring'), 'age').textContent).toBe(`${glyphs.stale}${HAIR_SPACE}tried 4d ago`);
    expect(cell(byName('Wide Belt'), 'age').textContent).toBe('');
    for (const name of ['Coral Ring', 'Wide Belt']) {
      expect(cell(byName(name), 'age').textContent).not.toContain('priced');
    }
  });
});
