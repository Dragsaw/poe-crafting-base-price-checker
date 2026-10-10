import type { PriceTrust } from '@poe/contracts';
import type { JSX } from 'react';
import { afterEach, describe, expect, it } from 'vitest';

import { TOP_LINES } from '../shared/product';
import { mount, mountList, NOW, rerender, rgb, rowsIn, unmount } from '../test-support/dom';
import { hoursBefore, many, priced, rawEntry } from '../test-support/list-fixtures';
import { colors, expansionLineGrid, spacing } from '../theme/tokens';
import { PageProvider } from '../theme/PageProvider';
import type { AffixPart } from './combination-text';
import type { ClassDisplayRow, CraftedCombination, PrunedCombination } from './display-rows';
import { ClassExpansionPanel } from './ExpansionPanel';
import { BELOW_THRESHOLD_NOTE, CURATION_MARKS, ESTIMATED_ODDS_CONTEXT, FEWER_LINES_COPY, moreLinesCopy, prunedCopy } from './format';
import { RankedList } from './RankedList';
import { NAME_COLORS } from './RankedRow';
import { MISSING_FIGURE } from './row/ExpectedValueCell';
import { click, linesIn, openOne, panelsIn, SEARCH } from './expansion/test-support';
import { JOINER } from '../shared/text';

afterEach(unmount);

const CURRENT: PriceTrust = { verdict: 'current', reasons: [] };
const affix = (text: string): readonly AffixPart[] => [{ text, verbatim: false }];

function combination(index: number): CraftedCombination {
  return {
    key: `line-${String(index).padStart(2, '0')}`,
    text: affix(`T1 Mod ${String(index)}`),
    status: 'active',
    price: 1,
    trust: CURRENT,
    isBelowThreshold: false,
    entry: undefined,
  };
}

function pruned(index: number): PrunedCombination {
  return { key: `pruned-${String(index)}`, text: affix(`T2 Gone ${String(index)}`), reason: `reason ${String(index)}` };
}

function classRow(lines: number, prunedCount: number, overrides: Partial<ClassDisplayRow> = {}): ClassDisplayRow {
  return {
    key: '["crafted","accessory.ring","Rings"]',
    numeral: 1,
    tier: 1,
    unit: 'class',
    label: 'Rings',
    itemLevel: 82,
    ev: { kind: 'figure', text: '1.00', negative: false },
    trust: CURRENT,
    provenance: 'measured',
    chase: [],
    combinations: Array.from({ length: lines }, (_, index) => combination(index)),
    pruned: Array.from({ length: prunedCount }, (_, index) => pruned(index)),
    ...overrides,
  };
}

function panel(row: ClassDisplayRow): JSX.Element {
  return (
    <PageProvider>
      <ClassExpansionPanel row={row} activeLeague="Forbidden Rites" />
    </PageProvider>
  );
}

// Inline styles cannot answer the pointer; only a stylesheet class can.
const classesIn = (within: Element | undefined): string[] =>
  [...(within?.querySelectorAll<HTMLElement>('[class]') ?? [])].filter((node) => !(node instanceof SVGElement)).map((node) => node.className);

const showMore = (view: HTMLElement, name: string): HTMLButtonElement | null =>
  view.querySelector<HTMLButtonElement>(`[data-show-more="${name}"]`);

