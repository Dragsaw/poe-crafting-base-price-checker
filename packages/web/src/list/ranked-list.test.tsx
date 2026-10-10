import { act } from 'react';
import { afterEach, describe, expect, it } from 'vitest';

import { cellIn as cell, mountList, NOW, rgb, rowsIn, unmount } from '../test-support/dom';
import { hover } from '../test-support/hover';
import { hoursBefore, many, priced, rawEntry } from '../test-support/list-fixtures';
import { colors, COLUMN_HEADER_HEIGHT, rankedRowGrid, spacing } from '../theme/tokens';
import { COLUMN_LABELS } from './ColumnHeader';
import { itemLevelFloor, SELL_AS_IS, sellAsIsLine } from './format';
import { NAME_COLORS, RANK_EMPHASIS } from './RankedRow';
import { EXPECTED_VALUE_TOOLTIP_COPY } from './row/ExpectedValueTooltip';
import { FIGURE_WEIGHT } from './row/ExpectedValueCell';
import { rowReasonWords, VERDICT_WORDS } from './row/trust-words';
import { DIV_UNIT } from '../shared/product';
import { JOINER } from '../shared/text';

afterEach(unmount);

describe('the column header', () => {
  it('prints the four Copy Deck labels on the ranked-row grid', () => {
    const view = mountList([], []);
    const header = view.querySelector<HTMLElement>('[data-column-header]');
    const cells = [...view.querySelectorAll<HTMLElement>('[data-column-header] [data-header-cell]')];
    expect(cells.map((c) => c.textContent)).toEqual(Object.values(COLUMN_LABELS));
    expect(header?.style.gridTemplateColumns).toBe(rankedRowGrid.gridTemplateColumns);
    expect(header?.style.height).toBe(COLUMN_HEADER_HEIGHT);
    expect(header?.style.textTransform).toBe('uppercase');
    expect(cells[0]?.style.textAlign).toBe('right');
  });

  it('pads the EV label by the mark slot and gives it the hover-explanation look', () => {
    const view = mountList([], []);
    const expectedValueCell = view.querySelector<HTMLElement>('[data-header-cell="ev"]');
    expect(expectedValueCell?.style.paddingRight).toBe(spacing['mark-slot']);
    expect(expectedValueCell?.style.textAlign).toBe('right');
    const label = expectedValueCell?.querySelector<HTMLElement>('[data-ev-label]');
    expect(label?.style.cursor).toBe('help');
    expect(label?.style.borderBottom).toContain('dotted');
    expect(label?.style.color).toBe(rgb(colors['text-secondary']));
  });

  it('opens the EV tooltip on hover, with no control in it', () => {
    const view = mountList([], [], 0.5);
    hover(view.querySelector<HTMLElement>('[data-ev-label]'));
    const tooltip = document.body.querySelector<HTMLElement>('[data-ev-tooltip]');
    expect(tooltip?.dataset['evTooltip']).toBe('no-recipe');
    expect(tooltip?.textContent).toContain(EXPECTED_VALUE_TOOLTIP_COPY.head);
    expect(tooltip?.textContent).toContain(`0.50 ${DIV_UNIT}`);
    expect(tooltip?.querySelectorAll('button, a, input, select, textarea')).toHaveLength(0);
  });
});

