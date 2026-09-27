import type { DatasetEntry, RawTrackedEntry } from '@poe/contracts';
import { act } from 'react';
import { afterEach, describe, expect, it } from 'vitest';

import { cellIn as cell, mount, mountList, NOW, rerenderList, rgb, rowsIn, unmount } from '../test-support/dom';
import { hoursBefore, priced, rawEntry, unpriced } from '../test-support/list-fixtures';
import { colors, glyphs, rankedRowColumns, spacing } from '../theme/tokens';
import { COLUMN_LABELS } from './ColumnHeader';
import { rawNote } from './format';
import { KEY_TITLES, KeyBlock } from './KeyBlock';
import { COLLAPSE_COPY, expandCopy } from './RankedList';
import { HAIR_SPACE } from './TrustMark';
import { UnitGlyph } from './UnitGlyph';

afterEach(unmount);

function many(count: number): { tracked: RawTrackedEntry[]; dataset: DatasetEntry[] } {
  const tracked = Array.from({ length: count }, (_, i) => rawEntry(`Base ${String(i).padStart(2, '0')}`));
  return { tracked, dataset: tracked.map((entry, i) => priced(entry, 40 - i, hoursBefore(NOW, 1))) };
}

describe('the column header', () => {
  it('prints the six final labels in six fixed flex cells', () => {
    const view = mountList([], []);
    const cells = Array.from(view.querySelectorAll<HTMLElement>('[data-column-header] [data-header-cell]'));
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
    const widths = rankedRowColumns.map((c) => parseFloat(cell(row, c.name).style.width));
    expect(widths.reduce((a, b) => a + b, 0)).toBe(spacing.contentWidth);
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
  it('marks a stale observation with its clock, in rust at 700', () => {
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
    const { tracked, dataset } = many(12);
    const rows = rowsIn(mountList(tracked, dataset));
    expect(rows.map((r) => r.dataset['tier'])).toEqual(['1', '1', '1', '1', '1', '2', '2', '2', '2', '2', '3', '3']);
    expect(cell(rows[0], 'rank').style.fontWeight).toBe('700');
    expect(rows[0]?.querySelector<HTMLElement>('[data-unit-name]')?.style.fontWeight).toBe('700');
    expect(cell(rows[5], 'rank').style.fontWeight).toBe('400');
    expect(rows[5]?.querySelector<HTMLElement>('[data-ev-figure]')?.style.fontWeight).toBe('400');
    expect(rows[0]?.querySelector<HTMLElement>('[data-ev-figure]')?.style.fontWeight).toBe('700');
    expect(cell(rows[0], 'rank').style.color).toBe(rgb(colors.sepia));
    expect(cell(rows[5], 'rank').style.color).toBe(rgb(colors['ink-secondary']));
    expect(cell(rows[10], 'rank').style.color).toBe(rgb(colors['ink-tertiary']));
  });

  // Matrix: row click.
  it('toggles openMarker on click without moving a column', () => {
    const { tracked, dataset } = many(5);
    const view = mountList(tracked, dataset);
    const third = rowsIn(view)[2];
    act(() => {
      third?.click();
    });
    expect(third?.hasAttribute('data-open')).toBe(true);
    expect(third?.style.borderLeft).toContain('3px solid');
    expect(third?.style.marginLeft).toBe('-3px');
    expect(third?.style.width).toBe('1015px');
    expect(third?.style.borderBottom).toContain(rgb(colors['rule-strong']));
    expect(rowsIn(view).filter((r) => r.hasAttribute('data-open'))).toHaveLength(1);
    act(() => {
      third?.click();
    });
    expect(third?.hasAttribute('data-open')).toBe(false);
    expect(third?.style.marginLeft).toBe('');
  });
});

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
    expect(cell(rows[3], 'ev').querySelector<HTMLElement>('[data-money-phrase]')?.style.color).toBe(rgb(colors.ink));
    for (const r of rows.slice(4)) {
      const phrase = cell(r, 'ev').querySelector<HTMLElement>('[data-money-phrase]');
      expect(phrase?.textContent).toBe('not valued');
      expect(phrase?.style.fontStyle).toBe('italic');
      expect(phrase?.style.color).toBe(rgb(colors.rust));
      expect(cell(r, 'ev').querySelector('[data-ev-figure]')).toBeNull();
    }
    expect(cell(rows[4], 'age').textContent).toBe(`${glyphs.stale}${HAIR_SPACE}tried 3d ago`);
    expect(cell(rows[5], 'age').childNodes).toHaveLength(0);
    for (const r of rows.slice(2)) {
      expect(r.dataset['tier']).toBe('3');
      expect(r.hasAttribute('data-raw')).toBe(true);
      expect(r.querySelector('[data-raw-note]')).not.toBeNull();
    }
  });

  // Review decision (b): the EV colour follows the phrase shown, so rust goes only to *not valued*.
  it('prints an honest-empty unresolvable row as no figure yet in ink, not rust', () => {
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
      expect(phrase?.style.color).toBe(rgb(colors.ink));
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
          priced(oldTry, 0.9, hoursBefore(NOW, 96), 'Standard'),
          { ...priced(recentTry, 0.8, hoursBefore(NOW, 30 * 24), 'Standard'), lastAttemptedAt: hoursBefore(NOW, 2) },
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

describe('the top-20 bound', () => {
  // Matrix: 25 ranked rows.
  it('shows 20 rows and grows in place to 25, then back', () => {
    const { tracked, dataset } = many(25);
    const view = mountList(tracked, dataset);
    expect(rowsIn(view)).toHaveLength(20);
    const button = view.querySelector<HTMLButtonElement>('[data-expand-affordance]');
    expect(button?.textContent).toBe('+ Read the remaining 5 rows');
    expect(button?.textContent).toBe(expandCopy(5));
    act(() => {
      button?.click();
    });
    expect(rowsIn(view)).toHaveLength(25);
    expect(button?.textContent).toBe('− Show only the top 20');
    expect(button?.textContent).toBe(COLLAPSE_COPY);
    expect(rowsIn(view).slice(20).every((r) => r.dataset['tier'] === '3')).toBe(true);
    expect(cell(rowsIn(view)[24], 'rank').textContent).toBe('25');
    act(() => {
      button?.click();
    });
    expect(rowsIn(view)).toHaveLength(20);
  });

  // Matrix: grown, then shrink to 20, then grow back.
  it('forgets the grown state when the rows drop to 20, so a later rise opens collapsed', () => {
    const big = many(25);
    const view = mountList(big.tracked, big.dataset);
    act(() => {
      view.querySelector<HTMLButtonElement>('[data-expand-affordance]')?.click();
    });
    expect(rowsIn(view)).toHaveLength(25);
    const grown = view.querySelector<HTMLButtonElement>('[data-expand-affordance]');
    expect(grown?.getAttribute('aria-expanded')).toBe('true');
    expect(grown?.textContent).toBe(COLLAPSE_COPY);
    const small = many(20);
    rerenderList(small.tracked, small.dataset);
    expect(rowsIn(view)).toHaveLength(20);
    expect(view.querySelector('[data-expand-affordance]')).toBeNull();
    rerenderList(big.tracked, big.dataset);
    expect(rowsIn(view)).toHaveLength(20);
    const button = view.querySelector<HTMLButtonElement>('[data-expand-affordance]');
    expect(button?.textContent).toBe(expandCopy(5));
    expect(button?.getAttribute('aria-expanded')).toBe('false');
  });

  it('counts the unpriced trail toward the 20 and toward N', () => {
    const { tracked, dataset } = many(19);
    const extra = [rawEntry('Zz One'), rawEntry('Zz Two'), rawEntry('Zz Three')];
    const view = mountList([...tracked, ...extra], dataset);
    expect(rowsIn(view)).toHaveLength(20);
    expect(view.querySelector('[data-expand-affordance]')?.textContent).toBe(expandCopy(2));
  });

  // Matrix: one hidden row, many hidden rows.
  it('names one hidden row in the singular and two in the plural', () => {
    const one = many(21);
    expect(mountList(one.tracked, one.dataset).querySelector('[data-expand-affordance]')?.textContent).toBe(
      '+ Read the remaining 1 row',
    );
    unmount();
    const two = many(22);
    expect(mountList(two.tracked, two.dataset).querySelector('[data-expand-affordance]')?.textContent).toBe(
      '+ Read the remaining 2 rows',
    );
  });

  it('prints no affordance at 20 rows or fewer', () => {
    const { tracked, dataset } = many(20);
    expect(mountList(tracked, dataset).querySelector('[data-expand-affordance]')).toBeNull();
  });
});

describe('the trust mark and the unit glyphs', () => {
  it('separates glyph and word with a U+200A hair space', () => {
    expect(HAIR_SPACE).toBe(' ');
  });

  it('renders the class glyph ≡ in sepia', () => {
    const container = mount(<UnitGlyph unit="class" />);
    const glyph = container.querySelector<HTMLElement>('[data-unit-glyph="class"]');
    expect(glyph?.textContent).toBe(glyphs.unitClass);
    expect(glyph?.style.color).toBe(rgb(colors.sepia));
  });
});

describe('the key block', () => {
  it('holds three columns, the first being Silence means healthy, and no curation marks', () => {
    const container = mount(<KeyBlock />);
    const columns = Array.from(container.querySelectorAll('[data-key-column]'));
    expect(columns).toHaveLength(3);
    expect(columns.map((c) => c.firstElementChild?.textContent)).toEqual([...KEY_TITLES]);
    expect(KEY_TITLES[0]).toBe('Silence means healthy');
    const text = container.textContent;
    expect(text).toContain('nothing here is degraded');
    expect(text).toContain('never attempted — no request was ever issued');
    expect(text).not.toContain(glyphs.pruned);
    expect(text).not.toContain(glyphs.unitRaw);
    expect(text).not.toContain(glyphs.unitClass);
  });
});