describe('the expansion panel', () => {
  it('opens in place, flush under its row, indented, with the open row’s bar down its edge', () => {
    const { tracked, dataset } = many(3, NOW);
    const view = mountList(tracked, dataset);
    expect(panelsIn(view)).toHaveLength(0);
    const second = rowsIn(view)[1];
    click(second);
    const [opened] = panelsIn(view);
    expect(second?.nextElementSibling).toBe(opened);
    expect(opened?.style.width).toBe('');
    expect(opened?.style.paddingLeft).toBe(spacing['expansion-indent']);
    expect(opened?.style.background).toBe(rgb(colors.surface));
    expect(opened?.style.boxShadow).toContain(spacing['open-row-bar']);
    expect(opened?.style.transition).toBe('');
    // Not a modal: nothing is an overlay or a dialog.
    expect(view.querySelector('[role="dialog"]')).toBeNull();
    expect(opened?.style.position).toBe('');
  });

  // Matrix: Raw Base. The context line names the base; its one line holds no Combination text.
  it('opens a Raw Base on a context line in its rarity colour, then its one line', () => {
    const belt = rawEntry('Stellar Amulet', 82);
    const view = mountList([belt], [priced(belt, 1.27, hoursBefore(NOW, 11))], 0.5);
    click(rowsIn(view)[0]);
    const name = view.querySelector<HTMLElement>('[data-context-line] [data-context-name]');
    expect(name?.textContent).toBe('Stellar Amulet');
    expect(name?.style.color).toBe(rgb(NAME_COLORS.raw));
    expect(view.querySelector('[data-context-line]')?.textContent).toBe('Stellar Amulet');
    expect(linesIn(view)).toHaveLength(1);
    expect(view.querySelector('[data-panel-title], [data-panel-sub]')).toBeNull();
  });

  // Matrix: estimated odds (state 12).
  it('continues a uniform-prior row’s context line with the ≈ sentence', () => {
    const view = mount(panel(classRow(1, 0, { provenance: 'uniform-prior' })));
    const context = view.querySelector<HTMLElement>('[data-context-line]');
    expect(context?.textContent).toBe(`Rings${JOINER} ${ESTIMATED_ODDS_CONTEXT}`);
    expect(context?.querySelector('svg[data-mark="estimate"]')).not.toBeNull();
    expect(context?.querySelector<HTMLElement>('[data-context-name]')?.style.color).toBe(rgb(NAME_COLORS.class));
  });

  it('ends a uniform-prior row’s context line at the name when its EV is `—`', () => {
    const pending: PriceTrust = { verdict: 'pending', reasons: [{ kind: 'no-prices' }] };
    const view = mount(panel(classRow(1, 0, { provenance: 'uniform-prior', ev: { kind: 'missing' }, trust: pending })));
    expect(view.querySelector('[data-context-line]')?.textContent).toBe('Rings');
    expect(view.querySelector('[data-context-estimate]')).toBeNull();
  });

  it('gives each line the expansion-line grid, one line high', () => {
    const belt = rawEntry('Wide Belt');
    const line = openOne(belt, priced(belt, 0.8, hoursBefore(NOW, 11), { search: SEARCH }));
    expect(line.style.gridTemplateColumns).toBe(expansionLineGrid.gridTemplateColumns);
    expect(line.style.columnGap).toBe(spacing['col-gap']);
    expect(line.style.height).toBe(spacing['line-height-expansion']);
    expect(line.style.whiteSpace).toBe('nowrap');
  });

  it('holds no tooltip, no ellipsis and no hover state but the ↗ accent', () => {
    const view = mount(panel(classRow(3, 1)));
    click(showMore(view, 'pruned'));
    const opened = panelsIn(view)[0];
    for (const node of [opened, ...(opened?.querySelectorAll<HTMLElement>('*') ?? [])]) {
      expect(node?.style.textOverflow).toBe('');
      expect(node?.style.overflow).toBe('');
      expect(node?.hasAttribute('title')).toBe(false);
    }
    expect(classesIn(opened)).toEqual([]);
    const belt = rawEntry('Wide Belt');
    const line = openOne(belt, priced(belt, 0.8, hoursBefore(NOW, 1), { search: SEARCH }));
    expect(classesIn(line.closest('[data-expansion-panel]') ?? undefined)).toEqual(['fg-trade-link']);
  });

  // Matrix: below threshold, rough (state 20). The rough verdict never prints on a below-threshold line.
  it('dims a below-threshold line and prints only below threshold, with no mark, even when rough', () => {
    const rough: CraftedCombination = {
      ...combination(0),
      price: 0.1,
      trust: { verdict: 'rough', reasons: [{ kind: 'old', days: 5 }] },
      isBelowThreshold: true,
    };
    const view = mount(panel(classRow(0, 0, { combinations: [rough] })));
    const [line] = linesIn(view);
    expect(line?.querySelector('[data-cell="trust"]')?.textContent).toBe(BELOW_THRESHOLD_NOTE);
    expect(line?.querySelector('[data-cell="trust"] svg')).toBeNull();
    expect(line?.querySelector<HTMLElement>('[data-cell="combination"]')?.style.color).toBe(rgb(colors['text-tertiary']));
    expect(line?.querySelector<HTMLElement>('[data-cell="price"]')?.style.color).toBe(rgb(colors['text-tertiary']));
    expect(line?.querySelector('[data-cell="price"]')?.textContent).toBe('0.10');
  });

  // Matrix: 11 lines, 2 pruned (state 39). N counts the hidden lines without the pruned.
  it('opens on the top 8 lines, then + N more combinations, then + N pruned', () => {
    const view = mount(panel(classRow(11, 2)));
    expect(linesIn(view)).toHaveLength(TOP_LINES);
    expect(showMore(view, 'lines')?.textContent).toBe(moreLinesCopy(3));
    expect(showMore(view, 'pruned')?.textContent).toBe(prunedCopy(2, false));
    expect(showMore(view, 'lines')?.compareDocumentPosition(showMore(view, 'pruned') as Node)).toBe(Node.DOCUMENT_POSITION_FOLLOWING);
    expect(showMore(view, 'lines')?.style.color).toBe(rgb(colors.accent));

    click(showMore(view, 'lines'));
    expect(linesIn(view)).toHaveLength(11);
    expect(showMore(view, 'lines')?.textContent).toBe(FEWER_LINES_COPY);
    expect(showMore(view, 'lines')?.getAttribute('aria-expanded')).toBe('true');
    click(showMore(view, 'lines'));
    expect(linesIn(view)).toHaveLength(TOP_LINES);
  });

  it('shows every line and no affordance on a panel of 8 lines or fewer', () => {
    const view = mount(panel(classRow(TOP_LINES, 0)));
    expect(linesIn(view)).toHaveLength(TOP_LINES);
    expect(showMore(view, 'lines')).toBeNull();
    expect(showMore(view, 'pruned')).toBeNull();
  });

  // Matrix: pruned (state 10).
  it('opens the pruned lines struck through, led by † pruned, with —, no trust, no link and the reason', () => {
    const view = mount(panel(classRow(2, 2)));
    expect(view.querySelectorAll('[data-pruned-line]')).toHaveLength(0);
    click(showMore(view, 'pruned'));
    expect(showMore(view, 'pruned')?.textContent).toBe(prunedCopy(2, true));
    const [first] = view.querySelectorAll<HTMLElement>('[data-pruned-line]');
    expect(first?.querySelector('[data-cell="combination"]')?.textContent).toBe(`${CURATION_MARKS.pruned} T2 Gone 0`);
    expect(first?.querySelector<HTMLElement>('[data-struck]')?.style.textDecoration).toBe('line-through');
    expect(first?.querySelector('[data-cell="price"]')?.textContent).toBe(MISSING_FIGURE);
    expect(first?.querySelector('[data-cell="trust"]')?.childNodes).toHaveLength(0);
    expect(first?.querySelector('[data-cell="trade-link"]')?.childNodes).toHaveLength(0);
    expect(first?.querySelector('[data-prune-reason]')?.textContent).toBe('reason 0');
    expect(first?.querySelector('[data-prune-reason]')?.textContent).not.toContain('ago');
  });

  it('re-renders its lines and its remainder count in place when the row re-ranks', () => {
    const view = mount(panel(classRow(11, 0)));
    click(showMore(view, 'lines'));
    rerender(panel(classRow(10, 0)));
    expect(linesIn(view)).toHaveLength(10);
    click(showMore(view, 'lines'));
    expect(showMore(view, 'lines')?.textContent).toBe(moreLinesCopy(2));
    rerender(panel(classRow(5, 0)));
    expect(linesIn(view)).toHaveLength(5);
    expect(showMore(view, 'lines')).toBeNull();
  });

  // The toggles reset only when the panel closes; a re-rank through 8 or fewer lines keeps the remainder open.
  it('keeps the remainder open across a re-rank that shrinks the panel to 8 lines and grows it again', () => {
    const view = mount(panel(classRow(11, 0)));
    click(showMore(view, 'lines'));
    rerender(panel(classRow(5, 0)));
    expect(showMore(view, 'lines')).toBeNull();
    rerender(panel(classRow(11, 0)));
    expect(linesIn(view)).toHaveLength(11);
    expect(showMore(view, 'lines')?.textContent).toBe(FEWER_LINES_COPY);
  });

  // Interactions 3, 7: closing the row resets both toggles.
  it('reopens with the remainder and the pruned lines closed', () => {
    const view = mount(
      <PageProvider>
        <RankedList rows={[classRow(11, 2)]} activeLeague="Forbidden Rites" />
      </PageProvider>,
    );
    click(rowsIn(view)[0]);
    click(showMore(view, 'lines'));
    click(showMore(view, 'pruned'));
    expect(view.querySelectorAll('[data-pruned-line]')).toHaveLength(2);

    click(rowsIn(view)[0]);
    expect(panelsIn(view)).toHaveLength(0);
    click(rowsIn(view)[0]);
    expect(linesIn(view)).toHaveLength(TOP_LINES);
    expect(showMore(view, 'lines')?.textContent).toBe(moreLinesCopy(3));
    expect(showMore(view, 'pruned')?.textContent).toBe(prunedCopy(2, false));
    expect(view.querySelectorAll('[data-pruned-line]')).toHaveLength(0);
  });
});