describe('a ranked Raw Base row', () => {
  // Matrix: Raw Base (state 12a).
  it('prints the numeral, a grey roman name, the figure, an empty mark slot and the sell-as-is line', () => {
    const belt = rawEntry('Wide Belt', 82);
    const [row] = rowsIn(mountList([belt], [priced(belt, 0.5, hoursBefore(NOW, 3))]));
    expect(cell(row, 'rank').textContent).toBe('1');
    const name = row?.querySelector<HTMLElement>('[data-unit-name]');
    expect(name?.textContent).toBe('Wide Belt');
    expect(name?.style.color).toBe(rgb(NAME_COLORS.raw));
    expect(name?.style.fontStyle).toBe('');
    expect(name?.style.textOverflow).toBe('ellipsis');
    expect(cell(row, 'ev').textContent).toBe('0.50');
    expect(row?.querySelector('[data-mark-slot]')?.childElementCount).toBe(0);
    expect(row?.querySelector('[data-estimate]')).toBeNull();
    const line = row?.querySelector<HTMLElement>('[data-sell-as-is]');
    expect(line?.textContent).toBe(sellAsIsLine(82));
    expect(line?.firstElementChild?.textContent).toBe(SELL_AS_IS);
    expect((line?.firstElementChild as HTMLElement | null)?.style.fontWeight).toBe('600');
    expect(line?.textContent).toContain(itemLevelFloor(82));
    expect(row?.querySelector('[data-unit-glyph]')).toBeNull();
    expect(row?.hasAttribute('data-raw')).toBe(true);
    expect(row?.className).toBe('fg-row');
    // The tone is list.css's, so hover can move it.
    expect(row?.style.background).toBe('');
  });

  it('lays out on the four-column grid at the row height', () => {
    const belt = rawEntry('Wide Belt');
    const [row] = rowsIn(mountList([belt], [priced(belt, 0.5, hoursBefore(NOW, 3))]));
    expect(row?.style.gridTemplateColumns).toBe(rankedRowGrid.gridTemplateColumns);
    expect(row?.style.columnGap).toBe(spacing['col-gap']);
    expect(row?.style.height).toBe(spacing['row-height']);
    expect([...(row?.children ?? [])].map((child) => (child as HTMLElement).dataset['cell'])).toEqual(['rank', 'name', 'ev', 'chase']);
  });

  it('prints a tiny figure as < 0.01', () => {
    const belt = rawEntry('Wide Belt');
    const [row] = rowsIn(mountList([belt], [priced(belt, 0.0031, hoursBefore(NOW, 3))], 0));
    expect(cell(row, 'ev').textContent).toBe('< 0.01');
  });

  // Matrix: old and thin raw. The verdict is `core`'s; `web` applies no cut-off (AD-10).
  it('draws ◐ for an old and thin price and names both reasons, age first', () => {
    const amulet = rawEntry('Gold Amulet');
    const stale = priced(amulet, 2, hoursBefore(NOW, 4 * 24 + 4));
    const thin = {
      ...stale,
      price: stale.price.state === 'priced' ? { ...stale.price, observation: { ...stale.price.observation, sampleSize: 1 } } : stale.price,
    };
    const [row] = rowsIn(mountList([amulet], [thin]));
    const mark = row?.querySelector<HTMLElement>('[data-row-mark]');
    expect(mark?.dataset['rowMark']).toBe('rough');
    expect(mark?.querySelector('svg[data-mark="rough"]')).not.toBeNull();
    expect(mark?.style.cursor).toBe('help');
    hover(mark);
    expect(document.body.querySelector('[data-mark-tooltip]')?.textContent).toBe(
      [VERDICT_WORDS.rough, rowReasonWords({ kind: 'old', days: 4 }), rowReasonWords({ kind: 'thin', listings: 1 })].join(JOINER),
    );
  });

  it('emphasises ranks 1–5 by weight and numeral colour only, never by size', () => {
    const { tracked, dataset } = many(12, NOW);
    const rows = rowsIn(mountList(tracked, dataset));
    expect(rows.map((r) => r.dataset['tier'])).toEqual(['1', '1', '1', '1', '1', '2', '2', '2', '2', '2', '3', '3']);
    const figure = (index: number): HTMLElement | null | undefined => rows[index]?.querySelector<HTMLElement>('[data-ev-figure]');
    const name = (index: number): HTMLElement | null | undefined => rows[index]?.querySelector<HTMLElement>('[data-unit-name]');
    expect(cell(rows[0], 'rank').style.fontWeight).toBe(String(RANK_EMPHASIS.emphasised.rank));
    expect(cell(rows[0], 'rank').style.color).toBe(rgb(colors.text));
    expect(name(0)?.style.fontWeight).toBe(String(RANK_EMPHASIS.emphasised.name));
    expect(figure(0)?.style.fontWeight).toBe(String(FIGURE_WEIGHT.emphasised));
    for (const index of [5, 10]) {
      expect(cell(rows[index], 'rank').style.fontWeight).toBe(String(RANK_EMPHASIS.plain.rank));
      expect(cell(rows[index], 'rank').style.color).toBe(rgb(colors['text-tertiary']));
      expect(name(index)?.style.fontWeight).toBe(String(RANK_EMPHASIS.plain.name));
      expect(figure(index)?.style.fontWeight).toBe(String(FIGURE_WEIGHT.plain));
    }
    expect(new Set(rows.map((r) => figure(rows.indexOf(r))?.style.fontSize))).toHaveProperty('size', 1);
  });

  // Matrix: row click.
  it('shows the inset accent bar on an open row without moving a column', () => {
    const { tracked, dataset } = many(5, NOW);
    const view = mountList(tracked, dataset);
    const third = rowsIn(view)[2];
    const columns = third?.style.gridTemplateColumns;
    act(() => {
      third?.click();
    });
    expect(third?.hasAttribute('data-open')).toBe(true);
    expect(third?.style.boxShadow).toBe(`inset ${spacing['open-row-bar']} 0 0 ${colors.accent}`);
    expect(third?.style.borderBottom).toContain('transparent');
    expect(third?.style.gridTemplateColumns).toBe(columns);
    expect(third?.style.marginLeft).toBe('');
    expect(rowsIn(view).filter((r) => r.dataset['open'] !== undefined)).toHaveLength(1);
    act(() => {
      third?.click();
    });
    expect(third?.hasAttribute('data-open')).toBe(false);
    expect(third?.style.boxShadow).toBe('');
  });
});
