import { afterEach, describe, expect, it } from 'vitest';

import { cellIn as cell, mountList, NOW, rgb, rowsIn, unmount } from '../../test-support/dom';
import { hover, leave } from '../../test-support/hover';
import { hoursBefore, priced, rawEntry, unpriced } from '../../test-support/list-fixtures';
import { colors } from '../../theme/tokens';
import { sellAsIsLine } from '../format';
import { MISSING_FIGURE } from '../row/ExpectedValueCell';
import { FIXED_ROW_REASONS, VERDICT_WORDS } from '../row/trust-words';
import { JOINER } from '../../shared/text';

afterEach(unmount);

function markOf(row: HTMLElement | undefined): string | undefined {
  return row?.querySelector<HTMLElement>('[data-row-mark]')?.dataset['rowMark'];
}

function tooltipOf(row: HTMLElement | undefined): string | null | undefined {
  const mark = row?.querySelector('[data-row-mark]');
  hover(mark);
  const text = document.body.querySelector('[data-mark-tooltip]')?.textContent;
  leave(mark);
  return text;
}

describe('the unpriced trail', () => {
  // Matrix: unpriced raw trail (states 18, 40).
  it('numbers the priced rows, then trails pending and broken rows, each `—` beside its mark', () => {
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
    expect(rows.map((r) => markOf(r))).toEqual([undefined, undefined, 'pending', 'pending', 'broken', 'broken']);
    for (const r of rows.slice(2)) {
      const missing = cell(r, 'ev').querySelector<HTMLElement>('[data-ev-missing]');
      expect(cell(r, 'ev').textContent).toBe(MISSING_FIGURE);
      expect(missing?.style.color).toBe(rgb(colors['text-tertiary']));
      expect(missing?.style.fontWeight).toBe('400');
      expect(cell(r, 'ev').querySelector('[data-ev-figure]')).toBeNull();
      expect(r.dataset['tier']).toBe('3');
      expect(r.dataset['raw']).toBeDefined();
      expect(r.querySelector('[data-sell-as-is]')?.textContent).toBe(sellAsIsLine(82));
    }
    // The Raw Base tooltip column: `no-listings` prints with no age.
    expect(tooltipOf(rows[2])).toBe(`${VERDICT_WORDS.pending}${JOINER}${FIXED_ROW_REASONS['no-listings']}`);
    expect(tooltipOf(rows[3])).toBe(`${VERDICT_WORDS.pending}${JOINER}${FIXED_ROW_REASONS['never-synced']}`);
    expect(tooltipOf(rows[5])).toBe(`${VERDICT_WORDS.broken}${JOINER}${FIXED_ROW_REASONS.unresolvable}`);
  });

  it('keeps each entry’s own mark and reason in an honest-empty list', () => {
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
    expect(rows.map((r) => cell(r, 'ev').textContent)).toEqual([MISSING_FIGURE, MISSING_FIGURE]);
    expect(rows.map((r) => markOf(r))).toEqual(['pending', 'broken']);
  });

  it('never prints 0, a blank, or a `—` with no mark beside it', () => {
    const tried = rawEntry('Coral Ring');
    const never = rawEntry('Wide Belt');
    const rows = rowsIn(mountList([tried, never], [unpriced(tried, { state: 'no-listings' })]));
    for (const r of rows) {
      const text = cell(r, 'ev').textContent;
      expect(text).not.toMatch(/^(0|0\.00|)$/);
      expect(text === MISSING_FIGURE && markOf(r) === undefined).toBe(false);
    }
  });
});
