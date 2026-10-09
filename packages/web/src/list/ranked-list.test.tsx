import { act } from 'react';
import { afterEach, describe, expect, it } from 'vitest';

import { cellIn as cell, mountList, NOW, rgb, rowsIn, unmount } from '../test-support/dom';
import { cssNumber } from '../test-support/css-number';
import { hoursBefore, many, priced, rawEntry } from '../test-support/list-fixtures';
import { colors, glyphs, rankedRowColumns, layout } from '../theme/tokens';
import { COLUMN_LABELS } from './ColumnHeader';
import { rawNote } from './format';
import { HAIR_SPACE } from './TrustMark';

afterEach(unmount);

describe('the column header', () => {
  it('prints the six final labels in six fixed flex cells', () => {
    const view = mountList([], []);
    const cells = [...view.querySelectorAll<HTMLElement>('[data-column-header] [data-header-cell]')];
    expect(cells.map((c) => c.textContent)).toEqual([
      '',
      'Item Class / Base Type',
      'EV (Divine)',
      'Provenance',
      'Age',
      'Chase Combinations, by contribution to EV',
    ]);
    expect(Object.values(COLUMN_LABELS)).not.toContain('Weight');
    expect(cells.map((c) => c.style.width)).toEqual(rankedRowColumns.map((c) => `${String(c.width)}px`));
    for (const c of cells) {
      expect(c.style.display).toBe('');
      expect(c.style.textOverflow).toBe('');
    }
  });
});

describe('a ranked row', () => {
  // Matrix: priced raw, fresh.
  it('prints numeral, ▪, an italic name, 0.50, empty Provenance and Age, and the raw note', () => {
    const belt = rawEntry('Wide Belt', 82);
    const [row] = rowsIn(mountList([belt], [priced(belt, 0.5, hoursBefore(NOW, 3))]));
    expect(cell(row, 'rank').textContent).toBe('1');
    const glyph = row?.querySelectorAll('[data-unit-glyph]');
    expect(glyph).toHaveLength(1);
    expect(glyph?.[0]?.textContent).toBe(glyphs.unitRaw);
    const name = row?.querySelector<HTMLElement>('[data-unit-name]');
    expect(name?.textContent).toBe('Wide Belt');
    expect(name?.style.fontStyle).toBe('italic');
    expect(cell(row, 'ev').textContent).toBe('0.50');
    expect(cell(row, 'provenance').childElementCount).toBe(0);
    expect(cell(row, 'age').childElementCount).toBe(0);
    const note = row?.querySelector<HTMLElement>('[data-raw-note]');
    expect(note?.textContent).toBe(rawNote(82));
    expect(note?.style.fontStyle).toBe('italic');
    expect(cell(row, 'chase').style.width).toBe('492px');
    expect(row?.hasAttribute('data-raw')).toBe(true);
    expect(row?.className).toBe('fg-row');
    // The tone is list.css's, so hover can move it.
    expect(row?.style.background).toBe('');
  });

  it('sums its six cells to 1012 at a 28px height', () => {
    const belt = rawEntry('Wide Belt');
    const [row] = rowsIn(mountList([belt], [priced(belt, 0.5, hoursBefore(NOW, 3))]));
    const widths = rankedRowColumns.map((c) => cssNumber(cell(row, c.name).style.width));
    expect(widths.reduce((a, b) => a + b, 0)).toBe(layout.contentWidth);
    expect(row?.style.height).toBe('28px');
    expect(row?.style.width).toBe('1012px');
  });

  // Matrix: tiny figure.
  it('prints a tiny figure as < 0.01', () => {
    const belt = rawEntry('Wide Belt');
    const [row] = rowsIn(mountList([belt], [priced(belt, 0.0031, hoursBefore(NOW, 3))], 0));
    expect(cell(row, 'ev').textContent).toBe('< 0.01');
  });

  // Matrix: stale observation, and exactly 48h.
  it('marks a stale observation with its clock, in trust-broken at 700', () => {
    const a = rawEntry('Gold Amulet');
    const b = rawEntry('Solar Amulet');
    const rows = rowsIn(
      mountList([a, b], [priced(a, 2, hoursBefore(NOW, 5 * 24 + 4)), priced(b, 1, hoursBefore(NOW, 48))]),
    );
    expect(cell(rows[0], 'age').textContent).toBe(`${glyphs.stale}${HAIR_SPACE}priced 5d ago`);
    expect(cell(rows[1], 'age').textContent).toBe(`${glyphs.stale}${HAIR_SPACE}priced 2d ago`);
    const mark = cell(rows[0], 'age').querySelector<HTMLElement>('[data-trust-mark]');
    expect(mark?.dataset['trustMark']).toBe('stale');
    expect(mark?.style.fontWeight).toBe('700');
    expect(mark?.style.background).toBe('');
    expect(mark?.style.border).toBe('');
  });

  it('takes its tier from position only: weight and rank colour', () => {
    const { tracked, dataset } = many(12, NOW);
    const rows = rowsIn(mountList(tracked, dataset));
    expect(rows.map((r) => r.dataset['tier'])).toEqual(['1', '1', '1', '1', '1', '2', '2', '2', '2', '2', '3', '3']);
    expect(cell(rows[0], 'rank').style.fontWeight).toBe('700');
    expect(rows[0]?.querySelector<HTMLElement>('[data-unit-name]')?.style.fontWeight).toBe('700');
    expect(cell(rows[5], 'rank').style.fontWeight).toBe('400');
    expect(rows[5]?.querySelector<HTMLElement>('[data-ev-figure]')?.style.fontWeight).toBe('400');
    expect(rows[0]?.querySelector<HTMLElement>('[data-ev-figure]')?.style.fontWeight).toBe('700');
    expect(cell(rows[0], 'rank').style.color).toBe(rgb(colors.text));
    expect(cell(rows[5], 'rank').style.color).toBe(rgb(colors['text-secondary']));
    expect(cell(rows[10], 'rank').style.color).toBe(rgb(colors['text-tertiary']));
  });

  // Matrix: row click.
  it('toggles openMarker on click without moving a column', () => {
    const { tracked, dataset } = many(5, NOW);
    const view = mountList(tracked, dataset);
    const third = rowsIn(view)[2];
    act(() => {
      third?.click();
    });
    expect(third?.hasAttribute('data-open')).toBe(true);
    expect(third?.style.borderLeft).toContain('3px solid');
    expect(third?.style.marginLeft).toBe('-3px');
    expect(third?.style.width).toBe('1015px');
    expect(third?.style.borderBottom).toContain(rgb(colors['line-strong']));
    expect(rowsIn(view).filter((r) => r.dataset['open'] !== undefined)).toHaveLength(1);
    act(() => {
      third?.click();
    });
    expect(third?.hasAttribute('data-open')).toBe(false);
    expect(third?.style.marginLeft).toBe('');
  });
});
