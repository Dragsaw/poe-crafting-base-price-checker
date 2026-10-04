import { afterEach, describe, expect, it } from 'vitest';

import { cssNumber } from '../test-support/css-number';
import { mountList, NOW, rgb, rowsIn, unmount } from '../test-support/dom';
import { hoursBefore, many, priced, rawEntry } from '../test-support/list-fixtures';
import { colors, columnSums, glyphs, spacing } from '../theme/tokens';
import { PANEL_ASKING_SENTENCE, RAW_NO_RECIPE_SENTENCE } from './format';
import { click, openOne, panelsIn, SEARCH } from './expansion/test-support';

afterEach(unmount);

describe('the expansion panel', () => {
  it('opens in place, flush under its row, as a bordered paper card with no top border', () => {
    const { tracked, dataset } = many(3, NOW);
    const view = mountList(tracked, dataset);
    expect(panelsIn(view)).toHaveLength(0);
    const second = rowsIn(view)[1];
    click(second);
    const [panel] = panelsIn(view);
    expect(second?.nextElementSibling).toBe(panel);
    expect(panel?.style.width).toBe('1012px');
    expect(panel?.style.boxSizing).toBe('border-box');
    expect(panel?.style.padding).toBe('18px 22px 20px');
    expect(panel?.style.margin).toBe('0px 0px 16px');
    expect(panel?.style.borderTopStyle).toBe('none');
    expect(panel?.style.borderLeft).toBe(`1px solid ${rgb(colors.edge)}`);
    expect(panel?.style.background).toBe(rgb(colors.paper));
    expect(panel?.style.transition).toBe('');
    expect(panel?.style.animation).toBe('');
    expect(second?.style.borderBottom).toContain(rgb(colors['rule-strong']));
    // Not a modal: nothing is an overlay or a dialog.
    expect(view.querySelector('[role="dialog"]')).toBeNull();
    expect(panel?.style.position).toBe('');
  });

  it('titles the panel with the sepia unit glyph and the italic name, then the sub-line', () => {
    const belt = rawEntry('Stellar Amulet', 82);
    const view = mountList([belt], [priced(belt, 1.27, hoursBefore(NOW, 11))], 0.5);
    click(rowsIn(view)[0]);
    const [panel] = panelsIn(view);
    const title = panel?.querySelector<HTMLElement>('[data-panel-title]');
    const glyph = title?.querySelector<HTMLElement>('[data-unit-glyph]');
    expect(glyph?.textContent).toBe(glyphs.unitRaw);
    expect(glyph?.style.color).toBe(rgb(colors.sepia));
    const name = title?.querySelector<HTMLElement>('[data-panel-name]');
    expect(name?.textContent).toBe('Stellar Amulet');
    expect(name?.style.fontStyle).toBe('italic');
    expect(title?.style.fontSize).toBe('20px');
    const sub = panel?.querySelector<HTMLElement>('[data-panel-sub]');
    expect(sub?.textContent).toBe(
      'Uncrafted at Item Level 82, valued at its own current asking price and not at a craft outcome. ' +
        'One Combination is tracked here: the degenerate Combination of no affixes. ' +
        `Payout Threshold 0.50 Divine. ${RAW_NO_RECIPE_SENTENCE} ${PANEL_ASKING_SENTENCE}`,
    );
    expect(sub?.style.margin).toBe('4px 0px 13px');
    expect(sub?.textContent).toContain('No Craft Recipe applies');
  });

  it('cuts the combination row into 460 + 250 + 116 + 116 + 24 and 560 + 200 + 206, at 28 + 20 minimum', () => {
    const belt = rawEntry('Wide Belt');
    const row = openOne(belt, priced(belt, 0.8, hoursBefore(NOW, 11), { search: SEARCH }));
    const widths = (line: string): number[] =>
      Array.from(row.querySelectorAll<HTMLElement>(`[data-line="${line}"] > [data-cell]`), (c) => cssNumber(c.style.width));
    expect(widths('1')).toEqual([...columnSums.combinationLine1]);
    expect(widths('2')).toEqual([...columnSums.combinationLine2]);
    expect(row.style.minHeight).toBe(`${String(spacing.combinationRowHeight)}px`);
    expect(row.querySelector<HTMLElement>('[data-line="1"]')?.style.height).toBe('28px');
    expect(row.querySelector<HTMLElement>('[data-line="2"]')?.style.minHeight).toBe('20px');
    expect(row.querySelector<HTMLElement>('[data-line="2"]')?.style.lineHeight).toBe('20px');
    for (const c of row.querySelectorAll<HTMLElement>('[data-cell]')) {
      expect(c.style.boxSizing).toBe('border-box');
      expect(c.style.paddingRight).toBe(c.dataset['cell'] === 'trade-link' ? '' : '12px');
    }
  });

  it('never truncates, ellipsises or tooltips inside a combination row, and line two wraps', () => {
    const belt = rawEntry('Wide Belt');
    const row = openOne(belt, priced(belt, 0.8, hoursBefore(NOW, 11), { search: SEARCH }));
    for (const node of [row, ...row.querySelectorAll<HTMLElement>('*')]) {
      expect(node.style.textOverflow).toBe('');
      expect(node.style.overflow).toBe('');
      expect(node.hasAttribute('title')).toBe(false);
    }
    expect(row.querySelector<HTMLElement>('[data-line="2"]')?.style.whiteSpace).toBe('normal');
  });
});
